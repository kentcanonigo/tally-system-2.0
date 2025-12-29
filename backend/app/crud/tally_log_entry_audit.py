from sqlalchemy.orm import Session, joinedload
from typing import List
from ..models.tally_log_entry_audit import TallyLogEntryAudit
from ..models.tally_log_entry import TallyLogEntry
from ..models.tally_session import TallySession
from ..models.customer import Customer
from ..models.plant import Plant
from ..models.weight_classification import WeightClassification
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


def get_all_audit_entries(
    db: Session,
    limit: int = 100
) -> List[TallyLogEntryAudit]:
    """
    Retrieve all audit entries, ordered by edited_at descending (newest first).
    Useful for admin dashboard to see latest editing activity.
    Includes related data via joins: entry, session, customer, plant, weight classification.
    
    Args:
        db: Database session
        limit: Maximum number of entries to return (default: 100)
    
    Returns:
        List of audit entries with loaded relationships
    """
    return db.query(TallyLogEntryAudit)\
        .options(
            joinedload(TallyLogEntryAudit.tally_log_entry)
            .joinedload(TallyLogEntry.tally_session)
            .joinedload(TallySession.customer),
            joinedload(TallyLogEntryAudit.tally_log_entry)
            .joinedload(TallyLogEntry.tally_session)
            .joinedload(TallySession.plant),
            joinedload(TallyLogEntryAudit.tally_log_entry)
            .joinedload(TallyLogEntry.weight_classification),
            joinedload(TallyLogEntryAudit.user)
        )\
        .order_by(TallyLogEntryAudit.edited_at.desc())\
        .limit(limit)\
        .all()
