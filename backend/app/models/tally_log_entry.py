from sqlalchemy import Column, Integer, ForeignKey, Float, DateTime, String, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
import enum
from ..database import Base
from .utils import utcnow


class TallyLogEntryRole(str, enum.Enum):
    TALLY = "tally"
    DISPATCHER = "dispatcher"


class TallyLogEntry(Base):
    __tablename__ = "tally_log_entries"

    id = Column(Integer, primary_key=True, index=True)
    tally_session_id = Column(Integer, ForeignKey("tally_sessions.id"), nullable=False, index=True)
    weight_classification_id = Column(Integer, ForeignKey("weight_classifications.id"), nullable=False, index=True)
    role = Column(SQLEnum(TallyLogEntryRole), nullable=False, index=True)
    weight = Column(Float, nullable=False)
    heads = Column(Float, nullable=True, default=15.0)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)

    # Relationships
    tally_session = relationship("TallySession", back_populates="tally_log_entries")
    weight_classification = relationship("WeightClassification")

    # Indexes for common queries
    __table_args__ = (
        Index('idx_session_role', 'tally_session_id', 'role'),
        Index('idx_session_created', 'tally_session_id', 'created_at'),
        Index('idx_classification', 'weight_classification_id'),
    )

