from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date
from ..models.tally_session import TallySession
from ..schemas.tally_session import TallySessionCreate, TallySessionUpdate


def create_tally_session(db: Session, tally_session: TallySessionCreate) -> TallySession:
    # Generate the next session number for this customer
    # Use a subquery to get the max session_number for this customer, or 0 if none exists
    max_session_number = db.query(func.coalesce(func.max(TallySession.session_number), 0)).filter(
        TallySession.customer_id == tally_session.customer_id
    ).scalar()
    
    next_session_number = max_session_number + 1
    
    # Create the session with the generated session_number
    session_data = tally_session.model_dump()
    session_data['session_number'] = next_session_number
    
    db_session = TallySession(**session_data)
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


def get_tally_session(db: Session, session_id: int) -> Optional[TallySession]:
    return db.query(TallySession).filter(TallySession.id == session_id).first()


def get_tally_sessions(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    customer_id: Optional[int] = None,
    plant_id: Optional[int] = None,
    status: Optional[str] = None,
    date: Optional[date] = None
) -> List[TallySession]:
    query = db.query(TallySession)
    
    if customer_id:
        query = query.filter(TallySession.customer_id == customer_id)
    if plant_id:
        query = query.filter(TallySession.plant_id == plant_id)
    if status:
        query = query.filter(TallySession.status == status)
    if date:
        query = query.filter(TallySession.date == date)
    
    return query.order_by(TallySession.date.desc()).offset(skip).limit(limit).all()


def update_tally_session(db: Session, session_id: int, session_update: TallySessionUpdate) -> Optional[TallySession]:
    db_session = get_tally_session(db, session_id)
    if not db_session:
        return None
    
    update_data = session_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_session, field, value)
    
    db.commit()
    db.refresh(db_session)
    return db_session


def delete_tally_session(db: Session, session_id: int) -> bool:
    db_session = get_tally_session(db, session_id)
    if not db_session:
        return False
    
    db.delete(db_session)
    db.commit()
    return True


def get_tally_session_dates(
    db: Session,
    customer_id: Optional[int] = None,
    plant_id: Optional[int] = None,
    status: Optional[str] = None,
    accessible_plant_ids: Optional[List[int]] = None
) -> List[date]:
    """Get distinct dates that have tally sessions, optionally filtered by customer, plant, or status.
    If accessible_plant_ids is provided, only returns dates for sessions in those plants."""
    query = db.query(TallySession.date).distinct()
    
    if customer_id:
        query = query.filter(TallySession.customer_id == customer_id)
    if plant_id:
        query = query.filter(TallySession.plant_id == plant_id)
    if status:
        query = query.filter(TallySession.status == status)
    if accessible_plant_ids is not None:
        query = query.filter(TallySession.plant_id.in_(accessible_plant_ids))
    
    # Order by date descending (most recent first)
    results = query.order_by(TallySession.date.desc()).all()
    # Extract date values from the result tuples
    return [result[0] for result in results]

