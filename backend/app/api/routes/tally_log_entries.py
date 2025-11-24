from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ...database import get_db
from ...schemas.tally_log_entry import TallyLogEntryCreate, TallyLogEntryResponse, TallyLogEntryRole
from ...crud import tally_log_entry as crud
from ...crud import tally_session as session_crud
from ...auth.dependencies import get_current_user, require_permission
from ...models import User

router = APIRouter()


@router.post(
    "/tally-sessions/{session_id}/log-entries",
    response_model=TallyLogEntryResponse,
    status_code=status.HTTP_201_CREATED
)
def create_tally_log_entry(
    session_id: int,
    log_entry: TallyLogEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_start_tally"))
):
    """
    Create a new tally log entry for a session. Requires 'can_start_tally' permission.
    This will also automatically increment the corresponding allocation detail.
    """
    # Verify session exists
    session = session_crud.get_tally_session(db, session_id=session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Tally session not found")
    
    # Ensure session_id matches
    if log_entry.tally_session_id != session_id:
        raise HTTPException(
            status_code=400,
            detail="session_id in path must match tally_session_id in body"
        )
    
    try:
        return crud.create_tally_log_entry(db=db, log_entry=log_entry)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/tally-sessions/{session_id}/log-entries",
    response_model=List[TallyLogEntryResponse]
)
def get_tally_log_entries_by_session(
    session_id: int,
    role: Optional[TallyLogEntryRole] = Query(None, description="Filter by role (tally or dispatcher)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_view_tally_logs"))
):
    """
    Get all tally log entries for a session, optionally filtered by role. Requires 'can_view_tally_logs' permission.
    Results are ordered by created_at descending (newest first).
    """
    # Verify session exists
    session = session_crud.get_tally_session(db, session_id=session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Tally session not found")
    
    entries = crud.get_tally_log_entries_by_session(db, session_id=session_id, role=role)
    return entries


@router.get(
    "/log-entries/{entry_id}",
    response_model=TallyLogEntryResponse
)
def get_tally_log_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_view_tally_logs"))
):
    """Get a single tally log entry by ID. Requires 'can_view_tally_logs' permission."""
    entry = crud.get_tally_log_entry(db, entry_id=entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Tally log entry not found")
    return entry


@router.delete(
    "/log-entries/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_tally_log_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_start_tally"))
):
    """Delete a tally log entry. Requires 'can_start_tally' permission."""
    entry = crud.delete_tally_log_entry(db, entry_id=entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Tally log entry not found")
    return None