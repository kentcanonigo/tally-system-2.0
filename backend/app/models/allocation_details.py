from sqlalchemy import Column, Integer, ForeignKey, Float, DateTime, Index
from sqlalchemy.orm import relationship
from ..database import Base
from .utils import utcnow


class AllocationDetails(Base):
    __tablename__ = "allocation_details"

    id = Column(Integer, primary_key=True, index=True)
    tally_session_id = Column(Integer, ForeignKey("tally_sessions.id"), nullable=False, index=True)
    weight_classification_id = Column(Integer, ForeignKey("weight_classifications.id"), nullable=False, index=True)
    required_bags = Column(Float, nullable=False, default=0.0)
    allocated_bags_tally = Column(Float, nullable=False, default=0.0)
    allocated_bags_dispatcher = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    tally_session = relationship("TallySession", back_populates="allocation_details")
    weight_classification = relationship("WeightClassification", back_populates="allocation_details")

    # Index for common queries
    __table_args__ = (
        Index('idx_session_classification', 'tally_session_id', 'weight_classification_id', unique=True),
    )

