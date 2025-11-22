from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List, Dict

from ...database import get_db
from ...models.allocation_details import AllocationDetails
from ...models.tally_session import TallySession
from ...models.customer import Customer
from ...models.weight_classification import WeightClassification
from ...models.plant import Plant
from ...schemas.export import ExportRequest, ExportResponse, CustomerExportData, ExportItem

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

