from sqlalchemy.orm import Session
from typing import List, Optional
from ..models.tally_session import TallySession
from ..schemas.tally_session import TallySessionCreate, TallySessionUpdate


def create_tally_session(db: Session, tally_session: TallySessionCreate) -> TallySession:
    db_session = TallySession(**tally_session.model_dump())
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
    status: Optional[str] = None
) -> List[TallySession]:
    query = db.query(TallySession)
    
    if customer_id:
        query = query.filter(TallySession.customer_id == customer_id)
    if plant_id:
        query = query.filter(TallySession.plant_id == plant_id)
    if status:
        query = query.filter(TallySession.status == status)
    
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

