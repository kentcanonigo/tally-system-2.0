from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from ..database import Base
from .utils import utcnow


class Plant(Base):
    __tablename__ = "plants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    weight_classifications = relationship("WeightClassification", back_populates="plant", cascade="all, delete-orphan")
    tally_sessions = relationship("TallySession", back_populates="plant", cascade="all, delete-orphan")

