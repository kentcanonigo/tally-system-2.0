from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from ..database import Base
from .utils import utcnow


class PlantPermission(Base):
    __tablename__ = "plant_permissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Relationships
    user = relationship("User", back_populates="plant_permissions")
    plant = relationship("Plant")

    # Ensure unique combination
    __table_args__ = (
        UniqueConstraint('user_id', 'plant_id', name='unique_user_plant'),
    )

