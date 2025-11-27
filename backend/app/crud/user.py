from sqlalchemy.orm import Session
from typing import Optional, List
from ..models import User, UserRole, PlantPermission
from ..models.user_role import UserRole as UserRoleModel
from ..models.role import Role
from ..schemas.user import UserCreate, UserUpdate
from ..auth.password import hash_password, verify_password


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Get a user by their ID."""
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """Get a user by their username."""
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Get a user by their email."""
    return db.query(User).filter(User.email == email).first()


def get_all_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    """Get all users (for superadmin)."""
    return db.query(User).order_by(User.id).offset(skip).limit(limit).all()


def create_user(db: Session, user_data: UserCreate) -> User:
    """
    Create a new user with hashed password and plant permissions.
    
    Args:
        db: Database session
        user_data: User creation data including plant_ids
    
    Returns:
        Created user object
    """
    # Hash the password
    hashed_password = hash_password(user_data.password)
    
    # Create user object
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        role=user_data.role,
        is_active=True
    )
    
    db.add(db_user)
    db.flush()  # Flush to get the user ID
    
    # Create plant permissions
    for plant_id in user_data.plant_ids:
        permission = PlantPermission(
            user_id=db_user.id,
            plant_id=plant_id
        )
        db.add(permission)
    
    # Create role assignments
    if user_data.role_ids:
        for role_id in user_data.role_ids:
            user_role = UserRoleModel(
                user_id=db_user.id,
                role_id=role_id
            )
            db.add(user_role)
    
    db.commit()
    db.refresh(db_user)
    
    return db_user


def update_user(db: Session, user_id: int, user_data: UserUpdate) -> Optional[User]:
    """
    Update a user's information and plant permissions.
    
    Args:
        db: Database session
        user_id: ID of the user to update
        user_data: User update data
    
    Returns:
        Updated user object or None if not found
    """
    db_user = get_user_by_id(db, user_id)
    
    if not db_user:
        return None
    
    # Update basic fields
    update_data = user_data.model_dump(exclude_unset=True, exclude={'password', 'plant_ids', 'role_ids'})
    
    for field, value in update_data.items():
        setattr(db_user, field, value)
    
    # Update password if provided
    if user_data.password:
        db_user.hashed_password = hash_password(user_data.password)
    
    # Update plant permissions if provided
    if user_data.plant_ids is not None:
        # Remove existing permissions
        db.query(PlantPermission).filter(PlantPermission.user_id == user_id).delete()
        
        # Add new permissions
        for plant_id in user_data.plant_ids:
            permission = PlantPermission(
                user_id=user_id,
                plant_id=plant_id
            )
            db.add(permission)
    
    # Update role assignments if provided
    if user_data.role_ids is not None:
        # Remove existing role assignments
        db.query(UserRoleModel).filter(UserRoleModel.user_id == user_id).delete()
        
        # Add new role assignments
        for role_id in user_data.role_ids:
            user_role = UserRoleModel(
                user_id=user_id,
                role_id=role_id
            )
            db.add(user_role)
    
    db.commit()
    db.refresh(db_user)
    
    return db_user


def delete_user(db: Session, user_id: int) -> bool:
    """
    Delete a user (and their permissions via cascade).
    
    Args:
        db: Database session
        user_id: ID of the user to delete
    
    Returns:
        True if deleted, False if not found
    """
    db_user = get_user_by_id(db, user_id)
    
    if not db_user:
        return False
    
    db.delete(db_user)
    db.commit()
    
    return True


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    """
    Authenticate a user by username and password.
    
    Args:
        db: Database session
        username: Username to authenticate
        password: Plain text password to verify
    
    Returns:
        User object if authentication successful, None otherwise
    """
    user = get_user_by_username(db, username)
    
    if not user:
        return None
    
    if not verify_password(password, user.hashed_password):
        return None
    
    if not user.is_active:
        return None
    
    return user


def get_user_plant_ids(db: Session, user_id: int) -> List[int]:
    """
    Get list of plant IDs that a user has access to.
    
    Args:
        db: Database session
        user_id: ID of the user
    
    Returns:
        List of plant IDs
    """
    permissions = db.query(PlantPermission.plant_id).filter(
        PlantPermission.user_id == user_id
    ).all()
    
    return [perm.plant_id for perm in permissions]


def count_superadmins(db: Session) -> int:
    """
    Count the number of active superadmin users.
    
    Args:
        db: Database session
    
    Returns:
        Number of superadmin users
    """
    return db.query(User).filter(
        User.role == UserRole.SUPERADMIN,
        User.is_active == True
    ).count()


def get_user_role_ids(db: Session, user_id: int) -> List[int]:
    """
    Get list of role IDs assigned to a user.
    
    Args:
        db: Database session
        user_id: ID of the user
    
    Returns:
        List of role IDs
    """
    user_roles = db.query(UserRoleModel).filter(UserRoleModel.user_id == user_id).all()
    return [ur.role_id for ur in user_roles]


def get_user_permissions(db: Session, user_id: int) -> List[str]:
    """
    Get aggregated list of permission codes from all user's roles.
    
    Args:
        db: Database session
        user_id: ID of the user
    
    Returns:
        List of unique permission codes
    """
    # Get all roles assigned to the user
    user_roles = db.query(UserRoleModel).filter(UserRoleModel.user_id == user_id).all()
    role_ids = [ur.role_id for ur in user_roles]
    
    if not role_ids:
        return []
    
    # Get all permissions from these roles
    roles = db.query(Role).filter(Role.id.in_(role_ids)).all()
    
    # Aggregate unique permission codes
    permission_codes = set()
    for role in roles:
        for permission in role.permissions:
            permission_codes.add(permission.code)
    
    return list(permission_codes)

