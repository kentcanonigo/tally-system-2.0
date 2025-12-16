from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from ...database import get_db
from ...models.allocation_details import AllocationDetails
from ...models.tally_session import TallySession
from ...models.customer import Customer
from ...models.weight_classification import WeightClassification
from ...models.plant import Plant
from ...models.tally_log_entry import TallyLogEntry, TallyLogEntryRole
from ...schemas.export import (
    ExportRequest, ExportResponse, CustomerExportData, ExportItem,
    TallySheetRequest, TallySheetResponse, TallySheetMultiCustomerResponse,
    TallySheetPage, TallySheetEntry, TallySheetColumnHeader, TallySheetSummary
)

# Fallback default heads per bag (used only if weight classification's default_heads is not available)
FALLBACK_DEFAULT_HEADS = 15.0

router = APIRouter()

@router.post("/sessions", response_model=ExportResponse)
def export_sessions_data(
    request: ExportRequest,
    db: Session = Depends(get_db)
):
    query = db.query(
        Customer.name.label("customer_name"),
        WeightClassification.category,
        WeightClassification.classification,
        func.sum(AllocationDetails.allocated_bags_tally).label("total_bags")
    ).select_from(AllocationDetails)\
    .join(TallySession, AllocationDetails.tally_session_id == TallySession.id)\
    .join(Customer, TallySession.customer_id == Customer.id)\
    .join(WeightClassification, AllocationDetails.weight_classification_id == WeightClassification.id)

    # Apply filters
    if request.session_ids:
        query = query.filter(TallySession.id.in_(request.session_ids))
    else:
        if request.date_from:
            query = query.filter(TallySession.date >= request.date_from)
        if request.date_to:
            query = query.filter(TallySession.date <= request.date_to)
        if request.customer_id:
            query = query.filter(TallySession.customer_id == request.customer_id)
        if request.plant_id:
            query = query.filter(TallySession.plant_id == request.plant_id)

    # Filter out 0 bags
    query = query.filter(AllocationDetails.allocated_bags_tally > 0)

    # Group by
    query = query.group_by(
        Customer.name,
        WeightClassification.category,
        WeightClassification.classification
    )

    # Order by Customer Name, Category, Classification
    query = query.order_by(
        Customer.name,
        WeightClassification.category.desc(), # Dressed (DC) usually comes before Byproduct (BP) or maybe standard alphabetical? 
        # Actually Dressed starts with D, Byproduct starts with B.
        # The image shows DC then BP.
        # Let's sort by category DESC (Dressed > Byproduct) or specific mapping.
        # If we want DC first, D > B.
        WeightClassification.classification
    )

    results = query.all()

    # Process results
    customers_map: Dict[str, CustomerExportData] = {}
    grand_total_dc = 0.0
    grand_total_bp = 0.0

    for row in results:
        customer_name = row.customer_name
        category_raw = row.category
        classification = row.classification
        bags = row.total_bags

        # Map category
        category_code = "DC" if category_raw == "Dressed" else "BP" if category_raw == "Byproduct" else category_raw

        if customer_name not in customers_map:
            customers_map[customer_name] = CustomerExportData(
                customer_name=customer_name,
                items=[],
                subtotal=0.0
            )

        customers_map[customer_name].items.append(ExportItem(
            category=category_code,
            classification=classification,
            bags=bags
        ))
        customers_map[customer_name].subtotal += bags

        if category_code == "DC":
            grand_total_dc += bags
        elif category_code == "BP":
            grand_total_bp += bags

    # Convert map to list
    response_customers = list(customers_map.values())

    return ExportResponse(
        customers=response_customers,
        grand_total_dc=grand_total_dc,
        grand_total_bp=grand_total_bp
    )


def process_sessions_for_customer(
    customer_sessions: List[TallySession],
    db: Session
) -> TallySheetResponse:
    """
    Process tally sheet data for sessions belonging to a single customer.
    Returns paginated data organized in a 20-row grid format.
    Separates Dressed and Byproduct entries into separate tables.
    """
    if not customer_sessions:
        raise ValueError("No sessions provided")
    
    session_ids = [s.id for s in customer_sessions]
    customer = db.query(Customer).filter(Customer.id == customer_sessions[0].customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get all tally log entries for these sessions (only TALLY role)
    entries = db.query(TallyLogEntry).join(WeightClassification).filter(
        TallyLogEntry.tally_session_id.in_(session_ids),
        TallyLogEntry.role == TallyLogEntryRole.TALLY
    ).order_by(TallyLogEntry.created_at.asc()).all()
    
    if not entries:
        raise HTTPException(status_code=404, detail="No tally entries found for the specified sessions")
    
    # Get weight classifications map
    wc_ids = {entry.weight_classification_id for entry in entries}
    weight_classifications = {
        wc.id: wc for wc in db.query(WeightClassification).filter(
            WeightClassification.id.in_(wc_ids)
        ).all()
    }
    
    # Group entries by classification
    entries_by_classification: Dict[Tuple[int, str], List[TallyLogEntry]] = defaultdict(list)
    for entry in entries:
        wc = weight_classifications[entry.weight_classification_id]
        key = (entry.weight_classification_id, wc.classification)
        entries_by_classification[key].append(entry)
    
    # Define classification order (Dressed first, then Byproduct)
    # Standard order: OS, P4, P3, P2, P1, US, SQ for Dressed
    # LV, GZ, SI, FT, PV, HD, BLD for Byproduct
    dressed_order = ["OS", "P4", "P3", "P2", "P1", "US", "SQ"]
    byproduct_order = ["LV", "GZ", "SI", "FT", "PV", "HD", "BLD"]
    
    def get_classification_sort_key(key: Tuple[int, str]) -> Tuple[int, int]:
        """Return sort key: (category_order, classification_order)"""
        wc_id, classification = key
        wc = weight_classifications[wc_id]
        category_order = 0 if wc.category == "Dressed" else 1
        if wc.category == "Dressed":
            try:
                class_order = dressed_order.index(classification)
            except ValueError:
                class_order = 999
        else:
            try:
                class_order = byproduct_order.index(classification)
            except ValueError:
                class_order = 999
        return (category_order, class_order)
    
    # Sort classifications
    sorted_classifications = sorted(entries_by_classification.keys(), key=get_classification_sort_key)
    
    # Separate entries by category (Dressed vs Byproduct), keeping them grouped by classification
    dressed_entries_by_classification: Dict[Tuple[int, str], List[Tuple[TallyLogEntry, int, str]]] = {}
    byproduct_entries_by_classification: Dict[Tuple[int, str], List[Tuple[TallyLogEntry, int, str]]] = {}
    
    for wc_id, classification in sorted_classifications:
        wc = weight_classifications[wc_id]
        entry_list = [(entry, wc_id, classification) for entry in entries_by_classification[(wc_id, classification)]]
        if wc.category == "Dressed":
            dressed_entries_by_classification[(wc_id, classification)] = entry_list
        else:
            byproduct_entries_by_classification[(wc_id, classification)] = entry_list
    
    # Organize into pages with exactly 13 columns
    ROWS_PER_PAGE = 20
    COLUMNS_PER_PAGE = 13
    ENTRIES_PER_PAGE = ROWS_PER_PAGE * COLUMNS_PER_PAGE  # 260 entries per page
    
    pages: List[TallySheetPage] = []
    
    # Helper function to process entries grouped by classification and create pages
    def process_entries_by_classification(entries_by_classification: Dict[Tuple[int, str], List[Tuple[TallyLogEntry, int, str]]], is_byproduct: bool) -> int:
        """Process entries grouped by classification and create pages. Returns number of pages created."""
        if not entries_by_classification:
            return 0
        
        pages_created = 0
        current_page_entries: List[Tuple[TallyLogEntry, int, str]] = []
        current_column_count = 0
        current_total_entries = 0
        
        # Process each classification in order
        for wc_id, classification in sorted(entries_by_classification.keys(), key=get_classification_sort_key):
            classification_entries = entries_by_classification[(wc_id, classification)]
            entries_remaining = classification_entries.copy()
            
            # Process all entries for this classification, splitting across pages if needed
            while entries_remaining:
                # Calculate how many columns this classification needs (each column holds 20 entries)
                total_entries_for_classification = len(entries_remaining)
                total_columns_needed = (total_entries_for_classification + ROWS_PER_PAGE - 1) // ROWS_PER_PAGE
                
                # Calculate how many columns are available on the current page
                columns_available = COLUMNS_PER_PAGE - current_column_count
                entries_available = ENTRIES_PER_PAGE - current_total_entries
                
                # If we can't fit even one column of this classification, start a new page
                if columns_available == 0 or entries_available < ROWS_PER_PAGE:
                    # Create page with current entries
                    if current_page_entries:
                        pages_created += create_page_from_entries(current_page_entries, is_byproduct, len(pages) + 1)
                    # Reset for new page
                    current_page_entries = []
                    current_column_count = 0
                    current_total_entries = 0
                    columns_available = COLUMNS_PER_PAGE
                    entries_available = ENTRIES_PER_PAGE
                
                # Determine how many columns we can add on this page
                columns_to_add = min(total_columns_needed, columns_available)
                entries_to_add_count = min(total_entries_for_classification, columns_to_add * ROWS_PER_PAGE, entries_available)
                
                # Take entries for the columns we can fit
                entries_to_add = entries_remaining[:entries_to_add_count]
                entries_remaining = entries_remaining[entries_to_add_count:]
                
                # Add entries to current page
                current_page_entries.extend(entries_to_add)
                current_column_count += columns_to_add
                current_total_entries += entries_to_add_count
                
                # If page is full, create it and start a new one
                if current_column_count >= COLUMNS_PER_PAGE or current_total_entries >= ENTRIES_PER_PAGE:
                    if current_page_entries:
                        pages_created += create_page_from_entries(current_page_entries, is_byproduct, len(pages) + 1)
                    current_page_entries = []
                    current_column_count = 0
                    current_total_entries = 0
        
        # Create final page if there are remaining entries
        if current_page_entries:
            pages_created += create_page_from_entries(current_page_entries, is_byproduct, len(pages) + 1)
        
        return pages_created
    
    # Helper function to create a page from a list of entries
    def create_page_from_entries(page_entries: List[Tuple[TallyLogEntry, int, str]], is_byproduct: bool, page_number: int) -> int:
        """Create a page from entries. Returns 1 if page was created, 0 otherwise."""
        if not page_entries:
            return 0
        
        # Build grid (20 rows x 13 columns)
        grid: List[List[Optional[float]]] = [[None for _ in range(COLUMNS_PER_PAGE)] for _ in range(ROWS_PER_PAGE)]
        sheet_entries: List[TallySheetEntry] = []
        
        # Track which classification is in each column (for headers)
        column_classifications: Dict[int, Tuple[int, str]] = {}
        
        # Group entries by classification first (use entry.id to ensure uniqueness)
        entries_by_classification_in_page: Dict[Tuple[int, str], List[Tuple[TallyLogEntry, int, str]]] = defaultdict(list)
        seen_entry_ids = set()
        for entry, wc_id, classification in page_entries:
            # Only add each entry once (by ID) to prevent duplicates
            if entry.id not in seen_entry_ids:
                entries_by_classification_in_page[(wc_id, classification)].append((entry, wc_id, classification))
                seen_entry_ids.add(entry.id)
        
        # Fill grid: each classification gets its own column(s), filled completely (all 20 rows per column) before next
        current_column = 0
        
        for wc_id, classification in sorted(entries_by_classification_in_page.keys(), key=get_classification_sort_key):
            if current_column >= COLUMNS_PER_PAGE:
                break  # No more columns available
            
            classification_entries = entries_by_classification_in_page[(wc_id, classification)]
            
            # A classification can span multiple columns if it has more than 20 entries
            entry_idx = 0
            while entry_idx < len(classification_entries) and current_column < COLUMNS_PER_PAGE:
                # Mark this column as belonging to this classification (all columns for same classification get same label)
                column_classifications[current_column] = (wc_id, classification)
                
                # Fill this column with up to 20 entries from this classification
                for row_idx in range(ROWS_PER_PAGE):
                    if entry_idx >= len(classification_entries):
                        break  # No more entries for this classification
                    
                    entry, entry_wc_id, entry_classification = classification_entries[entry_idx]
                    
                    # For byproduct, show heads value from entry, for dressed show weight
                    if is_byproduct:
                        wc = weight_classifications[entry_wc_id]
                        default_heads = wc.default_heads if wc.default_heads is not None else FALLBACK_DEFAULT_HEADS
                        cell_value = entry.heads if entry.heads is not None else default_heads
                    else:
                        cell_value = entry.weight
                    
                    grid[row_idx][current_column] = cell_value
                    sheet_entries.append(TallySheetEntry(
                        row=row_idx + 1,  # 1-indexed
                        column=current_column,
                        weight=entry.weight,
                        classification=classification,
                        classification_id=wc_id
                    ))
                    
                    entry_idx += 1
                
                # If we still have more entries for this classification, move to next column
                if entry_idx < len(classification_entries):
                    current_column += 1
                else:
                    break  # All entries for this classification are done
            
            # Move to next classification (next column)
            current_column += 1
        
        # Build column headers - always create exactly 13 column headers
        columns: List[TallySheetColumnHeader] = []
        for col in range(COLUMNS_PER_PAGE):
            if col in column_classifications:
                wc_id, classification = column_classifications[col]
                columns.append(TallySheetColumnHeader(
                    classification=classification,
                    classification_id=wc_id,
                    index=col
                ))
            else:
                # Empty column - use empty placeholder
                columns.append(TallySheetColumnHeader(
                    classification="",
                    classification_id=0,
                    index=col
                ))
        
        # Calculate summaries for this page
        # Get all classifications present on this page
        page_classifications = set()
        for entry, wc_id, classification in page_entries:
            page_classifications.add((wc_id, classification))
        
        # Calculate summaries per classification - only include relevant category
        summary_dressed: List[TallySheetSummary] = []
        summary_byproduct: List[TallySheetSummary] = []
        
        total_dressed_bags = 0.0
        total_dressed_heads = 0.0
        total_dressed_kilograms = 0.0
        total_byproduct_bags = 0.0
        total_byproduct_heads = 0.0
        total_byproduct_kilograms = 0.0
        
        for wc_id, classification in sorted(page_classifications, key=get_classification_sort_key):
            wc = weight_classifications[wc_id]
            # Count entries for this classification on this page
            page_entries_for_wc = [
                (e, e_wc_id, cls) for e, e_wc_id, cls in page_entries
                if e_wc_id == wc_id and cls == classification
            ]
            
            bags = len(page_entries_for_wc)
            # For both byproduct and dressed, use actual heads from entries with fallback to weight classification's default_heads
            default_heads = wc.default_heads if wc.default_heads is not None else FALLBACK_DEFAULT_HEADS
            heads = sum(e.heads if e.heads is not None else default_heads for e, _, _ in page_entries_for_wc)
            kilograms = sum(e.weight for e, _, _ in page_entries_for_wc)
            
            summary = TallySheetSummary(
                classification=classification,
                classification_id=wc_id,
                bags=bags,
                heads=heads,
                kilograms=kilograms
            )
            
            # Only add to the relevant summary list based on page type
            if is_byproduct:
                summary_byproduct.append(summary)
                total_byproduct_bags += bags
                total_byproduct_heads += heads
                total_byproduct_kilograms += kilograms
            else:
                summary_dressed.append(summary)
                total_dressed_bags += bags
                total_dressed_heads += heads
                total_dressed_kilograms += kilograms
        
        # Determine product type for this page - since entries are always separated by category,
        # we can simply use the is_byproduct flag
        page_product_type = "Byproduct" if is_byproduct else "Dressed Chicken"
        
        pages.append(TallySheetPage(
            page_number=page_number,
            total_pages=0,  # Will be set after all pages are created
            columns=columns,
            entries=sheet_entries,
            grid=grid,
            summary_dressed=summary_dressed,
            summary_byproduct=summary_byproduct,
            total_dressed_bags=total_dressed_bags,
            total_dressed_heads=total_dressed_heads,
            total_dressed_kilograms=total_dressed_kilograms,
            total_byproduct_bags=total_byproduct_bags,
            total_byproduct_heads=total_byproduct_heads,
            total_byproduct_kilograms=total_byproduct_kilograms,
            is_byproduct=is_byproduct,
            product_type=page_product_type
        ))
        
        return 1
    
    # Process Dressed entries first
    process_entries_by_classification(dressed_entries_by_classification, is_byproduct=False)
    
    # Process Byproduct entries
    process_entries_by_classification(byproduct_entries_by_classification, is_byproduct=True)
    
    # Update total_pages for all pages
    total_pages = len(pages)
    for page in pages:
        page.total_pages = total_pages
    
    # Calculate grand totals across all pages
    grand_total_bags = sum(len(entries_by_classification[key]) for key in entries_by_classification)
    
    # Calculate grand total heads - use actual heads from entries for both byproduct and dressed
    # Use weight classification's default_heads for each entry
    grand_total_heads = 0.0
    for (wc_id, classification), entries in entries_by_classification.items():
        wc = weight_classifications[wc_id]
        default_heads = wc.default_heads if wc.default_heads is not None else FALLBACK_DEFAULT_HEADS
        grand_total_heads += sum(e.heads if e.heads is not None else default_heads for e in entries)
    
    grand_total_kilograms = sum(
        sum(e.weight for e in entries)
        for entries in entries_by_classification.values()
    )
    
    # Determine product type (use "Mixed" if both categories exist, otherwise use the single category)
    categories = {wc.category for wc in weight_classifications.values()}
    if len(categories) == 1:
        if "Byproduct" in categories:
            product_type = "Byproduct"
        else:
            product_type = "Dressed Chicken"
    else:
        product_type = "Mixed"
    
    # Use the date from the first session
    session_date = customer_sessions[0].date
    
    return TallySheetResponse(
        customer_name=customer.name,
        product_type=product_type,
        date=session_date,
        pages=pages,
        grand_total_bags=grand_total_bags,
        grand_total_heads=grand_total_heads,
        grand_total_kilograms=grand_total_kilograms
    )


@router.post("/tally-sheet", response_model=TallySheetMultiCustomerResponse)
def export_tally_sheet(
    request: TallySheetRequest,
    db: Session = Depends(get_db)
):
    """
    Export tally sheet data for specified sessions.
    Groups sessions by customer and returns separate data for each customer.
    Returns paginated data organized in a 20-row grid format.
    Separates Dressed and Byproduct entries into separate tables.
    """
    if not request.session_ids:
        raise HTTPException(status_code=400, detail="At least one session ID is required")
    
    # Get all sessions and validate they exist
    sessions = db.query(TallySession).filter(
        TallySession.id.in_(request.session_ids)
    ).all()
    
    if len(sessions) != len(request.session_ids):
        raise HTTPException(status_code=404, detail="One or more sessions not found")
    
    # Group sessions by customer
    sessions_by_customer: Dict[int, List[TallySession]] = defaultdict(list)
    for session in sessions:
        sessions_by_customer[session.customer_id].append(session)
    
    # Process each customer's sessions separately
    customer_responses: List[TallySheetResponse] = []
    for customer_id, customer_sessions in sessions_by_customer.items():
        try:
            response = process_sessions_for_customer(customer_sessions, db)
            customer_responses.append(response)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing customer {customer_id}: {str(e)}")
    
    if not customer_responses:
        raise HTTPException(status_code=404, detail="No valid data found for export")
    
    return TallySheetMultiCustomerResponse(customers=customer_responses)
