from sqlalchemy import Column, Integer, ForeignKey, Date, String, DateTime, Index, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum
from ..database import Base
from .utils import utcnow


class TallySessionStatus(str, enum.Enum):
    ONGOING = "ongoing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TallySession(Base):
    __tablename__ = "tally_sessions"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    status = Column(SQLEnum(TallySessionStatus), nullable=False, default=TallySessionStatus.ONGOING, index=True)
    session_number = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="tally_sessions")
    plant = relationship("Plant", back_populates="tally_sessions")
    allocation_details = relationship("AllocationDetails", back_populates="tally_session", cascade="all, delete-orphan")
    tally_log_entries = relationship("TallyLogEntry", back_populates="tally_session", cascade="all, delete-orphan")

    # Indexes for common queries
    __table_args__ = (
        Index('idx_customer_plant_date', 'customer_id', 'plant_id', 'date'),
        Index('idx_status_date', 'status', 'date'),
        Index('idx_customer_session_number', 'customer_id', 'session_number'),
    )

