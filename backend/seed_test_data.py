"""
Seed script to generate test data for development and testing.

⚠️  WARNING: This is a DEVELOPMENT/TESTING tool only and should NOT be used in production.

Usage:
    python -m backend.seed_test_data
    python -m backend.seed_test_data --customers 20 --sessions-per-customer 5

Or from the backend directory:
    python seed_test_data.py
"""
import sys
import argparse
import random
from pathlib import Path
from datetime import date, timedelta
from typing import List, Optional, Tuple

# Add parent directory to path to allow imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.config import settings
from app.models import Customer, Plant, WeightClassification, TallySession, AllocationDetails
from app.models.tally_session import TallySessionStatus
from app.crud import (
    customer as customer_crud,
    plant as plant_crud,
    weight_classification as weight_classification_crud,
    tally_session as tally_session_crud,
    allocation_details as allocation_details_crud,
)
from app.schemas.customer import CustomerCreate
from app.schemas.plant import PlantCreate
from app.schemas.weight_classification import WeightClassificationCreate
from app.schemas.tally_session import TallySessionCreate
from app.schemas.allocation_details import AllocationDetailsCreate
from faker import Faker


# Weight Classification Template Constants
DRESSED_CLASSIFICATIONS = [
    {"classification": "OS", "min_weight": 18.0, "max_weight": None, "description": None},
    {"classification": "P4", "min_weight": 16.50, "max_weight": 17.99, "description": None},
    {"classification": "P3", "min_weight": 15.0, "max_weight": 16.49, "description": None},
    {"classification": "P2", "min_weight": 13.50, "max_weight": 14.99, "description": None},
    {"classification": "P1", "min_weight": 12.00, "max_weight": 13.49, "description": None},
    {"classification": "US", "min_weight": 10.50, "max_weight": 11.99, "description": None},
    {"classification": "SQ", "min_weight": None, "max_weight": None, "description": None},
]

BYPRODUCT_CLASSIFICATIONS = [
    {"classification": "LV", "description": "Liver"},
    {"classification": "GZ", "description": "Gizzard"},
    {"classification": "SI", "description": "Small Intestine"},
    {"classification": "FT", "description": "Feet"},
    {"classification": "PV", "description": "Proven"},
    {"classification": "HD", "description": "Head"},
    {"classification": "BLD", "description": "Blood"},
]


def is_production_environment() -> bool:
    """Check if the current environment appears to be production."""
    db_url = settings.database_url.lower()
    # Detect Azure SQL Database (production indicator)
    if "database.windows.net" in db_url or "azuresql" in db_url:
        return True
    # SQLite is typically development
    if "sqlite" in db_url:
        return False
    # For other databases, be conservative and assume production
    # unless explicitly marked as development
    return True


def check_production_safety(force: bool = False, clear_existing: bool = False) -> None:
    """Check if running in production and enforce safety measures."""
    if is_production_environment():
        if not force:
            print("=" * 80)
            print("⚠️  PRODUCTION ENVIRONMENT DETECTED!")
            print("=" * 80)
            print("This script is for DEVELOPMENT/TESTING only.")
            print("If you really want to run this in production, use --force flag.")
            print("=" * 80)
            sys.exit(1)
        else:
            print("=" * 80)
            print("⚠️  WARNING: Running in PRODUCTION environment with --force flag!")
            print("⚠️  This script will create test data in your production database!")
            if clear_existing:
                print("⚠️  --clear-existing flag is DISABLED in production for safety!")
                print("⚠️  Existing data will NOT be deleted.")
            print("=" * 80)
            response = input("Type 'YES' to continue: ")
            if response != "YES":
                print("Aborted.")
                sys.exit(0)


def clear_existing_test_data(db: Session) -> dict:
    """
    Clear existing test data (customers and their associated sessions/allocations).
    This will cascade delete all tally sessions and allocation details for deleted customers.
    
    Returns a dictionary with counts of deleted items.
    """
    # Get all customers
    customers = customer_crud.get_customers(db, skip=0, limit=10000)
    customer_count = len(customers)
    
    if customer_count == 0:
        print("\nNo existing test data to clear.")
        return {
            "customers_deleted": 0,
            "sessions_deleted": 0,
            "allocations_deleted": 0
        }
    
    # Count sessions and allocations before deletion (for reporting)
    session_count = 0
    allocation_count = 0
    
    for customer in customers:
        # Count sessions for this customer
        sessions = db.query(TallySession).filter(TallySession.customer_id == customer.id).all()
        session_count += len(sessions)
        
        # Count allocations for these sessions
        for session in sessions:
            allocations = db.query(AllocationDetails).filter(
                AllocationDetails.tally_session_id == session.id
            ).all()
            allocation_count += len(allocations)
    
    # Delete all customers (cascade will handle sessions and allocations)
    print(f"\nClearing existing test data...")
    print(f"  Found {customer_count} customers, {session_count} sessions, {allocation_count} allocations")
    
    deleted_customers = 0
    for customer in customers:
        try:
            # Delete customer directly - SQLAlchemy cascade will handle sessions and allocations
            # We bypass the CRUD function which prevents deletion when sessions exist
            db.delete(customer)
            db.commit()
            deleted_customers += 1
            print(f"  ✓ Deleted customer: {customer.name}")
        except Exception as e:
            print(f"  ✗ Failed to delete customer {customer.name}: {str(e)}")
            db.rollback()
    
    print(f"\n✓ Cleared {deleted_customers} customers (and their associated sessions/allocations)")
    
    return {
        "customers_deleted": deleted_customers,
        "sessions_deleted": session_count,
        "allocations_deleted": allocation_count
    }


def ensure_test_plant_and_classifications(db: Session) -> Plant:
    """Ensure a test plant exists with standard weight classifications."""
    TEST_PLANT_NAME = "Test Plant"
    
    # Check if test plant already exists
    all_plants = plant_crud.get_plants(db, skip=0, limit=100)
    test_plant = None
    
    for plant in all_plants:
        if plant.name == TEST_PLANT_NAME:
            test_plant = plant
            break
    
    if not test_plant:
        print(f"Creating test plant: {TEST_PLANT_NAME}...")
        test_plant = plant_crud.create_plant(db, PlantCreate(name=TEST_PLANT_NAME))
        print(f"✓ Created test plant: {test_plant.name}")
    else:
        print(f"✓ Found existing test plant: {test_plant.name}")
    
    # Ensure the test plant has the standard weight classifications
    existing_wcs = weight_classification_crud.get_weight_classifications_by_plant(db, test_plant.id)
    existing_classifications = {wc.classification for wc in existing_wcs}
    
    # Create Dressed classifications
    for dc in DRESSED_CLASSIFICATIONS:
        if dc["classification"] not in existing_classifications:
            try:
                wc = weight_classification_crud.create_weight_classification(
                    db,
                    WeightClassificationCreate(
                        plant_id=test_plant.id,
                        classification=dc["classification"],
                        min_weight=dc["min_weight"],
                        max_weight=dc["max_weight"],
                        description=dc["description"],
                        category="Dressed"
                    )
                )
                print(f"  ✓ Created Dressed classification: {wc.classification} for {test_plant.name}")
            except Exception as e:
                print(f"  ⚠️  Could not create {dc['classification']}: {str(e)}")
    
    # Create Byproduct classifications
    for bp in BYPRODUCT_CLASSIFICATIONS:
        if bp["classification"] not in existing_classifications:
            try:
                wc = weight_classification_crud.create_weight_classification(
                    db,
                    WeightClassificationCreate(
                        plant_id=test_plant.id,
                        classification=bp["classification"],
                        description=bp["description"],
                        min_weight=None,
                        max_weight=None,
                        category="Byproduct"
                    )
                )
                print(f"  ✓ Created Byproduct classification: {wc.classification} ({wc.description}) for {test_plant.name}")
            except Exception as e:
                print(f"  ⚠️  Could not create {bp['classification']}: {str(e)}")
    
    return test_plant


def generate_customers(db: Session, count: int, fake: Faker) -> List[Customer]:
    """Generate test customers using Faker."""
    customers = []
    existing_customers = customer_crud.get_customers(db, skip=0, limit=1000)
    existing_names = {c.name for c in existing_customers}
    
    print(f"\nGenerating {count} customers...")
    for i in range(count):
        # Generate unique customer name
        max_attempts = 100
        for attempt in range(max_attempts):
            name = fake.company()
            if name not in existing_names:
                break
        else:
            # Fallback if we can't generate unique name
            name = f"{fake.company()} {fake.random_int(min=1000, max=9999)}"
        
        existing_names.add(name)
        
        try:
            customer = customer_crud.create_customer(db, CustomerCreate(name=name))
            customers.append(customer)
            print(f"  ✓ Created customer: {customer.name}")
        except Exception as e:
            print(f"  ⚠️  Could not create customer: {str(e)}")
    
    return customers


def generate_tally_sessions(
    db: Session,
    customers: List[Customer],
    test_plant: Plant,
    sessions_per_customer: int,
    fake: Faker
) -> List[TallySession]:
    """Generate tally sessions for customers using the test plant."""
    sessions = []
    statuses = [TallySessionStatus.ONGOING, TallySessionStatus.COMPLETED, TallySessionStatus.CANCELLED]
    
    print(f"\nGenerating tally sessions ({sessions_per_customer} per customer) for {test_plant.name}...")
    for customer in customers:
        for i in range(sessions_per_customer):
            # Random date within the past 30 days
            days_ago = random.randint(0, 30)
            session_date = date.today() - timedelta(days=days_ago)
            
            # Random status (weighted towards ongoing and completed)
            status = random.choices(
                statuses,
                weights=[40, 50, 10]  # 40% ongoing, 50% completed, 10% cancelled
            )[0]
            
            try:
                session = tally_session_crud.create_tally_session(
                    db,
                    TallySessionCreate(
                        customer_id=customer.id,
                        plant_id=test_plant.id,
                        date=session_date,
                        status=status
                    )
                )
                sessions.append(session)
                print(f"  ✓ Created session #{session.session_number} for {customer.name} on {session_date} ({status.value})")
            except Exception as e:
                print(f"  ⚠️  Could not create session: {str(e)}")
    
    return sessions


def generate_allocations(
    db: Session,
    sessions: List[TallySession],
    fake: Faker
) -> List[AllocationDetails]:
    """Generate allocation details for tally sessions."""
    allocations = []
    
    # Valid bag counts in increments of 5: 5, 10, 15, 20, 25
    valid_bag_counts = [5, 10, 15, 20, 25]
    
    print(f"\nGenerating allocation details (minimum 3 Dressed + 3 Byproduct per session)...")
    for session in sessions:
        # Get weight classifications for this session's plant
        weight_classifications = weight_classification_crud.get_weight_classifications_by_plant(db, session.plant_id)
        
        if not weight_classifications:
            print(f"  ⚠️  No weight classifications found for plant {session.plant_id}, skipping session {session.id}")
            continue
        
        # Separate classifications by category
        dressed_wcs = [wc for wc in weight_classifications if wc.category == "Dressed"]
        byproduct_wcs = [wc for wc in weight_classifications if wc.category == "Byproduct"]
        
        selected_wcs = []
        
        # Select at least 3 Dressed classifications (or all if less than 3 available)
        if dressed_wcs:
            min_dressed = min(3, len(dressed_wcs))
            max_dressed = len(dressed_wcs)
            num_dressed = random.randint(min_dressed, max_dressed)
            selected_dressed = random.sample(dressed_wcs, num_dressed)
            selected_wcs.extend(selected_dressed)
        
        # Select at least 3 Byproduct classifications (or all if less than 3 available)
        if byproduct_wcs:
            min_byproduct = min(3, len(byproduct_wcs))
            max_byproduct = len(byproduct_wcs)
            num_byproduct = random.randint(min_byproduct, max_byproduct)
            selected_byproduct = random.sample(byproduct_wcs, num_byproduct)
            selected_wcs.extend(selected_byproduct)
        
        # Create allocations for all selected classifications
        for wc in selected_wcs:
            # Random bag count from valid increments: 5, 10, 15, 20, 25
            required_bags = random.choice(valid_bag_counts)
            
            try:
                allocation = allocation_details_crud.create_allocation_detail(
                    db,
                    AllocationDetailsCreate(
                        tally_session_id=session.id,
                        weight_classification_id=wc.id,
                        required_bags=float(required_bags),
                        allocated_bags_tally=0.0,
                        allocated_bags_dispatcher=0.0,
                        heads=0.0
                    )
                )
                allocations.append(allocation)
                print(f"  ✓ Created allocation: {wc.classification} ({wc.category}) - {required_bags} bags required")
            except Exception as e:
                # Allocation might already exist (unique constraint)
                if "already exists" in str(e).lower():
                    print(f"  ⚠️  Allocation already exists for session {session.id} and {wc.classification}")
                else:
                    print(f"  ⚠️  Could not create allocation: {str(e)}")
    
    return allocations


def main():
    """Main function to run the seed script."""
    parser = argparse.ArgumentParser(
        description="Generate test data for development and testing. ⚠️  DEVELOPMENT/TESTING tool only!"
    )
    parser.add_argument(
        "--customers",
        type=int,
        default=10,
        help="Number of customers to create (default: 10)"
    )
    parser.add_argument(
        "--sessions-per-customer",
        type=int,
        default=3,
        help="Number of tally sessions per customer (default: 3)"
    )
    parser.add_argument(
        "--allocations-per-session",
        type=int,
        default=2,
        help="Number of allocations per session (default: 2)"
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Random seed for reproducible data generation"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force execution in production environments (requires confirmation)"
    )
    parser.add_argument(
        "--clear-existing",
        action="store_true",
        help="Clear existing test data (customers, sessions, allocations) before generating new data. Disabled in production."
    )
    
    args = parser.parse_args()
    
    print("\n" + "=" * 80)
    print("🌱 Tally System - Test Data Seed Script")
    print("=" * 80)
    print("⚠️  WARNING: This is a DEVELOPMENT/TESTING tool only!")
    print("=" * 80 + "\n")
    
    # Check production safety (disable clear-existing in production)
    is_prod = is_production_environment()
    if is_prod and args.clear_existing:
        print("=" * 80)
        print("⚠️  WARNING: --clear-existing is DISABLED in production environments!")
        print("⚠️  Existing data will NOT be deleted for safety.")
        print("=" * 80 + "\n")
        args.clear_existing = False
    
    check_production_safety(force=args.force, clear_existing=args.clear_existing)
    
    # Set random seed if provided
    if args.seed is not None:
        random.seed(args.seed)
        print(f"Using random seed: {args.seed}\n")
    
    try:
        # Create tables if they don't exist
        print("Ensuring database tables exist...")
        Base.metadata.create_all(bind=engine)
        print("✓ Database tables ready\n")
        
        # Create database session
        db = SessionLocal()
        fake = Faker()
        
        if args.seed is not None:
            Faker.seed(args.seed)
        
        try:
            # Clear existing test data if requested
            if args.clear_existing:
                clear_existing_test_data(db)
                print()
            
            # Ensure test plant and weight classifications exist
            print("Ensuring test plant and weight classifications exist...")
            test_plant = ensure_test_plant_and_classifications(db)
            print()
            
            # Generate customers
            customers = generate_customers(db, args.customers, fake)
            print(f"\n✓ Generated {len(customers)} customers")
            
            # Generate tally sessions (all using the test plant)
            sessions = generate_tally_sessions(db, customers, test_plant, args.sessions_per_customer, fake)
            print(f"\n✓ Generated {len(sessions)} tally sessions")
            
            # Generate allocations
            allocations = generate_allocations(db, sessions, fake)
            print(f"\n✓ Generated {len(allocations)} allocation details")
            
            # Summary
            print("\n" + "=" * 80)
            print("✓ Test data generation completed successfully!")
            print("=" * 80)
            print(f"Summary:")
            print(f"  - Customers: {len(customers)}")
            print(f"  - Tally Sessions: {len(sessions)}")
            print(f"  - Allocation Details: {len(allocations)}")
            print("=" * 80 + "\n")
            
        finally:
            db.close()
        
    except Exception as e:
        print(f"\n✗ Error running seed script: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

