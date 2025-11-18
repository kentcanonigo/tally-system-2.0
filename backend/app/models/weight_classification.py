from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Index
from sqlalchemy.orm import relationship
from ..database import Base
from .utils import utcnow


class WeightClassification(Base):
    __tablename__ = "weight_classifications"

    id = Column(Integer, primary_key=True, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False, index=True)
    classification = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)  # Optional description, required for Byproduct category
    min_weight = Column(Float, nullable=True)  # Nullable for catch-all classifications
    max_weight = Column(Float, nullable=True)  # Nullable for "up" ranges and catch-all
    category = Column(String(100), nullable=False)  # Must be "Dressed" or "Byproduct" (enforced by CHECK constraint)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    plant = relationship("Plant", back_populates="weight_classifications")
    allocation_details = relationship("AllocationDetails", back_populates="weight_classification", cascade="all, delete-orphan")

    # Index for common queries
    __table_args__ = (
        Index('idx_plant_category', 'plant_id', 'category'),
    )

