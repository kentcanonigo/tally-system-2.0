from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Dict, Any, Optional


class ChangeDetail(BaseModel):
    """Schema for individual field changes."""
    old: Any
    new: Any


class TallyLogEntryAuditResponse(BaseModel):
    """Response schema for audit trail entries."""
    id: int
    tally_log_entry_id: int
    user_id: int
    edited_at: datetime
    changes: Dict[str, ChangeDetail]  # Field name -> {old: value, new: value}
    user_username: Optional[str] = None  # Populated via relationship

    model_config = ConfigDict(from_attributes=True)

