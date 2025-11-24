from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, JSON
from sqlalchemy.orm import relationship
from ..database import Base
from .utils import utcnow
import enum


class UserRole(enum.Enum):
    SUPERADMIN = "superadmin"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=True)  # Nullable after RBAC migration
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    
    # User preferences
    timezone = Column(String(100), nullable=True, default='UTC')
    active_plant_id = Column(Integer, nullable=True)
    acceptable_difference_threshold = Column(Integer, nullable=False, default=0)
    visible_tabs = Column(JSON, nullable=True, default=None)  # JSON array of visible tab names

    # Relationships
    plant_permissions = relationship("PlantPermission", back_populates="user", cascade="all, delete-orphan")
    roles = relationship("Role", secondary="user_roles", back_populates="users")

