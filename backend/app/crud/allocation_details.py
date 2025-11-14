from sqlalchemy.orm import Session
from typing import List, Optional
from ..models.allocation_details import AllocationDetails
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
    for field, value in update_data.items():
        setattr(db_allocation, field, value)
    
    db.commit()
    db.refresh(db_allocation)
    return db_allocation


def delete_allocation_detail(db: Session, allocation_id: int) -> bool:
    db_allocation = get_allocation_detail(db, allocation_id)
    if not db_allocation:
        return False
    
    db.delete(db_allocation)
    db.commit()
    return True

