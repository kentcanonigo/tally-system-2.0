from sqlalchemy.orm import Session
from typing import List, Optional
from ..models.tally_log_entry import TallyLogEntry, TallyLogEntryRole
from ..models.allocation_details import AllocationDetails
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
    
    # Force heads to default (15) for byproducts - each bag has 15 heads
    DEFAULT_HEADS_PER_BAG = 15.0
    if wc.category == 'Byproduct':
        log_entry.heads = DEFAULT_HEADS_PER_BAG
    
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
    heads_value = log_entry.heads if log_entry.heads is not None else 15.0
    if allocation.heads is None:
        allocation.heads = 0.0
    allocation.heads += heads_value
    
    # Create the log entry
    db_log_entry = TallyLogEntry(
        tally_session_id=log_entry.tally_session_id,
        weight_classification_id=log_entry.weight_classification_id,
        role=log_entry.role,
        weight=log_entry.weight,
        heads=log_entry.heads if log_entry.heads is not None else 15.0,
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
        heads_value = log_entry.heads if log_entry.heads is not None else 15.0
        if allocation.heads is None:
            allocation.heads = 0.0
        allocation.heads = max(0.0, allocation.heads - heads_value)

    db.delete(log_entry)
    db.commit()
    return log_entry