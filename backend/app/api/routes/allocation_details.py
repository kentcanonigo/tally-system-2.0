from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ...database import get_db
from ...schemas.allocation_details import (
    AllocationDetailsCreate, 
    AllocationDetailsUpdate, 
    AllocationDetailsResponse,
    AllocationDetailsMinimalResponse
)
from ...crud import allocation_details as crud
from ...crud import tally_session as session_crud
from ...crud import weight_classification as wc_crud
from ...auth.dependencies import get_current_user, require_any_permission, require_permission, user_has_role
from ...models import User
from ...crud import user as user_crud
from typing import Union

router = APIRouter()


@router.get("/tally-sessions/{session_id}/allocations")
def read_allocation_details_by_session(
    session_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["can_tally", "can_view_tally_logs"]))
):
    """
    Get allocation details for a tally session.
    
    Permissions:
    - 'can_tally': Returns minimal data (requirements only, no progress)
    - 'can_view_tally_logs': Returns full data (includes progress/completion)
    
    Response varies based on user permissions.
    """
    # Verify session exists
    session = session_crud.get_tally_session(db, session_id=session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Tally session not found")
    
    allocations = crud.get_allocation_details_by_session(db, session_id=session_id)
    
    # Check if user has view_logs permission (shows full data)
    user_permissions = user_crud.get_user_permissions(db, current_user.id)
    has_view_logs = 'can_view_tally_logs' in user_permissions or user_has_role(current_user, 'SUPERADMIN')
    
    if has_view_logs:
        # Return full allocation details with progress
        return [AllocationDetailsResponse.model_validate(alloc) for alloc in allocations]
    else:
        # Return minimal details (requirements only, no progress)
        return [AllocationDetailsMinimalResponse.model_validate(alloc) for alloc in allocations]


@router.get("/allocations/{allocation_id}")
def read_allocation_detail(
    allocation_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(["can_tally", "can_view_tally_logs"]))
):
    """
    Get a specific allocation detail.
    
    Permissions:
    - 'can_tally': Returns minimal data (requirements only, no progress)
    - 'can_view_tally_logs': Returns full data (includes progress/completion)
    
    Response varies based on user permissions.
    """
    allocation = crud.get_allocation_detail(db, allocation_id=allocation_id)
    if allocation is None:
        raise HTTPException(status_code=404, detail="Allocation detail not found")
    
    # Check if user has view_logs permission (shows full data)
    user_permissions = user_crud.get_user_permissions(db, current_user.id)
    has_view_logs = 'can_view_tally_logs' in user_permissions or user_has_role(current_user, 'SUPERADMIN')
    
    if has_view_logs:
        # Return full allocation details with progress
        return AllocationDetailsResponse.model_validate(allocation)
    else:
        # Return minimal details (requirements only, no progress)
        return AllocationDetailsMinimalResponse.model_validate(allocation)


@router.post("/tally-sessions/{session_id}/allocations", response_model=AllocationDetailsResponse, status_code=status.HTTP_201_CREATED)
def create_allocation_detail(
    session_id: int,
    allocation_detail: AllocationDetailsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_edit_tally_allocations"))
):
    """Create allocation detail. Requires 'can_edit_tally_allocations' permission."""
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
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_edit_tally_allocations"))
):
    """Update allocation detail. Requires 'can_edit_tally_allocations' permission."""
    # Verify weight classification exists if it's being updated
    if allocation_detail.weight_classification_id is not None:
        wc = wc_crud.get_weight_classification(db, wc_id=allocation_detail.weight_classification_id)
        if wc is None:
            raise HTTPException(status_code=404, detail="Weight classification not found")
    
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
def delete_allocation_detail(
    allocation_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_delete_tally_allocations"))
):
    """Delete allocation detail. Requires 'can_delete_tally_allocations' permission."""
    success = crud.delete_allocation_detail(db, allocation_id=allocation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Allocation detail not found")
    return None


@router.post("/tally-sessions/{session_id}/allocations/reset-tally", status_code=status.HTTP_200_OK)
def reset_tally_allocations(
    session_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_delete_tally_allocations"))
):
    """
    Delete all TALLY role log entries for a session and recalculate allocated_bags_tally.
    Requires 'can_delete_tally_allocations' permission.
    """
    # Verify session exists
    session = session_crud.get_tally_session(db, session_id=session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Tally session not found")
    
    result = crud.reset_allocated_bags_for_session(db, session_id, reset_tally=True, reset_dispatcher=False)
    return {
        "message": f"Deleted {result['log_entries_deleted']} tally log entry/entries and recalculated allocations for {result['allocations_updated']} allocation(s)",
        "allocations_updated": result["allocations_updated"],
        "log_entries_deleted": result["log_entries_deleted"]
    }


@router.post("/tally-sessions/{session_id}/allocations/reset-dispatcher", status_code=status.HTTP_200_OK)
def reset_dispatcher_allocations(
    session_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_delete_tally_allocations"))
):
    """
    Delete all DISPATCHER role log entries for a session and recalculate allocated_bags_dispatcher.
    Requires 'can_delete_tally_allocations' permission.
    """
    # Verify session exists
    session = session_crud.get_tally_session(db, session_id=session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Tally session not found")
    
    result = crud.reset_allocated_bags_for_session(db, session_id, reset_tally=False, reset_dispatcher=True)
    return {
        "message": f"Deleted {result['log_entries_deleted']} dispatcher log entry/entries and recalculated allocations for {result['allocations_updated']} allocation(s)",
        "allocations_updated": result["allocations_updated"],
        "log_entries_deleted": result["log_entries_deleted"]
    }