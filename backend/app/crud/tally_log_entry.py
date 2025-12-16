from sqlalchemy.orm import Session
from typing import List, Optional
from ..models.tally_log_entry import TallyLogEntry, TallyLogEntryRole
from ..models.allocation_details import AllocationDetails
from ..models.tally_session import TallySession
from ..schemas.tally_log_entry import TallyLogEntryCreate
from ..crud import tally_session as session_crud
from ..crud import weight_classification as wc_crud


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
    
    # Commit all changes atomically
    db.commit()
    
    return len(entries)