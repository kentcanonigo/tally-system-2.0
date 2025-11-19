from sqlalchemy.orm import Session
from typing import List, Optional
from ..models.weight_classification import WeightClassification
from ..schemas.weight_classification import WeightClassificationCreate, WeightClassificationUpdate


def _ranges_overlap(
    min1: Optional[float], max1: Optional[float],
    min2: Optional[float], max2: Optional[float]
) -> bool:
    """
    Check if two weight ranges overlap.
    - Catch-all (both None): overlaps with everything
    - "Up" range (min set, max None): >= min_weight
    - "Down" range (min None, max set): <= max_weight
    - Regular range (both set): min_weight <= weight <= max_weight
    """
    # Catch-all overlaps with everything
    if (min1 is None and max1 is None) or (min2 is None and max2 is None):
        return True
    
    # Convert None to appropriate infinity/negative infinity for comparison
    min1_val = float('-inf') if min1 is None else min1
    max1_val = float('inf') if max1 is None else max1
    min2_val = float('-inf') if min2 is None else min2
    max2_val = float('inf') if max2 is None else max2
    
    # Ranges overlap if: min1 <= max2 AND min2 <= max1
    return min1_val <= max2_val and min2_val <= max1_val


def _check_byproduct_duplicates(
    db: Session,
    plant_id: int,
    classification: str,
    description: Optional[str],
    exclude_id: Optional[int] = None
) -> None:
    """
    Check if a byproduct with the same classification name or description already exists
    for the same plant. Byproducts cannot have duplicates.
    """
    existing = db.query(WeightClassification).filter(
        WeightClassification.plant_id == plant_id,
        WeightClassification.category == 'Byproduct'
    ).all()
    
    for existing_wc in existing:
        if exclude_id and existing_wc.id == exclude_id:
            continue
        
        # Check for duplicate classification name
        if existing_wc.classification.lower() == classification.lower():
            raise ValueError(
                f'A byproduct with classification "{existing_wc.classification}" already exists for this plant. '
                f'Byproducts cannot have duplicate classification names.'
            )
        
        # Check for duplicate description (if description is provided)
        if description and existing_wc.description:
            if existing_wc.description.lower().strip() == description.lower().strip():
                raise ValueError(
                    f'A byproduct with description "{existing_wc.description}" already exists for this plant. '
                    f'Byproducts cannot have duplicate descriptions.'
                )


def _check_overlaps(
    db: Session,
    plant_id: int,
    category: str,
    min_weight: Optional[float],
    max_weight: Optional[float],
    exclude_id: Optional[int] = None
) -> None:
    """
    Check if the given weight range overlaps with any existing classification
    for the same plant and category. Only applies to Dressed category.
    """
    # Skip weight range checking for byproducts
    if category == 'Byproduct':
        return
    
    existing = db.query(WeightClassification).filter(
        WeightClassification.plant_id == plant_id,
        WeightClassification.category == category
    ).all()
    
    for existing_wc in existing:
        if exclude_id and existing_wc.id == exclude_id:
            continue
        
        if _ranges_overlap(
            min_weight, max_weight,
            existing_wc.min_weight, existing_wc.max_weight
        ):
            existing_range = "catch-all (All Sizes)" if (
                existing_wc.min_weight is None and existing_wc.max_weight is None
            ) else (
                f"{existing_wc.min_weight} and up" if existing_wc.max_weight is None
                else f"{existing_wc.min_weight}-{existing_wc.max_weight}"
            )
            raise ValueError(
                f'Weight range overlaps with existing classification "{existing_wc.classification}" '
                f'({existing_range}) for the same plant and category'
            )


def create_weight_classification(db: Session, weight_classification: WeightClassificationCreate) -> WeightClassification:
    # For byproducts, check for duplicate classification names or descriptions
    if weight_classification.category == 'Byproduct':
        _check_byproduct_duplicates(
            db,
            weight_classification.plant_id,
            weight_classification.classification,
            weight_classification.description
        )
    else:
        # For Dressed category, check for weight range overlaps
        _check_overlaps(
            db,
            weight_classification.plant_id,
            weight_classification.category,
            weight_classification.min_weight,
            weight_classification.max_weight
        )
    
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
    
    # Determine the final values after update
    final_min_weight = update_data.get('min_weight', db_wc.min_weight)
    final_max_weight = update_data.get('max_weight', db_wc.max_weight)
    final_category = update_data.get('category', db_wc.category)
    final_classification = update_data.get('classification', db_wc.classification)
    final_description = update_data.get('description', db_wc.description)
    
    # For byproducts, check for duplicate classification names or descriptions
    if final_category == 'Byproduct':
        # Check if classification or description is being changed
        if 'classification' in update_data or 'description' in update_data or 'category' in update_data:
            _check_byproduct_duplicates(
                db,
                db_wc.plant_id,
                final_classification,
                final_description,
                exclude_id=wc_id
            )
    else:
        # For Dressed category, check for weight range overlaps if weight or category is being changed
        if 'min_weight' in update_data or 'max_weight' in update_data or 'category' in update_data:
            _check_overlaps(
                db,
                db_wc.plant_id,
                final_category,
                final_min_weight,
                final_max_weight,
                exclude_id=wc_id
            )
    
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

