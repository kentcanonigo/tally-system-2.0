from sqlalchemy.orm import Session
from typing import List, Optional
from ..models.weight_classification import WeightClassification
from ..schemas.weight_classification import WeightClassificationCreate, WeightClassificationUpdate


def create_weight_classification(db: Session, weight_classification: WeightClassificationCreate) -> WeightClassification:
    db_wc = WeightClassification(**weight_classification.model_dump())
    db.add(db_wc)
    db.commit()
    db.refresh(db_wc)
    return db_wc


def get_weight_classification(db: Session, wc_id: int) -> Optional[WeightClassification]:
    return db.query(WeightClassification).filter(WeightClassification.id == wc_id).first()


def get_weight_classifications_by_plant(db: Session, plant_id: int, skip: int = 0, limit: int = 100) -> List[WeightClassification]:
    # SQL Server requires ORDER BY when using OFFSET/LIMIT
    return db.query(WeightClassification).filter(
        WeightClassification.plant_id == plant_id
    ).order_by(WeightClassification.id).offset(skip).limit(limit).all()


def update_weight_classification(db: Session, wc_id: int, wc_update: WeightClassificationUpdate) -> Optional[WeightClassification]:
    db_wc = get_weight_classification(db, wc_id)
    if not db_wc:
        return None
    
    update_data = wc_update.model_dump(exclude_unset=True)
    
    # Validate min/max weight if both are being updated
    if 'min_weight' in update_data and 'max_weight' in update_data:
        if update_data['max_weight'] < update_data['min_weight']:
            raise ValueError('max_weight must be greater than or equal to min_weight')
    elif 'min_weight' in update_data and update_data['min_weight'] > db_wc.max_weight:
        raise ValueError('min_weight cannot be greater than existing max_weight')
    elif 'max_weight' in update_data and update_data['max_weight'] < db_wc.min_weight:
        raise ValueError('max_weight cannot be less than existing min_weight')
    
    for field, value in update_data.items():
        setattr(db_wc, field, value)
    
    db.commit()
    db.refresh(db_wc)
    return db_wc


def delete_weight_classification(db: Session, wc_id: int) -> bool:
    db_wc = get_weight_classification(db, wc_id)
    if not db_wc:
        return False
    
    db.delete(db_wc)
    db.commit()
    return True

