from sqlalchemy.orm import Session
from typing import List, Optional
from collections import defaultdict
from ..models.tally_log_entry import TallyLogEntry, TallyLogEntryRole
from ..models.allocation_details import AllocationDetails
from ..models.tally_session import TallySession
from ..schemas.tally_log_entry import TallyLogEntryCreate, TallyLogEntryUpdate
from ..crud import tally_session as session_crud
from ..crud import weight_classification as wc_crud
from ..crud import tally_log_entry_audit as audit_crud
from ..models.utils import utcnow


def create_tally_log_entry(db: Session, log_entry: TallyLogEntryCreate) -> TallyLogEntry:
    """
    Create a tally log entry and increment the corresponding allocation detail.
    This operation is atomic - both the log entry creation and allocation increment
    happen in a single transaction.
    """
    # Validate session exists
    session = session_crud.get_tally_session(db, session_id=log_entry.tally_session_id)
    if session is None:
        raise ValueError("Tally session not found")
    
    # Validate weight classification exists
    wc = wc_crud.get_weight_classification(db, wc_id=log_entry.weight_classification_id)
    if wc is None:
        raise ValueError("Weight classification not found")
    
    # Use weight classification's default_heads if heads is not provided
    # For both Dressed and Byproduct categories
    if log_entry.heads is None:
        log_entry.heads = wc.default_heads if wc.default_heads is not None else 15.0
    
    # Get or create allocation detail for this session + classification
    allocation = db.query(AllocationDetails).filter(
        AllocationDetails.tally_session_id == log_entry.tally_session_id,
        AllocationDetails.weight_classification_id == log_entry.weight_classification_id
    ).first()
    
    if not allocation:
        # Create new allocation detail if it doesn't exist
        from ..schemas.allocation_details import AllocationDetailsCreate
        allocation_create = AllocationDetailsCreate(
            tally_session_id=log_entry.tally_session_id,
            weight_classification_id=log_entry.weight_classification_id,
            required_bags=0.0,
            allocated_bags_tally=0.0,
            allocated_bags_dispatcher=0.0
        )
        # Create directly in the database to avoid the uniqueness check in crud
        allocation = AllocationDetails(**allocation_create.model_dump())
        db.add(allocation)
        db.flush()  # Flush to get the ID without committing
    
    # Increment the appropriate allocated_bags field based on role
    # Each log entry represents one bag/item, so increment by 1 (not by weight)
    if log_entry.role == TallyLogEntryRole.TALLY:
        allocation.allocated_bags_tally += 1
    elif log_entry.role == TallyLogEntryRole.DISPATCHER:
        allocation.allocated_bags_dispatcher += 1
    
    # Aggregate heads: add the heads from this log entry to the allocation
    heads_value = log_entry.heads if log_entry.heads is not None else (wc.default_heads if wc.default_heads is not None else 15.0)
    if allocation.heads is None:
        allocation.heads = 0.0
    allocation.heads += heads_value
    
    # Create the log entry
    db_log_entry = TallyLogEntry(
        tally_session_id=log_entry.tally_session_id,
        weight_classification_id=log_entry.weight_classification_id,
        role=log_entry.role,
        weight=log_entry.weight,
        heads=log_entry.heads if log_entry.heads is not None else (wc.default_heads if wc.default_heads is not None else 15.0),
        notes=log_entry.notes
    )
    db.add(db_log_entry)
    
    # Commit both changes atomically
    db.commit()
    db.refresh(db_log_entry)
    db.refresh(allocation)
    
    return db_log_entry


def get_tally_log_entry(db: Session, entry_id: int) -> Optional[TallyLogEntry]:
    """Get a single tally log entry by ID."""
    return db.query(TallyLogEntry).filter(TallyLogEntry.id == entry_id).first()


def get_tally_log_entries_by_session(
    db: Session, 
    session_id: int, 
    role: Optional[TallyLogEntryRole] = None
) -> List[TallyLogEntry]:
    """
    Get all tally log entries for a session, optionally filtered by role.
    Results are ordered by created_at descending (newest first).
    """
    query = db.query(TallyLogEntry).filter(
        TallyLogEntry.tally_session_id == session_id
    )
    
    if role is not None:
        query = query.filter(TallyLogEntry.role == role)
    
    return query.order_by(TallyLogEntry.created_at.desc()).all()


def delete_tally_log_entry(db: Session, entry_id: int) -> Optional[TallyLogEntry]:
    """
    Delete a tally log entry and decrement the corresponding allocation detail.
    """
    # Get the log entry
    log_entry = get_tally_log_entry(db, entry_id)
    if not log_entry:
        return None

    # Get the weight classification for default_heads fallback
    wc = wc_crud.get_weight_classification(db, wc_id=log_entry.weight_classification_id)
    default_heads = wc.default_heads if wc and wc.default_heads is not None else 15.0

    # Get the allocation detail
    allocation = db.query(AllocationDetails).filter(
        AllocationDetails.tally_session_id == log_entry.tally_session_id,
        AllocationDetails.weight_classification_id == log_entry.weight_classification_id
    ).first()

    if allocation:
        # Decrement the appropriate allocated_bags field based on role
        if log_entry.role == TallyLogEntryRole.TALLY:
            allocation.allocated_bags_tally = max(0.0, allocation.allocated_bags_tally - 1)
        elif log_entry.role == TallyLogEntryRole.DISPATCHER:
            allocation.allocated_bags_dispatcher = max(0.0, allocation.allocated_bags_dispatcher - 1)
        
        # Decrement heads: subtract the heads from this log entry
        heads_value = log_entry.heads if log_entry.heads is not None else default_heads
        if allocation.heads is None:
            allocation.heads = 0.0
        allocation.heads = max(0.0, allocation.heads - heads_value)

    db.delete(log_entry)
    db.commit()
    return log_entry


def update_tally_log_entry(db: Session, entry_id: int, entry_update: TallyLogEntryUpdate, user_id: int) -> Optional[TallyLogEntry]:
    """
    Update a tally log entry and adjust the corresponding allocation details.
    Handles changes to weight, role, heads, notes, weight_classification_id, and tally_session_id.
    """
    # Get the existing entry
    log_entry = get_tally_log_entry(db, entry_id)
    if not log_entry:
        return None

    # Get old values before update (for audit trail)
    old_session_id = log_entry.tally_session_id
    old_wc_id = log_entry.weight_classification_id
    old_role = log_entry.role
    old_heads = log_entry.heads
    old_weight = log_entry.weight
    old_notes = log_entry.notes
    old_wc = wc_crud.get_weight_classification(db, wc_id=old_wc_id)
    old_default_heads = old_wc.default_heads if old_wc and old_wc.default_heads is not None else 15.0
    old_heads_value = old_heads if old_heads is not None else old_default_heads
    
    # Get old session for display name
    old_session = session_crud.get_tally_session(db, session_id=old_session_id)
    old_session_display = f"Session #{old_session.session_number}" if old_session else f"Session ID {old_session_id}"
    old_wc_display = f"{old_wc.classification} ({old_wc.category})" if old_wc else f"WC ID {old_wc_id}"

    # Get update data
    update_data = entry_update.model_dump(exclude_unset=True)
    
    # Determine new values (use old values if not being updated)
    new_session_id = update_data.get('tally_session_id', old_session_id)
    new_wc_id = update_data.get('weight_classification_id', old_wc_id)
    new_role = update_data.get('role', old_role)
    
    # Validate new session if it's being changed
    if new_session_id != old_session_id:
        new_session = session_crud.get_tally_session(db, session_id=new_session_id)
        if new_session is None:
            raise ValueError("Target session not found")
        
        # Validate sessions are in the same plant
        old_session = session_crud.get_tally_session(db, session_id=old_session_id)
        if old_session and old_session.plant_id != new_session.plant_id:
            raise ValueError("Cannot change session to a different plant")
        
        # Validate target session is ongoing
        from ..models.tally_session import TallySessionStatus
        if new_session.status != TallySessionStatus.ONGOING:
            raise ValueError("Target session must be ongoing to update log entries")
    
    # Validate new weight classification if it's being changed
    if new_wc_id != old_wc_id:
        new_wc = wc_crud.get_weight_classification(db, wc_id=new_wc_id)
        if new_wc is None:
            raise ValueError("Weight classification not found")
        
        # Validate weight classification is in the same plant
        if old_wc and old_wc.plant_id != new_wc.plant_id:
            raise ValueError("Cannot change weight classification to a different plant")
    
    # Get new heads value
    new_heads = update_data.get('heads', old_heads)
    new_wc = wc_crud.get_weight_classification(db, wc_id=new_wc_id)
    new_default_heads = new_wc.default_heads if new_wc and new_wc.default_heads is not None else 15.0
    new_heads_value = new_heads if new_heads is not None else new_default_heads
    
    # Get new values for audit trail
    new_weight = update_data.get('weight', old_weight)
    new_notes = update_data.get('notes', old_notes)
    new_session = session_crud.get_tally_session(db, session_id=new_session_id) if new_session_id != old_session_id else old_session
    new_session_display = f"Session #{new_session.session_number}" if new_session else f"Session ID {new_session_id}"
    new_wc_display = f"{new_wc.classification} ({new_wc.category})" if new_wc else f"WC ID {new_wc_id}"
    
    # Build changes dictionary for audit trail
    changes = {}
    
    # Track weight changes
    if 'weight' in update_data and new_weight != old_weight:
        changes['weight'] = {"old": old_weight, "new": new_weight}
    
    # Track role changes
    if 'role' in update_data and new_role != old_role:
        changes['role'] = {"old": old_role.value, "new": new_role.value}
    
    # Track heads changes
    if 'heads' in update_data:
        # Compare the actual values that will be stored
        old_heads_final = old_heads if old_heads is not None else old_default_heads
        new_heads_final = new_heads if new_heads is not None else new_default_heads
        if new_heads_final != old_heads_final:
            changes['heads'] = {"old": old_heads_final, "new": new_heads_final}
    elif new_wc_id != old_wc_id:
        # Heads changed due to weight classification change
        if new_heads_value != old_heads_value:
            changes['heads'] = {"old": old_heads_value, "new": new_heads_value}
    
    # Track notes changes
    if 'notes' in update_data:
        old_notes_str = old_notes if old_notes is not None else ""
        new_notes_str = new_notes if new_notes is not None else ""
        if new_notes_str != old_notes_str:
            changes['notes'] = {"old": old_notes_str, "new": new_notes_str}
    
    # Track weight classification changes
    if 'weight_classification_id' in update_data and new_wc_id != old_wc_id:
        changes['weight_classification'] = {"old": old_wc_display, "new": new_wc_display}
    
    # Track session changes
    if 'tally_session_id' in update_data and new_session_id != old_session_id:
        changes['tally_session'] = {"old": old_session_display, "new": new_session_display}

    # Get old allocation (for decrementing)
    old_allocation = db.query(AllocationDetails).filter(
        AllocationDetails.tally_session_id == old_session_id,
        AllocationDetails.weight_classification_id == old_wc_id
    ).first()

    # Decrement old allocation
    if old_allocation:
        if old_role == TallyLogEntryRole.TALLY:
            old_allocation.allocated_bags_tally = max(0.0, old_allocation.allocated_bags_tally - 1)
        elif old_role == TallyLogEntryRole.DISPATCHER:
            old_allocation.allocated_bags_dispatcher = max(0.0, old_allocation.allocated_bags_dispatcher - 1)
        
        if old_allocation.heads is None:
            old_allocation.heads = 0.0
        old_allocation.heads = max(0.0, old_allocation.heads - old_heads_value)

    # Update the log entry fields
    for field, value in update_data.items():
        if field == 'heads' and value is None:
            # If heads is explicitly set to None, use default from weight classification
            setattr(log_entry, field, new_default_heads)
        else:
            setattr(log_entry, field, value)

    # If heads wasn't explicitly updated but weight classification changed, update heads to new default
    if 'heads' not in update_data and new_wc_id != old_wc_id:
        log_entry.heads = new_default_heads
        new_heads_value = new_default_heads

    # Get or create new allocation (for incrementing)
    new_allocation = db.query(AllocationDetails).filter(
        AllocationDetails.tally_session_id == new_session_id,
        AllocationDetails.weight_classification_id == new_wc_id
    ).first()

    if not new_allocation:
        # Create new allocation detail if it doesn't exist
        from ..schemas.allocation_details import AllocationDetailsCreate
        allocation_create = AllocationDetailsCreate(
            tally_session_id=new_session_id,
            weight_classification_id=new_wc_id,
            required_bags=0.0,
            allocated_bags_tally=0.0,
            allocated_bags_dispatcher=0.0
        )
        new_allocation = AllocationDetails(**allocation_create.model_dump())
        db.add(new_allocation)
        db.flush()  # Flush to get the ID without committing

    # Increment new allocation
    if new_role == TallyLogEntryRole.TALLY:
        new_allocation.allocated_bags_tally += 1
    elif new_role == TallyLogEntryRole.DISPATCHER:
        new_allocation.allocated_bags_dispatcher += 1

    if new_allocation.heads is None:
        new_allocation.heads = 0.0
    new_allocation.heads += new_heads_value

    # Commit all changes atomically
    db.commit()
    db.refresh(log_entry)
    
    # Create audit entry if any changes were made
    if changes:
        audit_crud.create_audit_entry(db, entry_id, user_id, changes)
        db.commit()  # Commit audit entry
    
    return log_entry


def transfer_tally_log_entries(db: Session, entry_ids: List[int], target_session_id: int) -> int:
    """
    Transfer tally log entries from their current sessions to a target session.
    Updates AllocationDetails for both source and target sessions atomically.
    
    Returns the number of entries successfully transferred.
    """
    if not entry_ids:
        raise ValueError("No entry IDs provided")
    
    # Get all entries and validate they exist
    entries = db.query(TallyLogEntry).filter(TallyLogEntry.id.in_(entry_ids)).all()
    if len(entries) != len(entry_ids):
        found_ids = {e.id for e in entries}
        missing_ids = set(entry_ids) - found_ids
        raise ValueError(f"Some entries not found: {missing_ids}")
    
    # Validate entries aren't already in target session
    for entry in entries:
        if entry.tally_session_id == target_session_id:
            raise ValueError(f"Entry {entry.id} is already in the target session")
    
    # Get source sessions and validate they're all in the same plant
    source_session_ids = {entry.tally_session_id for entry in entries}
    source_sessions = db.query(TallySession).filter(
        TallySession.id.in_(source_session_ids)
    ).all()
    
    if len(source_sessions) != len(source_session_ids):
        raise ValueError("Some source sessions not found")
    
    source_plant_ids = {session.plant_id for session in source_sessions}
    if len(source_plant_ids) > 1:
        raise ValueError("Entries must be from sessions in the same plant")
    source_plant_id = source_plant_ids.pop()
    
    # Get target session and validate it exists and is in the same plant
    target_session = session_crud.get_tally_session(db, target_session_id)
    if target_session is None:
        raise ValueError("Target session not found")
    
    if target_session.plant_id != source_plant_id:
        raise ValueError("Target session must be in the same plant as source entries")
    
    # Validate target session is ongoing
    from ..models.tally_session import TallySessionStatus
    if target_session.status != TallySessionStatus.ONGOING:
        raise ValueError("Target session must be ongoing to transfer log entries")
    
    # Validate all weight classifications exist in target plant and cache them
    weight_classification_ids = {entry.weight_classification_id for entry in entries}
    wc_cache = {}
    for wc_id in weight_classification_ids:
        wc = wc_crud.get_weight_classification(db, wc_id)
        if wc is None:
            raise ValueError(f"Weight classification {wc_id} not found")
        if wc.plant_id != source_plant_id:
            raise ValueError(f"Weight classification {wc_id} does not belong to the same plant")
        wc_cache[wc_id] = wc
    
    # Group entries by (source_session_id, weight_classification_id) to track required_bags transfer
    # Only count TALLY entries for required_bags transfer (dispatcher is for verification only)
    allocation_transfers = defaultdict(int)  # (session_id, wc_id) -> count of TALLY entries
    
    # First pass: count only TALLY entries per allocation for required_bags transfer
    for entry in entries:
        if entry.role == TallyLogEntryRole.TALLY:
            allocation_transfers[(entry.tally_session_id, entry.weight_classification_id)] += 1
    
    # Transfer entries atomically
    for entry in entries:
        wc = wc_cache[entry.weight_classification_id]
        default_heads = wc.default_heads if wc.default_heads is not None else 15.0
        # Decrement source session allocation
        source_allocation = db.query(AllocationDetails).filter(
            AllocationDetails.tally_session_id == entry.tally_session_id,
            AllocationDetails.weight_classification_id == entry.weight_classification_id
        ).first()
        
        if source_allocation:
            # Decrement the appropriate allocated_bags field based on role
            if entry.role == TallyLogEntryRole.TALLY:
                source_allocation.allocated_bags_tally = max(0.0, source_allocation.allocated_bags_tally - 1)
            elif entry.role == TallyLogEntryRole.DISPATCHER:
                source_allocation.allocated_bags_dispatcher = max(0.0, source_allocation.allocated_bags_dispatcher - 1)
            
            # Decrement heads
            heads_value = entry.heads if entry.heads is not None else default_heads
            if source_allocation.heads is None:
                source_allocation.heads = 0.0
            source_allocation.heads = max(0.0, source_allocation.heads - heads_value)
        
        # Track transfer: set original_session_id if this is the first transfer
        if entry.original_session_id is None:
            entry.original_session_id = entry.tally_session_id
        
        # Set transferred_at timestamp
        entry.transferred_at = utcnow()
        
        # Update entry's tally_session_id
        entry.tally_session_id = target_session_id
        
        # Get or create target session allocation
        target_allocation = db.query(AllocationDetails).filter(
            AllocationDetails.tally_session_id == target_session_id,
            AllocationDetails.weight_classification_id == entry.weight_classification_id
        ).first()
        
        if not target_allocation:
            # Create new allocation detail if it doesn't exist
            from ..schemas.allocation_details import AllocationDetailsCreate
            allocation_create = AllocationDetailsCreate(
                tally_session_id=target_session_id,
                weight_classification_id=entry.weight_classification_id,
                required_bags=0.0,
                allocated_bags_tally=0.0,
                allocated_bags_dispatcher=0.0
            )
            target_allocation = AllocationDetails(**allocation_create.model_dump())
            db.add(target_allocation)
            db.flush()  # Flush to get the ID without committing
        
        # Increment target session allocation
        if entry.role == TallyLogEntryRole.TALLY:
            target_allocation.allocated_bags_tally += 1
        elif entry.role == TallyLogEntryRole.DISPATCHER:
            target_allocation.allocated_bags_dispatcher += 1
        
        # Increment heads
        heads_value = entry.heads if entry.heads is not None else default_heads
        if target_allocation.heads is None:
            target_allocation.heads = 0.0
        target_allocation.heads += heads_value
    
    # Transfer required_bags proportionally (1:1 with TALLY entries transferred)
    # Only TALLY entries affect required_bags; dispatcher entries are for verification only
    # Process each unique (source_session_id, weight_classification_id) combination
    for (source_session_id, wc_id), entry_count in allocation_transfers.items():
        source_allocation = db.query(AllocationDetails).filter(
            AllocationDetails.tally_session_id == source_session_id,
            AllocationDetails.weight_classification_id == wc_id
        ).first()
        
        if source_allocation and source_allocation.required_bags > 0:
            # Calculate how many required_bags to transfer (1:1 with entries)
            # Transfer the minimum of: entry_count or available required_bags
            required_bags_to_transfer = min(float(entry_count), source_allocation.required_bags)
            
            # Decrement source required_bags
            source_allocation.required_bags = max(0.0, source_allocation.required_bags - required_bags_to_transfer)
            
            # Get or create target allocation for this weight classification
            target_allocation = db.query(AllocationDetails).filter(
                AllocationDetails.tally_session_id == target_session_id,
                AllocationDetails.weight_classification_id == wc_id
            ).first()
            
            if not target_allocation:
                # This shouldn't happen as we already created it above, but handle it just in case
                from ..schemas.allocation_details import AllocationDetailsCreate
                allocation_create = AllocationDetailsCreate(
                    tally_session_id=target_session_id,
                    weight_classification_id=wc_id,
                    required_bags=0.0,
                    allocated_bags_tally=0.0,
                    allocated_bags_dispatcher=0.0
                )
                target_allocation = AllocationDetails(**allocation_create.model_dump())
                db.add(target_allocation)
                db.flush()
            
            # Increment target required_bags
            target_allocation.required_bags += required_bags_to_transfer
    
    # Commit all changes atomically
    db.commit()
    
    return len(entries)