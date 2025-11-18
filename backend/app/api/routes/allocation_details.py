from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ...database import get_db
from ...schemas.allocation_details import AllocationDetailsCreate, AllocationDetailsUpdate, AllocationDetailsResponse
from ...crud import allocation_details as crud
from ...crud import tally_session as session_crud
from ...crud import weight_classification as wc_crud

router = APIRouter()


@router.get("/tally-sessions/{session_id}/allocations", response_model=List[AllocationDetailsResponse])
def read_allocation_details_by_session(session_id: int, db: Session = Depends(get_db)):
    # Verify session exists
    session = session_crud.get_tally_session(db, session_id=session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Tally session not found")
    
    allocations = crud.get_allocation_details_by_session(db, session_id=session_id)
    return allocations


@router.get("/allocations/{allocation_id}", response_model=AllocationDetailsResponse)
def read_allocation_detail(allocation_id: int, db: Session = Depends(get_db)):
    allocation = crud.get_allocation_detail(db, allocation_id=allocation_id)
    if allocation is None:
        raise HTTPException(status_code=404, detail="Allocation detail not found")
    return allocation


@router.post("/tally-sessions/{session_id}/allocations", response_model=AllocationDetailsResponse, status_code=status.HTTP_201_CREATED)
def create_allocation_detail(
    session_id: int,
    allocation_detail: AllocationDetailsCreate,
    db: Session = Depends(get_db)
):
    # Verify session exists
    session = session_crud.get_tally_session(db, session_id=session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Tally session not found")
    
    # Ensure session_id matches
    if allocation_detail.tally_session_id != session_id:
        raise HTTPException(status_code=400, detail="session_id in path must match tally_session_id in body")
    
    # Verify weight classification exists
    wc = wc_crud.get_weight_classification(db, wc_id=allocation_detail.weight_classification_id)
    if wc is None:
        raise HTTPException(status_code=404, detail="Weight classification not found")
    
    try:
        return crud.create_allocation_detail(db=db, allocation_detail=allocation_detail)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/allocations/{allocation_id}", response_model=AllocationDetailsResponse)
def update_allocation_detail(
    allocation_id: int,
    allocation_detail: AllocationDetailsUpdate,
    db: Session = Depends(get_db)
):
    try:
        db_allocation = crud.update_allocation_detail(
            db, allocation_id=allocation_id, allocation_update=allocation_detail
        )
        if db_allocation is None:
            raise HTTPException(status_code=404, detail="Allocation detail not found")
        return db_allocation
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/allocations/{allocation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_allocation_detail(allocation_id: int, db: Session = Depends(get_db)):
    success = crud.delete_allocation_detail(db, allocation_id=allocation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Allocation detail not found")
    return None


@router.post("/tally-sessions/{session_id}/allocations/reset-tally", status_code=status.HTTP_200_OK)
def reset_tally_allocations(session_id: int, db: Session = Depends(get_db)):
    """Reset allocated_bags_tally to 0 for all allocations in a session and delete associated tally log entries."""
    # Verify session exists
    session = session_crud.get_tally_session(db, session_id=session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Tally session not found")
    
    result = crud.reset_allocated_bags_for_session(db, session_id, reset_tally=True, reset_dispatcher=False)
    return {
        "message": f"Reset tally allocations for {result['allocations_updated']} allocation(s) and deleted {result['log_entries_deleted']} log entry/entries",
        "allocations_updated": result["allocations_updated"],
        "log_entries_deleted": result["log_entries_deleted"]
    }


@router.post("/tally-sessions/{session_id}/allocations/reset-dispatcher", status_code=status.HTTP_200_OK)
def reset_dispatcher_allocations(session_id: int, db: Session = Depends(get_db)):
    """Reset allocated_bags_dispatcher to 0 for all allocations in a session and delete associated tally log entries."""
    # Verify session exists
    session = session_crud.get_tally_session(db, session_id=session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Tally session not found")
    
    result = crud.reset_allocated_bags_for_session(db, session_id, reset_tally=False, reset_dispatcher=True)
    return {
        "message": f"Reset dispatcher allocations for {result['allocations_updated']} allocation(s) and deleted {result['log_entries_deleted']} log entry/entries",
        "allocations_updated": result["allocations_updated"],
        "log_entries_deleted": result["log_entries_deleted"]
    }