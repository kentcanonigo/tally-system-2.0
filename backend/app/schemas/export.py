from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class ExportItem(BaseModel):
    category: str
    classification: str
    bags: float

class CustomerExportData(BaseModel):
    customer_name: str
    items: List[ExportItem]
    subtotal: float

class ExportResponse(BaseModel):
    customers: List[CustomerExportData]
    grand_total_dc: float
    grand_total_bp: float

class ExportRequest(BaseModel):
    session_ids: List[int] = []
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    customer_id: Optional[int] = None
    plant_id: Optional[int] = None

