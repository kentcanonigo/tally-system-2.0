from sqlalchemy.orm import Session
from typing import List, Optional
from ..models.customer import Customer
from ..models.tally_session import TallySession
from ..schemas.customer import CustomerCreate, CustomerUpdate


def create_customer(db: Session, customer: CustomerCreate) -> Customer:
    db_customer = Customer(**customer.model_dump())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer


def get_customer(db: Session, customer_id: int) -> Optional[Customer]:
    return db.query(Customer).filter(Customer.id == customer_id).first()


def get_customers(db: Session, skip: int = 0, limit: int = 100) -> List[Customer]:
    # SQL Server requires ORDER BY when using OFFSET/LIMIT
    return db.query(Customer).order_by(Customer.id).offset(skip).limit(limit).all()


def update_customer(db: Session, customer_id: int, customer_update: CustomerUpdate) -> Optional[Customer]:
    db_customer = get_customer(db, customer_id)
    if not db_customer:
        return None
    
    update_data = customer_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_customer, field, value)
    
    db.commit()
    db.refresh(db_customer)
    return db_customer


def delete_customer(db: Session, customer_id: int) -> bool:
    db_customer = get_customer(db, customer_id)
    if not db_customer:
        return False
    
    # Check if there are any tally sessions associated with this customer
    associated_sessions = db.query(TallySession).filter(TallySession.customer_id == customer_id).count()
    if associated_sessions > 0:
        raise ValueError(f"Cannot delete customer: {associated_sessions} tally session(s) are associated with this customer. Please delete or reassign the sessions first.")
    
    db.delete(db_customer)
    db.commit()
    return True

