from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from ...database import get_db
from ...schemas.permission import PermissionResponse
from ...crud import permission as permission_crud
from ...auth.dependencies import get_current_user
from ...models import User

router = APIRouter()


@router.get("", response_model=List[PermissionResponse])
async def list_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all available permissions (authenticated users can view).
    Permissions are grouped by category in the response.
    """
    permissions = permission_crud.get_all_permissions(db)
    return permissions

