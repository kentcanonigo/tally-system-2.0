from sqlalchemy import Column, Integer, ForeignKey, Date, String, DateTime, Index, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..database import Base


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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    customer = relationship("Customer", back_populates="tally_sessions")
    plant = relationship("Plant", back_populates="tally_sessions")
    allocation_details = relationship("AllocationDetails", back_populates="tally_session", cascade="all, delete-orphan")
    tally_log_entries = relationship("TallyLogEntry", back_populates="tally_session", cascade="all, delete-orphan")

    # Indexes for common queries
    __table_args__ = (
        Index('idx_customer_plant_date', 'customer_id', 'plant_id', 'date'),
        Index('idx_status_date', 'status', 'date'),
    )

