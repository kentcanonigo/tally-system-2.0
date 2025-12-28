from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Tuple
from pydantic import BaseModel
from datetime import date, timedelta
import random

from ...database import get_db
from ...auth.dependencies import require_superadmin
from ...models import (
    User,
    TallyLogEntry,
    AllocationDetails,
    TallySession,
    WeightClassification,
    Customer,
    Plant,
    PlantPermission,
)
from ...models.tally_session import TallySessionStatus
from ...crud import (
    plant as plant_crud,
    weight_classification as weight_classification_crud,
    customer as customer_crud,
    tally_session as tally_session_crud,
    allocation_details as allocation_details_crud,
)
from ...schemas.plant import PlantCreate
from ...schemas.weight_classification import WeightClassificationCreate
from ...schemas.customer import CustomerCreate
from ...schemas.tally_session import TallySessionCreate
from ...schemas.allocation_details import AllocationDetailsCreate

router = APIRouter()


class ConsoleCommandRequest(BaseModel):
    command: str
    args: Dict[str, Any] = {}


class ConsoleCommandResponse(BaseModel):
    success: bool
    message: str
    data: Dict[str, Any] = {}


# Weight Classification Template Constants (from seed_test_data.py)
DRESSED_CLASSIFICATIONS = [
    {"classification": "OS", "min_weight": 18.0, "max_weight": None, "description": None},
    {"classification": "P4", "min_weight": 16.50, "max_weight": 17.99, "description": None},
    {"classification": "P3", "min_weight": 15.0, "max_weight": 16.49, "description": None},
    {"classification": "P2", "min_weight": 13.50, "max_weight": 14.99, "description": None},
    {"classification": "P1", "min_weight": 12.00, "max_weight": 13.49, "description": None},
    {"classification": "US", "min_weight": 10.50, "max_weight": 11.99, "description": None},
    {"classification": "SQ", "min_weight": None, "max_weight": 10.49, "description": None},
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


def seed_plant_with_classifications(db: Session, plant_name: str) -> Tuple[Plant, bool, int, int, int]:
    """Create a plant with standard weight classifications."""
    # Check if plant already exists
    all_plants = plant_crud.get_plants(db, skip=0, limit=1000)
    existing_plant = None
    for plant in all_plants:
        if plant.name == plant_name:
            existing_plant = plant
            break
    
    if existing_plant:
        plant = existing_plant
        created = False
    else:
        # Create the plant
        plant = plant_crud.create_plant(db, PlantCreate(name=plant_name))
        created = True
    
    # Get existing weight classifications
    existing_wcs = weight_classification_crud.get_weight_classifications_by_plant(db, plant.id)
    existing_classifications = {wc.classification for wc in existing_wcs}
    
    created_dressed = 0
    created_frozen = 0
    created_byproduct = 0
    
    # Create Dressed classifications
    for dc in DRESSED_CLASSIFICATIONS:
        if dc["classification"] not in existing_classifications:
            try:
                weight_classification_crud.create_weight_classification(
                    db,
                    WeightClassificationCreate(
                        plant_id=plant.id,
                        classification=dc["classification"],
                        min_weight=dc["min_weight"],
                        max_weight=dc["max_weight"],
                        description=dc["description"],
                        category="Dressed"
                    )
                )
                created_dressed += 1
            except Exception as e:
                raise ValueError(f"Failed to create Dressed classification {dc['classification']}: {str(e)}")
    
    # Create Frozen classifications (same as Dressed)
    # Check existing classifications by category to avoid duplicates
    existing_frozen = {wc.classification for wc in existing_wcs if wc.category == "Frozen"}
    for dc in DRESSED_CLASSIFICATIONS:
        if dc["classification"] not in existing_frozen:
            try:
                weight_classification_crud.create_weight_classification(
                    db,
                    WeightClassificationCreate(
                        plant_id=plant.id,
                        classification=dc["classification"],
                        min_weight=dc["min_weight"],
                        max_weight=dc["max_weight"],
                        description=dc["description"],
                        category="Frozen"
                    )
                )
                created_frozen += 1
            except Exception as e:
                # Skip if it fails (e.g., overlap), but don't raise
                pass
    
    # Create Byproduct classifications
    for bp in BYPRODUCT_CLASSIFICATIONS:
        if bp["classification"] not in existing_classifications:
            try:
                weight_classification_crud.create_weight_classification(
                    db,
                    WeightClassificationCreate(
                        plant_id=plant.id,
                        classification=bp["classification"],
                        description=bp["description"],
                        min_weight=None,
                        max_weight=None,
                        category="Byproduct"
                    )
                )
                created_byproduct += 1
            except Exception as e:
                raise ValueError(f"Failed to create Byproduct classification {bp['classification']}: {str(e)}")
    
    return plant, created, created_dressed, created_frozen, created_byproduct


def populate_test_sessions_for_plant(
    db: Session,
    plant_name: str,
    num_customers: int = 10,
    sessions_per_customer: int = 3
) -> Dict[str, Any]:
    """Create test customers, tally sessions, and allocations for a plant."""
    # Find the plant
    all_plants = plant_crud.get_plants(db, skip=0, limit=1000)
    plant = None
    for p in all_plants:
        if p.name == plant_name:
            plant = p
            break
    
    if not plant:
        raise ValueError(f"Plant '{plant_name}' not found. Please create it first using 'setup_plant {plant_name}'")
    
    # Get weight classifications for the plant
    weight_classifications = weight_classification_crud.get_weight_classifications_by_plant(db, plant.id)
    if not weight_classifications:
        raise ValueError(f"Plant '{plant_name}' has no weight classifications. Please set it up first using 'setup_plant {plant_name}'")
    
    # Separate classifications by category
    dressed_wcs = [wc for wc in weight_classifications if wc.category == "Dressed"]
    frozen_wcs = [wc for wc in weight_classifications if wc.category == "Frozen"]
    byproduct_wcs = [wc for wc in weight_classifications if wc.category == "Byproduct"]
    
    if not dressed_wcs and not frozen_wcs and not byproduct_wcs:
        raise ValueError(f"Plant '{plant_name}' has no valid weight classifications")
    
    # Generate customers
    customers = []
    existing_customers = customer_crud.get_customers(db, skip=0, limit=1000)
    existing_names = {c.name for c in existing_customers}
    
    for i in range(num_customers):
        # Generate unique customer name
        base_name = f"Test Customer {i + 1}"
        customer_name = base_name
        counter = 1
        while customer_name in existing_names:
            customer_name = f"{base_name} ({counter})"
            counter += 1
        
        existing_names.add(customer_name)
        
        try:
            customer = customer_crud.create_customer(db, CustomerCreate(name=customer_name))
            customers.append(customer)
        except Exception as e:
            raise ValueError(f"Failed to create customer '{customer_name}': {str(e)}")
    
    # Generate tally sessions
    sessions = []
    statuses = [TallySessionStatus.ONGOING, TallySessionStatus.COMPLETED, TallySessionStatus.CANCELLED]
    valid_bag_counts = [5, 10, 15, 20, 25]
    
    for customer in customers:
        for i in range(sessions_per_customer):
            # Random date within the past 30 days
            days_ago = random.randint(0, 30)
            session_date = date.today() - timedelta(days=days_ago)
            
            # Random status (weighted towards ongoing and completed)
            status = random.choices(statuses, weights=[40, 50, 10])[0]
            
            try:
                session = tally_session_crud.create_tally_session(
                    db,
                    TallySessionCreate(
                        customer_id=customer.id,
                        plant_id=plant.id,
                        date=session_date,
                        status=status
                    )
                )
                sessions.append(session)
            except Exception as e:
                raise ValueError(f"Failed to create tally session: {str(e)}")
    
    # Generate allocations
    allocations = []
    for session in sessions:
        selected_wcs = []
        
        # Select at least 3 Dressed classifications (or all if less than 3)
        if dressed_wcs:
            min_dressed = min(3, len(dressed_wcs))
            max_dressed = len(dressed_wcs)
            num_dressed = random.randint(min_dressed, max_dressed)
            selected_dressed = random.sample(dressed_wcs, num_dressed)
            selected_wcs.extend(selected_dressed)
        
        # Select at least 3 Frozen classifications (or all if less than 3)
        if frozen_wcs:
            min_frozen = min(3, len(frozen_wcs))
            max_frozen = len(frozen_wcs)
            num_frozen = random.randint(min_frozen, max_frozen)
            selected_frozen = random.sample(frozen_wcs, num_frozen)
            selected_wcs.extend(selected_frozen)
        
        # Select at least 3 Byproduct classifications (or all if less than 3)
        if byproduct_wcs:
            min_byproduct = min(3, len(byproduct_wcs))
            max_byproduct = len(byproduct_wcs)
            num_byproduct = random.randint(min_byproduct, max_byproduct)
            selected_byproduct = random.sample(byproduct_wcs, num_byproduct)
            selected_wcs.extend(selected_byproduct)
        
        # Create allocations for selected classifications
        for wc in selected_wcs:
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
            except Exception as e:
                # Allocation might already exist (unique constraint)
                if "already exists" not in str(e).lower():
                    raise ValueError(f"Failed to create allocation: {str(e)}")
    
    return {
        "customers_created": len(customers),
        "sessions_created": len(sessions),
        "allocations_created": len(allocations)
    }


@router.post("/console", response_model=ConsoleCommandResponse)
async def execute_console_command(
    request: ConsoleCommandRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """
    Execute console commands. Only accessible to superadmin users.
    
    Available commands:
    - delete_everything: Purges all data from the database (keeps users, roles, permissions)
    - setup_plant <plant_name>: Creates a plant with standard weight classifications
    - populate_test_sessions <plant_name>: Creates test customers, sessions, and allocations for a plant
    """
    command = request.command.strip()
    command_lower = command.lower()
    
    # Parse command with arguments
    parts = command.split()
    base_command = parts[0].lower() if parts else ""
    
    if command_lower == "delete_everything":
        try:
            # Delete all data tables in the correct order (respecting foreign keys)
            # We'll delete in reverse dependency order using ORM methods
            
            # 1. Delete tally log entries (depends on tally sessions and weight classifications)
            deleted_log_entries = db.query(TallyLogEntry).delete()
            
            # 2. Delete allocation details (depends on tally sessions and weight classifications)
            deleted_allocations = db.query(AllocationDetails).delete()
            
            # 3. Delete tally sessions (depends on customers and plants)
            # Cascade deletes will handle related allocation_details and tally_log_entries
            deleted_sessions = db.query(TallySession).delete()
            
            # 4. Delete weight classifications (depends on plants)
            deleted_weight_classes = db.query(WeightClassification).delete()
            
            # 5. Delete customers
            deleted_customers = db.query(Customer).delete()
            
            # 6. Delete plant permissions first (depends on plants and users)
            deleted_plant_permissions = db.query(PlantPermission).delete()
            
            # 7. Delete plants
            deleted_plants = db.query(Plant).delete()
            
            # Note: We keep users, roles, permissions, role_permissions, and user_roles
            # to preserve the authentication and authorization system
            
            db.commit()
            
            return ConsoleCommandResponse(
                success=True,
                message="Database purged successfully. All data has been deleted.",
                data={
                    "tables_purged": [
                        "tally_log_entries",
                        "allocation_details",
                        "tally_sessions",
                        "weight_classifications",
                        "customers",
                        "plant_permissions",
                        "plants"
                    ],
                    "tables_preserved": [
                        "users",
                        "roles",
                        "permissions",
                        "role_permissions",
                        "user_roles"
                    ],
                    "deleted_counts": {
                        "tally_log_entries": deleted_log_entries,
                        "allocation_details": deleted_allocations,
                        "tally_sessions": deleted_sessions,
                        "weight_classifications": deleted_weight_classes,
                        "customers": deleted_customers,
                        "plant_permissions": deleted_plant_permissions,
                        "plants": deleted_plants,
                    }
                }
            )
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error purging database: {str(e)}"
            )
    
    elif base_command == "setup_plant":
        if len(parts) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usage: setup_plant <plant_name>"
            )
        
        plant_name = " ".join(parts[1:])  # Allow plant names with spaces
        
        try:
            plant, created, created_dressed, created_frozen, created_byproduct = seed_plant_with_classifications(db, plant_name)
            
            message = f"Plant '{plant_name}' "
            if created:
                message += f"created with {created_dressed} Dressed, {created_frozen} Frozen, and {created_byproduct} Byproduct classifications."
            else:
                message += f"already exists. Added {created_dressed} Dressed, {created_frozen} Frozen, and {created_byproduct} Byproduct classifications."
            
            return ConsoleCommandResponse(
                success=True,
                message=message,
                data={
                    "plant_id": plant.id,
                    "plant_name": plant.name,
                    "plant_created": created,
                    "dressed_classifications_created": created_dressed,
                    "frozen_classifications_created": created_frozen,
                    "byproduct_classifications_created": created_byproduct
                }
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error setting up plant: {str(e)}"
            )
    
    elif base_command == "populate_test_sessions":
        if len(parts) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usage: populate_test_sessions <plant_name> [num_customers] [sessions_per_customer]"
            )
        
        # Parse optional arguments (check if last two parts are numbers)
        num_customers = 10
        sessions_per_customer = 3
        plant_name_start = 1
        plant_name_end = len(parts)
        
        # Check if last part is a number (sessions_per_customer)
        if len(parts) >= 3:
            try:
                sessions_per_customer = int(parts[-1])
                plant_name_end = len(parts) - 1
            except ValueError:
                pass  # Not a number, keep default
        
        # Check if second-to-last part is a number (num_customers)
        if plant_name_end < len(parts) and len(parts) >= 3:
            try:
                num_customers = int(parts[plant_name_end - 1])
                plant_name_end = plant_name_end - 1
            except ValueError:
                pass  # Not a number, keep default
        
        # Extract plant name (everything between command and optional args)
        if plant_name_end <= plant_name_start:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Plant name is required"
            )
        plant_name = " ".join(parts[plant_name_start:plant_name_end])
        
        try:
            result = populate_test_sessions_for_plant(
                db,
                plant_name,
                num_customers=num_customers,
                sessions_per_customer=sessions_per_customer
            )
            
            return ConsoleCommandResponse(
                success=True,
                message=f"Created {result['customers_created']} customers, {result['sessions_created']} sessions, and {result['allocations_created']} allocations for plant '{plant_name}'.",
                data=result
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error populating test sessions: {str(e)}"
            )
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown command: {base_command}. Available commands: delete_everything, setup_plant <plant_name>, populate_test_sessions <plant_name> [num_customers] [sessions_per_customer]"
        )

