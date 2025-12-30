from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import date
from ..models.tally_log_entry import TallyLogEntryRole

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
    grand_total_fr: float

class ExportRequest(BaseModel):
    session_ids: List[int] = []
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    customer_id: Optional[int] = None
    plant_id: Optional[int] = None
    role: Optional[TallyLogEntryRole] = TallyLogEntryRole.TALLY  # Default to TALLY for backward compatibility

# Tally Sheet Export Schemas
class TallySheetEntry(BaseModel):
    """Individual entry in the tally sheet grid"""
    row: int  # Row number (1-20)
    column: int  # Column index (0-based)
    weight: float  # Weight in kilograms
    classification: str  # Weight classification code (e.g., "OS", "P4", "US")
    classification_id: int  # Weight classification ID

class TallySheetColumnHeader(BaseModel):
    """Column header information"""
    classification: str  # Classification code
    classification_id: int  # Classification ID
    index: int  # Column index (0-based)

class TallySheetSummary(BaseModel):
    """Summary data for a classification"""
    classification: str
    classification_id: int
    bags: float
    heads: float
    kilograms: float

class TallySheetPage(BaseModel):
    """Data for a single page of the tally sheet"""
    page_number: int
    total_pages: int
    columns: List[TallySheetColumnHeader]  # Column headers for this page
    entries: List[TallySheetEntry]  # All entries on this page
    grid: List[List[Optional[float]]]  # 20xN grid, None for empty cells
    summary_dressed: List[TallySheetSummary]  # Dressed category summaries
    summary_frozen: List[TallySheetSummary]  # Frozen category summaries
    summary_byproduct: List[TallySheetSummary]  # Byproduct category summaries
    total_dressed_bags: float
    total_dressed_heads: float
    total_dressed_kilograms: float
    total_frozen_bags: float
    total_frozen_heads: float
    total_frozen_kilograms: float
    total_byproduct_bags: float
    total_byproduct_heads: float
    total_byproduct_kilograms: float
    is_byproduct: bool  # True if this page contains byproduct entries (shows heads instead of weights)
    product_type: str  # Product type for this page: "Dressed Chicken", "Frozen Chicken", "Byproduct", or "Mixed"

class TallySheetRequest(BaseModel):
    """Request model for tally sheet export"""
    session_ids: List[int]
    role: Optional[TallyLogEntryRole] = TallyLogEntryRole.TALLY  # Default to TALLY for backward compatibility

class TallySheetResponse(BaseModel):
    """Response model for tally sheet export (single customer)"""
    customer_name: str
    product_type: str  # "Dressed Chicken" or similar
    date: date
    pages: List[TallySheetPage]
    grand_total_bags: float
    grand_total_heads: float
    grand_total_kilograms: float

class TallySheetMultiCustomerResponse(BaseModel):
    """Response model for tally sheet export (multiple customers)"""
    customers: List[TallySheetResponse]  # One response per customer

