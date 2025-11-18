from sqlalchemy.orm import Session
from typing import List, Optional
from ..models.allocation_details import AllocationDetails
from ..models.tally_log_entry import TallyLogEntry, TallyLogEntryRole
from ..schemas.allocation_details import AllocationDetailsCreate, AllocationDetailsUpdate


def create_allocation_detail(db: Session, allocation_detail: AllocationDetailsCreate) -> AllocationDetails:
    # Check if allocation already exists for this session and weight classification
    existing = db.query(AllocationDetails).filter(
        AllocationDetails.tally_session_id == allocation_detail.tally_session_id,
        AllocationDetails.weight_classification_id == allocation_detail.weight_classification_id
    ).first()
    
    if existing:
        raise ValueError("Allocation detail already exists for this session and weight classification")
    
    db_allocation = AllocationDetails(**allocation_detail.model_dump())
    db.add(db_allocation)
    db.commit()
    db.refresh(db_allocation)
    return db_allocation


def get_allocation_detail(db: Session, allocation_id: int) -> Optional[AllocationDetails]:
    return db.query(AllocationDetails).filter(AllocationDetails.id == allocation_id).first()


def get_allocation_details_by_session(db: Session, session_id: int) -> List[AllocationDetails]:
    return db.query(AllocationDetails).filter(
        AllocationDetails.tally_session_id == session_id
    ).all()


def update_allocation_detail(db: Session, allocation_id: int, allocation_update: AllocationDetailsUpdate) -> Optional[AllocationDetails]:
    db_allocation = get_allocation_detail(db, allocation_id)
    if not db_allocation:
        return None
    
    update_data = allocation_update.model_dump(exclude_unset=True)
    
    # Remove allocated_bags fields if they were somehow included (they shouldn't be editable)
    update_data.pop('allocated_bags_tally', None)
    update_data.pop('allocated_bags_dispatcher', None)
    
    # Check if weight_classification_id is being updated
    if 'weight_classification_id' in update_data:
        new_wc_id = update_data['weight_classification_id']
        # Only check if the weight classification is actually changing
        if new_wc_id != db_allocation.weight_classification_id:
            # Check if there are existing log entries for this allocation
            log_entry_count = db.query(TallyLogEntry).filter(
                TallyLogEntry.tally_session_id == db_allocation.tally_session_id,
                TallyLogEntry.weight_classification_id == db_allocation.weight_classification_id
            ).count()
            
            if log_entry_count > 0:
                raise ValueError(
                    f"Cannot change weight classification because there are {log_entry_count} existing log entry/entries "
                    "for this allocation. Please delete the log entries from the view logs screen first for safety."
                )
            
            # Check if the new weight classification would create a duplicate
            existing = db.query(AllocationDetails).filter(
                AllocationDetails.tally_session_id == db_allocation.tally_session_id,
                AllocationDetails.weight_classification_id == new_wc_id,
                AllocationDetails.id != allocation_id  # Exclude the current allocation
            ).first()
            
            if existing:
                raise ValueError("Allocation detail already exists for this session and weight classification")
    
    for field, value in update_data.items():
        setattr(db_allocation, field, value)
    
    db.commit()
    db.refresh(db_allocation)
    return db_allocation


def delete_allocation_detail(db: Session, allocation_id: int) -> bool:
    db_allocation = get_allocation_detail(db, allocation_id)
    if not db_allocation:
        return False
    
    # Delete associated log entries for this allocation's session and weight classification
    deleted_count = db.query(TallyLogEntry).filter(
        TallyLogEntry.tally_session_id == db_allocation.tally_session_id,
        TallyLogEntry.weight_classification_id == db_allocation.weight_classification_id
    ).delete(synchronize_session=False)
    
    # Delete the allocation
    db.delete(db_allocation)
    db.commit()
    return True


def reset_allocated_bags_for_session(
    db: Session, 
    session_id: int, 
    reset_tally: bool = False, 
    reset_dispatcher: bool = False
) -> dict:
    """
    Reset allocated bags for all allocations in a session and delete associated tally log entries.
    Returns a dictionary with the number of allocations updated and log entries deleted.
    """
    allocations = get_allocation_details_by_session(db, session_id)
    
    if not allocations:
        return {"allocations_updated": 0, "log_entries_deleted": 0}
    
    updated_count = 0
    log_entries_deleted = 0
    
    # Delete tally log entries based on role
    if reset_tally:
        deleted_count = db.query(TallyLogEntry).filter(
            TallyLogEntry.tally_session_id == session_id,
            TallyLogEntry.role == TallyLogEntryRole.TALLY
        ).delete(synchronize_session=False)
        log_entries_deleted += deleted_count
    
    if reset_dispatcher:
        deleted_count = db.query(TallyLogEntry).filter(
            TallyLogEntry.tally_session_id == session_id,
            TallyLogEntry.role == TallyLogEntryRole.DISPATCHER
        ).delete(synchronize_session=False)
        log_entries_deleted += deleted_count
    
    # Reset allocated bags
    for allocation in allocations:
        updated = False
        if reset_tally:
            allocation.allocated_bags_tally = 0.0
            updated = True
        if reset_dispatcher:
            allocation.allocated_bags_dispatcher = 0.0
            updated = True
        
        if updated:
            updated_count += 1
    
    if updated_count > 0 or log_entries_deleted > 0:
        db.commit()
    
    return {"allocations_updated": updated_count, "log_entries_deleted": log_entries_deleted}
