from sqlalchemy import Column, Integer, ForeignKey, DateTime, JSON, Index
from sqlalchemy.orm import relationship
from ..database import Base
from .utils import utcnow


class TallyLogEntryAudit(Base):
    __tablename__ = "tally_log_entry_audit"

    id = Column(Integer, primary_key=True, index=True)
    tally_log_entry_id = Column(Integer, ForeignKey("tally_log_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    edited_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    changes = Column(JSON, nullable=False)  # Stores field changes as JSON: {"field_name": {"old": value, "new": value}}

    # Relationships
    tally_log_entry = relationship("TallyLogEntry", back_populates="audit_entries")
    user = relationship("User")

    # Indexes for common queries
    __table_args__ = (
        Index('idx_entry_edited_at', 'tally_log_entry_id', 'edited_at'),
    )

