from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from ...database import get_db
from ...schemas.tally_session import TallySessionCreate, TallySessionUpdate, TallySessionResponse, TallySessionStatus
from ...crud import tally_session as crud
from ...crud import customer as customer_crud
from ...crud import plant as plant_crud
from ...auth.dependencies import get_current_user, get_user_accessible_plant_ids, require_permission, require_any_permission, user_has_role
from ...crud import user as user_crud
from ...models import User

router = APIRouter()


@router.get("/tally-sessions", response_model=List[TallySessionResponse])
def read_tally_sessions(
    skip: int = 0,
    limit: int = 100,
    customer_id: Optional[int] = Query(None),
    plant_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    accessible_plant_ids: List[int] = Depends(get_user_accessible_plant_ids)
):
    """Get tally sessions. Users only see sessions for plants they have access to."""
    tally_sessions = crud.get_tally_sessions(
        db, skip=skip, limit=limit, customer_id=customer_id, plant_id=plant_id, status=status, date=date
    )
    
    # Filter by accessible plants for non-superadmins
    if not user_has_role(current_user, 'SUPERADMIN'):
        tally_sessions = [s for s in tally_sessions if s.plant_id in accessible_plant_ids]
    
    return tally_sessions


@router.get("/tally-sessions/dates", response_model=List[str])
def read_tally_session_dates(
    customer_id: Optional[int] = Query(None),
    plant_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    accessible_plant_ids: List[int] = Depends(get_user_accessible_plant_ids)
):
    """Get distinct dates that have tally sessions. Users only see dates for sessions in plants they have access to.
    Returns a list of ISO date strings (YYYY-MM-DD format)."""
    # Determine which plant IDs to filter by
    plant_ids_to_filter = None
    if not user_has_role(current_user, 'SUPERADMIN'):
        plant_ids_to_filter = accessible_plant_ids
    
    # Get distinct dates
    dates = crud.get_tally_session_dates(
        db,
        customer_id=customer_id,
        plant_id=plant_id,
        status=status,
        accessible_plant_ids=plant_ids_to_filter
    )
    
    # Convert date objects to ISO format strings (YYYY-MM-DD)
    return [date_obj.isoformat() for date_obj in dates]


@router.get("/tally-sessions/{session_id}", response_model=TallySessionResponse)
def read_tally_session(
    session_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    accessible_plant_ids: List[int] = Depends(get_user_accessible_plant_ids)
):
    """Get a specific tally session. User must have access to its plant."""
    session = crud.get_tally_session(db, session_id=session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Tally session not found")
    
    # Check plant access
    if not user_has_role(current_user, 'SUPERADMIN') and session.plant_id not in accessible_plant_ids:
        raise HTTPException(status_code=403, detail="You don't have access to this plant")
    
    return session


@router.post("/tally-sessions", response_model=TallySessionResponse, status_code=status.HTTP_201_CREATED)
def create_tally_session(
    tally_session: TallySessionCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_create_tally_sessions")),
    accessible_plant_ids: List[int] = Depends(get_user_accessible_plant_ids)
):
    """Create a tally session. Requires 'can_create_tally_sessions' permission and plant access."""
    # Check plant access
    if not user_has_role(current_user, 'SUPERADMIN') and tally_session.plant_id not in accessible_plant_ids:
        raise HTTPException(status_code=403, detail="You don't have access to this plant")
    
    # Verify customer exists
    customer = customer_crud.get_customer(db, customer_id=tally_session.customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Verify plant exists
    plant = plant_crud.get_plant(db, plant_id=tally_session.plant_id)
    if plant is None:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    return crud.create_tally_session(db=db, tally_session=tally_session)


@router.put("/tally-sessions/{session_id}", response_model=TallySessionResponse)
def update_tally_session(
    session_id: int,
    tally_session: TallySessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    accessible_plant_ids: List[int] = Depends(get_user_accessible_plant_ids)
):
    """Update a tally session. User must have access to the plant and appropriate permissions."""
    # Get existing session to check plant
    existing_session = crud.get_tally_session(db, session_id=session_id)
    if existing_session is None:
        raise HTTPException(status_code=404, detail="Tally session not found")
    
    # Check plant access
    if not user_has_role(current_user, 'SUPERADMIN') and existing_session.plant_id not in accessible_plant_ids:
        raise HTTPException(status_code=403, detail="You don't have access to this plant")
    
    # Check permissions based on what's being updated
    user_permissions = user_crud.get_user_permissions(db, current_user.id)
    
    # If updating status, check specific permissions
    if tally_session.status is not None:
        if tally_session.status == TallySessionStatus.COMPLETED:
            if not user_has_role(current_user, 'SUPERADMIN') and 'can_complete_tally' not in user_permissions:
                raise HTTPException(status_code=403, detail="Permission 'can_complete_tally' required to complete sessions")
        elif tally_session.status == TallySessionStatus.CANCELLED:
            if not user_has_role(current_user, 'SUPERADMIN') and 'can_cancel_tally' not in user_permissions:
                raise HTTPException(status_code=403, detail="Permission 'can_cancel_tally' required to cancel sessions")
    
    # If updating other fields (customer_id, plant_id, date), check edit permission
    if tally_session.customer_id is not None or tally_session.plant_id is not None or tally_session.date is not None:
        if not user_has_role(current_user, 'SUPERADMIN') and 'can_edit_tally_session' not in user_permissions:
            raise HTTPException(status_code=403, detail="Permission 'can_edit_tally_session' required to edit session details")
    
    # Verify customer exists if updating customer_id
    if tally_session.customer_id is not None:
        customer = customer_crud.get_customer(db, customer_id=tally_session.customer_id)
        if customer is None:
            raise HTTPException(status_code=404, detail="Customer not found")
    
    # Verify plant exists if updating plant_id
    if tally_session.plant_id is not None:
        plant = plant_crud.get_plant(db, plant_id=tally_session.plant_id)
        if plant is None:
            raise HTTPException(status_code=404, detail="Plant not found")
        
        # If changing plant, check access to new plant too
        if not user_has_role(current_user, 'SUPERADMIN') and tally_session.plant_id not in accessible_plant_ids:
            raise HTTPException(status_code=403, detail="You don't have access to the new plant")
    
    db_session = crud.update_tally_session(db, session_id=session_id, session_update=tally_session)
    if db_session is None:
        raise HTTPException(status_code=404, detail="Tally session not found")
    return db_session


@router.delete("/tally-sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tally_session(
    session_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_delete_tally_session")),
    accessible_plant_ids: List[int] = Depends(get_user_accessible_plant_ids)
):
    """Delete a tally session. Requires 'can_delete_tally_session' permission and plant access."""
    # Get existing session to check plant
    existing_session = crud.get_tally_session(db, session_id=session_id)
    if existing_session is None:
        raise HTTPException(status_code=404, detail="Tally session not found")
    
    # Check plant access
    if not user_has_role(current_user, 'SUPERADMIN') and existing_session.plant_id not in accessible_plant_ids:
        raise HTTPException(status_code=403, detail="You don't have access to this plant")
    
    success = crud.delete_tally_session(db, session_id=session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Tally session not found")
    return None

