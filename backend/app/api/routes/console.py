from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any
from pydantic import BaseModel

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

router = APIRouter()


class ConsoleCommandRequest(BaseModel):
    command: str
    args: Dict[str, Any] = {}


class ConsoleCommandResponse(BaseModel):
    success: bool
    message: str
    data: Dict[str, Any] = {}


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
    """
    command = request.command.strip().lower()
    
    if command == "delete_everything":
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
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown command: {command}"
        )

