from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ...database import get_db
from ...schemas.tally_log_entry import TallyLogEntryCreate, TallyLogEntryUpdate, TallyLogEntryResponse, TallyLogEntryRole, TallyLogEntryTransfer
from ...schemas.tally_log_entry_audit import TallyLogEntryAuditResponse
from ...crud import tally_log_entry as crud
from ...crud import tally_session as session_crud
from ...crud import tally_log_entry_audit as audit_crud
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
    current_user: User = Depends(require_permission("can_tally"))
):
    """
    Create a new tally log entry for a session. Requires 'can_tally' permission.
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
    Get all tally log entries for a session, optionally filtered by role.
    Requires 'can_view_tally_logs' permission for viewing historical/detailed data.
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
    """
    Get a single tally log entry by ID.
    Requires 'can_view_tally_logs' permission.
    """
    entry = crud.get_tally_log_entry(db, entry_id=entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Tally log entry not found")
    return entry


@router.put(
    "/log-entries/{entry_id}",
    response_model=TallyLogEntryResponse
)
def update_tally_log_entry(
    entry_id: int,
    entry_update: TallyLogEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_tally"))
):
    """
    Update a tally log entry. Requires 'can_tally' permission.
    Updates the corresponding allocation details based on changes.
    """
    try:
        entry = crud.update_tally_log_entry(db, entry_id=entry_id, entry_update=entry_update, user_id=current_user.id)
        if entry is None:
            raise HTTPException(status_code=404, detail="Tally log entry not found")
        return entry
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/log-entries/{entry_id}/audit",
    response_model=List[TallyLogEntryAuditResponse]
)
def get_tally_log_entry_audit(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_view_tally_logs"))
):
    """
    Get audit history for a tally log entry.
    Requires 'can_view_tally_logs' permission.
    Returns list of audit entries ordered by edited_at descending (newest first).
    """
    # Verify entry exists
    entry = crud.get_tally_log_entry(db, entry_id=entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Tally log entry not found")
    
    audit_entries = audit_crud.get_audit_entries_by_entry_id(db, entry_id=entry_id)
    
    # Convert to response models with user information
    result = []
    for audit_entry in audit_entries:
        audit_dict = {
            "id": audit_entry.id,
            "tally_log_entry_id": audit_entry.tally_log_entry_id,
            "user_id": audit_entry.user_id,
            "edited_at": audit_entry.edited_at,
            "changes": audit_entry.changes,
            "user_username": audit_entry.user.username if audit_entry.user else None
        }
        result.append(TallyLogEntryAuditResponse(**audit_dict))
    
    return result


@router.delete(
    "/log-entries/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_tally_log_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_tally"))
):
    """Delete a tally log entry. Requires 'can_tally' permission."""
    entry = crud.delete_tally_log_entry(db, entry_id=entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Tally log entry not found")
    return None


@router.post(
    "/log-entries/transfer",
    status_code=status.HTTP_200_OK
)
def transfer_tally_log_entries(
    transfer_request: TallyLogEntryTransfer,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("can_tally"))
):
    """
    Transfer tally log entries from their current sessions to a target session.
    Requires 'can_tally' permission.
    Updates AllocationDetails for both source and target sessions atomically.
    """
    try:
        count = crud.transfer_tally_log_entries(
            db=db,
            entry_ids=transfer_request.entry_ids,
            target_session_id=transfer_request.target_session_id
        )
        return {"message": f"Successfully transferred {count} log entries", "count": count}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))