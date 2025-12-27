from sqlalchemy.orm import Session
from typing import List
from ..models.tally_log_entry_audit import TallyLogEntryAudit
from ..schemas.tally_log_entry_audit import TallyLogEntryAuditResponse


def create_audit_entry(
    db: Session,
    entry_id: int,
    user_id: int,
    changes: dict
) -> TallyLogEntryAudit:
    """
    Create an audit entry for a tally log entry edit.
    
    Args:
        db: Database session
        entry_id: ID of the tally log entry that was edited
        user_id: ID of the user who made the edit
        changes: Dictionary of field changes in format {"field_name": {"old": value, "new": value}}
    
    Returns:
        Created audit entry
    """
    audit_entry = TallyLogEntryAudit(
        tally_log_entry_id=entry_id,
        user_id=user_id,
        changes=changes
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    return audit_entry


def get_audit_entries_by_entry_id(
    db: Session,
    entry_id: int
) -> List[TallyLogEntryAudit]:
    """
    Retrieve all audit entries for a specific tally log entry.
    Results are ordered by edited_at descending (newest first).
    
    Args:
        db: Database session
        entry_id: ID of the tally log entry
    
    Returns:
        List of audit entries
    """
    return db.query(TallyLogEntryAudit).filter(
        TallyLogEntryAudit.tally_log_entry_id == entry_id
    ).order_by(TallyLogEntryAudit.edited_at.desc()).all()

