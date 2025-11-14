from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ...database import get_db
from ...schemas.weight_classification import WeightClassificationCreate, WeightClassificationUpdate, WeightClassificationResponse
from ...crud import weight_classification as crud
from ...crud import plant as plant_crud

router = APIRouter()


@router.get("/plants/{plant_id}/weight-classifications", response_model=List[WeightClassificationResponse])
def read_weight_classifications_by_plant(
    plant_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    # Verify plant exists
    plant = plant_crud.get_plant(db, plant_id=plant_id)
    if plant is None:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    weight_classifications = crud.get_weight_classifications_by_plant(
        db, plant_id=plant_id, skip=skip, limit=limit
    )
    return weight_classifications


@router.get("/weight-classifications/{wc_id}", response_model=WeightClassificationResponse)
def read_weight_classification(wc_id: int, db: Session = Depends(get_db)):
    wc = crud.get_weight_classification(db, wc_id=wc_id)
    if wc is None:
        raise HTTPException(status_code=404, detail="Weight classification not found")
    return wc


@router.post("/plants/{plant_id}/weight-classifications", response_model=WeightClassificationResponse, status_code=status.HTTP_201_CREATED)
def create_weight_classification(
    plant_id: int,
    weight_classification: WeightClassificationCreate,
    db: Session = Depends(get_db)
):
    # Verify plant exists
    plant = plant_crud.get_plant(db, plant_id=plant_id)
    if plant is None:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    # Ensure plant_id matches
    if weight_classification.plant_id != plant_id:
        raise HTTPException(status_code=400, detail="plant_id in path must match plant_id in body")
    
    try:
        return crud.create_weight_classification(db=db, weight_classification=weight_classification)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/weight-classifications/{wc_id}", response_model=WeightClassificationResponse)
def update_weight_classification(
    wc_id: int,
    weight_classification: WeightClassificationUpdate,
    db: Session = Depends(get_db)
):
    try:
        db_wc = crud.update_weight_classification(db, wc_id=wc_id, wc_update=weight_classification)
        if db_wc is None:
            raise HTTPException(status_code=404, detail="Weight classification not found")
        return db_wc
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/weight-classifications/{wc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_weight_classification(wc_id: int, db: Session = Depends(get_db)):
    success = crud.delete_weight_classification(db, wc_id=wc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Weight classification not found")
    return None

