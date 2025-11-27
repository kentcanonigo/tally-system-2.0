from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ...database import get_db
from ...schemas.plant import PlantCreate, PlantUpdate, PlantResponse
from ...crud import plant as crud
from ...auth.dependencies import get_current_user, get_user_accessible_plant_ids, require_superadmin, user_has_role
from ...models import User

router = APIRouter()


@router.get("/plants", response_model=List[PlantResponse])
def read_plants(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    accessible_plant_ids: List[int] = Depends(get_user_accessible_plant_ids)
):
    """Get plants. Superadmins see all, regular admins see only their assigned plants."""
    plants = crud.get_plants(db, skip=skip, limit=limit)
    
    # Filter by accessible plants for non-superadmins
    if not user_has_role(current_user, 'SUPERADMIN'):
        plants = [plant for plant in plants if plant.id in accessible_plant_ids]
    
    return plants


@router.get("/plants/{plant_id}", response_model=PlantResponse)
def read_plant(
    plant_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    accessible_plant_ids: List[int] = Depends(get_user_accessible_plant_ids)
):
    """Get a specific plant. User must have access to this plant."""
    plant = crud.get_plant(db, plant_id=plant_id)
    if plant is None:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    # Check access for non-superadmins
    if not user_has_role(current_user, 'SUPERADMIN') and plant_id not in accessible_plant_ids:
        raise HTTPException(status_code=403, detail="You don't have access to this plant")
    
    return plant


@router.post("/plants", response_model=PlantResponse, status_code=status.HTTP_201_CREATED)
def create_plant(
    plant: PlantCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """Create a new plant (superadmin only)."""
    return crud.create_plant(db=db, plant=plant)


@router.put("/plants/{plant_id}", response_model=PlantResponse)
def update_plant(
    plant_id: int, 
    plant: PlantUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """Update a plant (superadmin only)."""
    db_plant = crud.update_plant(db, plant_id=plant_id, plant_update=plant)
    if db_plant is None:
        raise HTTPException(status_code=404, detail="Plant not found")
    return db_plant


@router.delete("/plants/{plant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plant(
    plant_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """
    Delete a plant (superadmin only).
    
    Cannot delete if plant has:
    - Associated tally sessions
    - Associated weight classifications
    """
    try:
        success = crud.delete_plant(db, plant_id=plant_id)
        if not success:
            raise HTTPException(status_code=404, detail="Plant not found")
        return None
    except ValueError as e:
        # ValueError from CRUD indicates business rule violation (associated data)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=str(e)
        )

