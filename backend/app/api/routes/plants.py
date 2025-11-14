from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ...database import get_db
from ...schemas.plant import PlantCreate, PlantUpdate, PlantResponse
from ...crud import plant as crud

router = APIRouter()


@router.get("/plants", response_model=List[PlantResponse])
def read_plants(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    plants = crud.get_plants(db, skip=skip, limit=limit)
    return plants


@router.get("/plants/{plant_id}", response_model=PlantResponse)
def read_plant(plant_id: int, db: Session = Depends(get_db)):
    plant = crud.get_plant(db, plant_id=plant_id)
    if plant is None:
        raise HTTPException(status_code=404, detail="Plant not found")
    return plant


@router.post("/plants", response_model=PlantResponse, status_code=status.HTTP_201_CREATED)
def create_plant(plant: PlantCreate, db: Session = Depends(get_db)):
    return crud.create_plant(db=db, plant=plant)


@router.put("/plants/{plant_id}", response_model=PlantResponse)
def update_plant(plant_id: int, plant: PlantUpdate, db: Session = Depends(get_db)):
    db_plant = crud.update_plant(db, plant_id=plant_id, plant_update=plant)
    if db_plant is None:
        raise HTTPException(status_code=404, detail="Plant not found")
    return db_plant


@router.delete("/plants/{plant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plant(plant_id: int, db: Session = Depends(get_db)):
    success = crud.delete_plant(db, plant_id=plant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Plant not found")
    return None

