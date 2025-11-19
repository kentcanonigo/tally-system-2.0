from sqlalchemy.orm import Session
from typing import List, Optional
from ..models.plant import Plant
from ..models.tally_session import TallySession
from ..models.weight_classification import WeightClassification
from ..schemas.plant import PlantCreate, PlantUpdate


def create_plant(db: Session, plant: PlantCreate) -> Plant:
    db_plant = Plant(**plant.model_dump())
    db.add(db_plant)
    db.commit()
    db.refresh(db_plant)
    return db_plant


def get_plant(db: Session, plant_id: int) -> Optional[Plant]:
    return db.query(Plant).filter(Plant.id == plant_id).first()


def get_plants(db: Session, skip: int = 0, limit: int = 100) -> List[Plant]:
    # SQL Server requires ORDER BY when using OFFSET/LIMIT
    return db.query(Plant).order_by(Plant.id).offset(skip).limit(limit).all()


def update_plant(db: Session, plant_id: int, plant_update: PlantUpdate) -> Optional[Plant]:
    db_plant = get_plant(db, plant_id)
    if not db_plant:
        return None
    
    update_data = plant_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_plant, field, value)
    
    db.commit()
    db.refresh(db_plant)
    return db_plant


def delete_plant(db: Session, plant_id: int) -> bool:
    db_plant = get_plant(db, plant_id)
    if not db_plant:
        return False
    
    # Check if there are any tally sessions associated with this plant
    associated_sessions = db.query(TallySession).filter(TallySession.plant_id == plant_id).count()
    if associated_sessions > 0:
        raise ValueError(f"Cannot delete plant: {associated_sessions} tally session(s) are associated with this plant. Please delete or reassign the sessions first.")
    
    # Check if there are any weight classifications associated with this plant
    associated_weight_classes = db.query(WeightClassification).filter(WeightClassification.plant_id == plant_id).count()
    if associated_weight_classes > 0:
        raise ValueError(f"Cannot delete plant: {associated_weight_classes} weight classification(s) are associated with this plant. Please delete the weight classifications first.")
    
    db.delete(db_plant)
    db.commit()
    return True

