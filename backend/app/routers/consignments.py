from fastapi import APIRouter, HTTPException, status, Depends, Response
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict
from bson import ObjectId
from datetime import datetime, date, timedelta
from io import BytesIO
import re
import pandas as pd
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from ..database import db_helper
from ..models.consignment import (
    ConsignmentCreate, ConsignmentReportItem, ConsignmentResponse, ConsignmentUpdate, ConsignmentZone
)
from ..models.shipment import ShipmentStatus, ShipmentType, Address, TrackingEvent
from ..models.invoice import PaymentStatus, InvoiceItem, PaymentMethod
from ..models.user import TokenData
from ..utils.auth import require_admin
from ..utils.helpers import generate_invoice_number

router = APIRouter(prefix="/api/consignments", tags=["Consignments"])


def _safe_float(value, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_box_dimensions(dimensions: Optional[str]) -> Optional[Dict[str, float]]:
    if not dimensions:
        return None

    raw = str(dimensions).strip().lower()
    if not raw:
        return None

    unit = "in" if ("in" in raw or '"' in raw) else "cm"
    cleaned = re.sub(r"[^0-9x*\.]+", "", raw)
    cleaned = cleaned.replace("x", "*")
    parts = [p for p in cleaned.split("*") if p]

    if len(parts) < 3:
        return None

    try:
        length = float(parts[0])
        width = float(parts[1])
        height = float(parts[2])
    except ValueError:
        return None

    if length <= 0 or width <= 0 or height <= 0:
        return None

    return {
        "length": length,
        "width": width,
        "height": height,
        "unit": unit,
    }


def _calculate_chargeable_weight(consignment_data: Dict) -> Dict[str, float]:
    weight_kg = _safe_float(consignment_data.get("weight"), 0.0)
    service_type = str(consignment_data.get("service_type") or "").lower()
    mode = str(consignment_data.get("mode") or "").lower()

    box_fields = [
        consignment_data.get("box1_dimensions"),
        consignment_data.get("box2_dimensions"),
        consignment_data.get("box3_dimensions"),
    ]

    total_cm3 = 0.0
    total_cft = 0.0
    has_dimensions = False

    for raw_dim in box_fields:
        parsed = _parse_box_dimensions(raw_dim)
        if not parsed:
            continue

        has_dimensions = True
        length = parsed["length"]
        width = parsed["width"]
        height = parsed["height"]

        if parsed["unit"] == "in":
            volume_in3 = length * width * height
            total_cft += volume_in3 / 1728.0
            total_cm3 += volume_in3 * 16.387064
        else:
            volume_cm3 = length * width * height
            total_cm3 += volume_cm3
            total_cft += volume_cm3 / 28316.846592

    # Air mode should always use air divisor. Surface cargo then applies CFT slabs.
    divisor = 4500.0
    if mode == "air":
        divisor = 5000.0
    elif service_type == "cargo":
        divisor = 2700.0 if total_cft > 10 else 4500.0

    volumetric_weight = (total_cm3 / divisor) if total_cm3 > 0 else 0.0
    chargeable_weight = max(weight_kg, volumetric_weight)

    return {
        "weight_kg": weight_kg,
        "volumetric_weight": volumetric_weight,
        "chargeable_weight": chargeable_weight,
        "has_dimensions": has_dimensions,
        "total_cft": total_cft,
    }


def _calculate_financials(consignment_data: Dict) -> Dict[str, float]:
    base_rate = _safe_float(consignment_data.get("base_rate"), 0.0)
    docket_charges = _safe_float(consignment_data.get("docket_charges"), 0.0)
    oda_charge = _safe_float(consignment_data.get("oda_charge"), 0.0)
    fov = _safe_float(consignment_data.get("fov"), 0.0)
    fuel_charge_percent = _safe_float(consignment_data.get("fuel_charge"), 0.0)
    gst_percent = _safe_float(consignment_data.get("gst"), 0.0)

    weight_details = _calculate_chargeable_weight(consignment_data)
    has_dimensions = weight_details["has_dimensions"]
    chargeable_weight = weight_details["chargeable_weight"]

    base_amount = (base_rate * chargeable_weight) if has_dimensions else base_rate

    subtotal = base_amount + docket_charges + oda_charge + fov
    fuel_amount = subtotal * (fuel_charge_percent / 100.0) if fuel_charge_percent else 0.0
    subtotal_with_fuel = subtotal + fuel_amount
    gst_amount = subtotal_with_fuel * (gst_percent / 100.0)
    total_amount = subtotal_with_fuel + gst_amount

    return {
        "base_amount": base_amount,
        "subtotal": subtotal,
        "fuel_amount": fuel_amount,
        "subtotal_with_fuel": subtotal_with_fuel,
        "gst_amount": gst_amount,
        "total_amount": total_amount,
    }


def generate_consignment_number() -> str:
    """Generate a unique consignment number."""
    timestamp = datetime.utcnow().strftime("%d%m%y%H%M")
    return f"DXOO{timestamp}"


def generate_tracking_number() -> str:
    """Generate a unique tracking number for shipments."""
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    return f"RR{timestamp}"


async def get_next_sr_no() -> int:
    """Get the next serial number."""
    db = db_helper.db
    last_doc = await db.consignments.find_one(
        sort=[("sr_no", -1)]
    )
    return (last_doc.get("sr_no", 0) + 1) if last_doc else 1


async def get_user_pricing_rule(user_id: str, zone: str):
    """Get user's pricing rule or fall back to zone-based pricing."""
    db = db_helper.db
    
    # First, try to get user's assigned pricing rule
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user and user.get("pricing_rule_id"):
        rule = await db.pricing_rules.find_one({"_id": ObjectId(user["pricing_rule_id"])})
        if rule and rule.get("is_active", True):
            return rule
    
    # Fall back to zone-based pricing rule
    zone_lower = zone.lower() if zone else "local"
    rule = await db.pricing_rules.find_one({
        "zone": zone_lower,
        "is_active": True
    })
    return rule


async def create_shipment_for_consignment(consignment_dict: dict, user: Optional[dict], token_data):
    """Auto-create a shipment when a consignment is created."""
    db = db_helper.db
    
    # Safe user details
    user = user or {}
    
    # Build origin address
    origin_name = user.get("full_name") or user.get("email") or "Sender"
    origin = {
        "name": origin_name,
        "phone": user.get("phone", "") or "",
        "address_line1": user.get("address", "") or "Address Not Provided",
        "city": user.get("city", "") or "City",
        "state": user.get("state", "") or "State",
        "pincode": user.get("pincode", "") or "000000",
        "country": "India"
    }
    
    # Build destination address from consignment
    destination = {
        "name": consignment_dict.get("name", "Consignee"),
        "phone": "",
        "address_line1": consignment_dict.get("destination", "Destination Address"),
        "city": consignment_dict.get("destination_city", "") or consignment_dict.get("destination", "").split(",")[-1].strip(),
        "state": consignment_dict.get("destination_state", "") or "",
        "pincode": consignment_dict.get("destination_pincode", "") or "",
        "country": "India"
    }
    
    # Determine shipment type based on weight
    weight = float(consignment_dict.get("weight", 0))
    if weight <= 0.5:
        shipment_type = ShipmentType.DOCUMENT.value
    elif weight <= 5:
        shipment_type = ShipmentType.PARCEL.value
    else:
        shipment_type = ShipmentType.FREIGHT.value
        
    # Parse dimensions from box1_dimensions (Format: L*B*H)
    dimensions = None
    box1 = consignment_dict.get("box1_dimensions")
    if box1 and "*" in box1:
        try:
            parts = box1.split("*")
            if len(parts) >= 3:
                dimensions = {
                    "length": float(parts[0]),
                    "width": float(parts[1]),
                    "height": float(parts[2])
                }
        except ValueError:
            pass

    # Create shipment document
    docket_suffix = f" (Docket: {consignment_dict.get('docket_no')})" if consignment_dict.get("docket_no") else ""
    shipment = {
        "tracking_number": generate_tracking_number(),
        "customer_id": consignment_dict.get("user_id", ""),
        "shipment_type": shipment_type,
        "docket_no": consignment_dict.get("docket_no"),
        "origin": origin,
        "destination": destination,
        "weight_kg": weight,
        "declared_value": float(consignment_dict.get("value", 0) or 0),
        "description": f"{consignment_dict.get('product_name', '')}{docket_suffix}",
        "special_instructions": consignment_dict.get("remarks", ""),
        "status": ShipmentStatus.PENDING.value,
        "tracking_history": [{
            "status": ShipmentStatus.PENDING.value,
            "location": origin["city"] or "Origin",
            "timestamp": datetime.utcnow(),
            "description": "Shipment created from consignment",
            "updated_by": token_data.user_id
        }],
        "pricing": {
            "base_rate": float(consignment_dict.get("base_rate", 0) or 0),
            "docket_charges": float(consignment_dict.get("docket_charges", 0) or 0),
            "oda_charge": float(consignment_dict.get("oda_charge", 0) or 0),
            "fov": float(consignment_dict.get("fov", 0) or 0),
            "total": float(consignment_dict.get("total", 0) or 0)
        },
        "consignment_id": None,  # Will update after consignment is saved
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "created_by": token_data.user_id
    }
    
    if dimensions:
        shipment["dimensions"] = dimensions
    
    result = await db.shipments.insert_one(shipment)
    return str(result.inserted_id), shipment["tracking_number"]


async def create_invoice_for_consignment(
    consignment_dict: dict, 
    user: Optional[dict], 
    shipment_id: str,
    tracking_number: str,
    token_data
) -> tuple:
    """Auto-create an invoice when a consignment is created."""
    db = db_helper.db
    
    financials = _calculate_financials(consignment_dict)
    subtotal_with_fuel = financials["subtotal_with_fuel"]
    gst_amount = financials["gst_amount"]
    total_amount = financials["total_amount"]

    # Safe user details
    user = user or {}
    customer_name = user.get("full_name") or consignment_dict.get("name") or "Customer"
    customer_email = user.get("email", "")
    customer_address = f"{user.get('address', '')}, {user.get('city', '')}, {user.get('state', '')} - {user.get('pincode', '')}"
    if customer_address.strip() == ", ,  - ":
        customer_address = "Address not provided"

    # Consignment No
    consignment_no = consignment_dict.get("consignment_no", "N/A")
    
    # Create invoice item
    docket_suffix = f" (Docket: {consignment_dict.get('docket_no')})" if consignment_dict.get("docket_no") else ""
    items = [{
        "shipment_id": shipment_id or "",
        "tracking_number": tracking_number or "",
        "docket_no": consignment_dict.get("docket_no", ""),
        "description": f"Consignment {consignment_no}{docket_suffix} - {consignment_dict.get('product_name', 'Package')} to {consignment_dict.get('destination', 'Destination')}",
        "weight_kg": float(consignment_dict.get("weight", 0)),
        "amount": round(subtotal_with_fuel, 2)
    }]
    
    # Create invoice
    invoice = {
        "invoice_number": generate_invoice_number(),
        "customer_id": consignment_dict.get("user_id", ""),
        "customer_name": customer_name,
        "customer_email": customer_email,
        "billing_address": customer_address,
        "shipment_ids": [shipment_id] if shipment_id else [],
        "items": items,
        "subtotal": round(subtotal_with_fuel, 2),
        "gst_amount": round(gst_amount, 2),
        "total_amount": round(total_amount, 2),
        "amount_paid": 0,
        "balance_due": round(total_amount, 2),
        "payment_status": PaymentStatus.PENDING.value,
        "payments": [],
        "due_date": (datetime.utcnow() + timedelta(days=30)).date().isoformat(),
        "notes": f"Auto-generated invoice for consignment {consignment_no}{docket_suffix}",
        "created_at": datetime.utcnow(),
        "created_by": token_data.user_id
    }
    
    result = await db.invoices.insert_one(invoice)
    invoice_id = str(result.inserted_id)
    
    # Update shipment with invoice_id
    if shipment_id:
        await db.shipments.update_one(
            {"_id": ObjectId(shipment_id)},
            {"$set": {"invoice_id": invoice_id}}
        )
    
    return invoice_id, invoice["invoice_number"]


def _extract_consignment_city(doc: Dict) -> str:
    city = str(doc.get("destination_city") or "").strip()
    if city:
        return city

    destination = str(doc.get("destination") or "").strip()
    if not destination:
        return ""

    parts = [part.strip() for part in destination.split(",") if part.strip()]
    return parts[-1] if parts else destination


def _build_report_filters(
    name: Optional[str] = None,
    city: Optional[str] = None,
    docket_no: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict:
    query: Dict = {}
    and_conditions = []

    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        query["date"] = date_query

    if name:
        query["name"] = {"$regex": re.escape(name.strip()), "$options": "i"}

    if docket_no:
        query["docket_no"] = {"$regex": re.escape(docket_no.strip()), "$options": "i"}

    if city:
        city_regex = {"$regex": re.escape(city.strip()), "$options": "i"}
        and_conditions.append({
            "$or": [
                {"destination_city": city_regex},
                {"destination": city_regex},
            ]
        })

    if and_conditions:
        query.setdefault("$and", []).extend(and_conditions)

    return query


def _serialize_consignment_report_item(doc: Dict) -> ConsignmentReportItem:
    doc_id = doc.get("_id")
    if isinstance(doc_id, ObjectId):
        doc_id = str(doc_id)

    docket_no = doc.get("docket_no") or doc.get("docketNo") or doc.get("consignment_no")
    amount = _safe_float(doc.get("total"), 0.0)

    return ConsignmentReportItem(
        _id=str(doc_id or ""),
        name=str(doc.get("name") or ""),
        date=doc.get("date"),
        docket_no=docket_no,
        city=_extract_consignment_city(doc),
        weight=_safe_float(doc.get("weight"), 0.0),
        amount=amount,
    )


def _to_report_datetime(value) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except Exception:
        return None


def _format_report_date(value) -> str:
    parsed = _to_report_datetime(value)
    if not parsed:
        return "-"
    return parsed.strftime("%d/%m/%Y")


def _build_consignment_report_pdf(rows: List[ConsignmentReportItem]) -> BytesIO:
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ConsignmentReportTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        alignment=TA_CENTER,
    )
    info_style = ParagraphStyle(
        "ConsignmentReportInfo",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        alignment=TA_LEFT,
    )

    output = BytesIO()
    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        leftMargin=8 * mm,
        rightMargin=8 * mm,
        topMargin=8 * mm,
        bottomMargin=8 * mm,
    )

    story = [
        Paragraph("R. R. ENTERPRISES", title_style),
        Spacer(1, 2),
        Paragraph(f"Print Date: {datetime.now().strftime('%d/%m/%Y, %I:%M:%S %p')}", info_style),
        Spacer(1, 5),
    ]

    table_data = [["Sr.", "Name", "Date", "Docket No", "City", "Weight", "Amount"]]
    total_amount = 0.0

    for index, row in enumerate(rows, start=1):
        row_amount = _safe_float(row.amount, 0.0)
        total_amount += row_amount
        table_data.append([
            str(index),
            str(row.name or "-"),
            _format_report_date(row.date),
            str(row.docket_no or "-"),
            str(row.city or "-"),
            f"{_safe_float(row.weight, 0.0):,.2f}",
            f"{row_amount:,.2f}",
        ])

    table_data.append(["", "", "", "", "", "Total Amount", f"{total_amount:,.2f}"])

    usable_width = A4[0] - doc.leftMargin - doc.rightMargin
    col_widths = [14 * mm, 54 * mm, 24 * mm, 34 * mm, 40 * mm, 24 * mm, 26 * mm]
    consumed_width = sum(col_widths)
    if consumed_width > usable_width:
        scale = usable_width / consumed_width
        col_widths = [width * scale for width in col_widths]
    elif consumed_width < usable_width:
        col_widths[1] += usable_width - consumed_width

    table = Table(table_data, colWidths=col_widths, repeatRows=1)

    last_row = len(table_data) - 1
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.6, colors.black),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, last_row), (-1, last_row), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, last_row - 1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (1, 0), (4, -1), "LEFT"),
        ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ("ALIGN", (5, 0), (6, -1), "RIGHT"),
        ("SPAN", (0, last_row), (5, last_row)),
        ("ALIGN", (0, last_row), (5, last_row), "RIGHT"),
        ("ALIGN", (6, last_row), (6, last_row), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))

    story.append(table)
    doc.build(story)
    output.seek(0)
    return output

@router.post("/", response_model=ConsignmentResponse)
async def create_consignment(
    consignment: ConsignmentCreate,
    token_data: TokenData = Depends(require_admin)
):
    """Create a new consignment entry with auto-shipment creation (Admin only)."""
    db = db_helper.db
    
    consignment_dict = consignment.model_dump()
    
    # Get user details if user_id is provided
    user = None
    if consignment_dict.get("user_id"):
        try:
            user = await db.users.find_one({"_id": ObjectId(consignment_dict["user_id"])})
            if user:
                # Update name from user if not explicitly set
                if not consignment_dict.get("name") or consignment_dict["name"] == "":
                    consignment_dict["name"] = user.get("full_name", "")
                
                # Apply user's pricing rule if rates are not manually set
                if consignment_dict.get("base_rate", 0) == 0:
                    pricing_rule = await get_user_pricing_rule(
                        consignment_dict["user_id"],
                        consignment_dict.get("zone", "LOCAL")
                    )
                    if pricing_rule:
                        weight = consignment_dict.get("weight", 0)
                        consignment_dict["base_rate"] = pricing_rule.get("base_rate", 0)
                        # Calculate per-kg charges
                        per_kg_rate = pricing_rule.get("per_kg_rate", 0)
                        min_weight = pricing_rule.get("min_weight_kg", 0.5)
                        chargeable_weight = max(weight, min_weight)
                        consignment_dict["base_rate"] += per_kg_rate * chargeable_weight
        except Exception:
            pass  # Invalid user_id, continue without user
    
    consignment_dict["sr_no"] = await get_next_sr_no()
    consignment_dict["consignment_no"] = generate_consignment_number()
    if not consignment_dict.get("docket_no"):
        consignment_dict["docket_no"] = consignment_dict["consignment_no"]
    consignment_dict["total"] = _calculate_financials(consignment_dict)["total_amount"]
    consignment_dict["date"] = consignment_dict["date"].isoformat()
    consignment_dict["created_at"] = datetime.utcnow()
    consignment_dict["updated_at"] = datetime.utcnow()
    consignment_dict["created_by"] = token_data.user_id
    
    # Auto-create shipment (ALWAYS attempt)
    shipment_id = None
    tracking_number = None
    try:
        shipment_id, tracking_number = await create_shipment_for_consignment(
            consignment_dict, user, token_data
        )
        consignment_dict["shipment_id"] = shipment_id
    except Exception as e:
        # Log error but don't fail consignment creation
        import traceback
        traceback.print_exc()
        print(f"Failed to create shipment: {e}")
    
    result = await db.consignments.insert_one(consignment_dict)
    consignment_dict["_id"] = str(result.inserted_id)
    
    # Update shipment with consignment_id
    if shipment_id:
        try:
            await db.shipments.update_one(
                {"_id": ObjectId(shipment_id)},
                {"$set": {"consignment_id": str(result.inserted_id)}}
            )
        except Exception as e:
            print(f"Failed to update shipment with consignment_id: {e}")
    
    # Auto-create invoice (ALWAYS attempt if shipment created or details present)
    invoice_id = None
    try:
        invoice_id, invoice_number = await create_invoice_for_consignment(
            consignment_dict, user, shipment_id, tracking_number or "", token_data
        )
        consignment_dict["invoice_id"] = invoice_id
        consignment_dict["invoice_no"] = invoice_number
        
        # Update consignment with invoice reference
        await db.consignments.update_one(
            {"_id": result.inserted_id},
            {"$set": {"invoice_id": invoice_id, "invoice_no": invoice_number}}
        )
    except Exception as e:
        # Log error but don't fail consignment creation
        import traceback
        traceback.print_exc()
        print(f"Failed to create invoice: {e}")
    
    return ConsignmentResponse(**consignment_dict)


@router.get("/report", response_model=List[ConsignmentReportItem], response_model_by_alias=False)
async def get_consignment_report(
    name: Optional[str] = None,
    city: Optional[str] = None,
    docket_no: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    token_data: TokenData = Depends(require_admin)
):
    """Return filtered consignment report rows with only report fields."""
    db = db_helper.db

    query = _build_report_filters(
        name=name,
        city=city,
        docket_no=docket_no,
        start_date=start_date,
        end_date=end_date,
    )

    cursor = db.consignments.find(query).sort("date", -1)
    report_items = []

    async for doc in cursor:
        report_items.append(_serialize_consignment_report_item(doc))

    return report_items


@router.get("/report/pdf")
async def export_consignment_report_pdf(
    ids: Optional[str] = None,
    name: Optional[str] = None,
    city: Optional[str] = None,
    docket_no: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    token_data: TokenData = Depends(require_admin)
):
    """Export selected/report consignments as invoice-style PDF sheet."""
    db = db_helper.db

    query = _build_report_filters(
        name=name,
        city=city,
        docket_no=docket_no,
        start_date=start_date,
        end_date=end_date,
    )

    if ids:
        selected_ids = [item.strip() for item in ids.split(",") if item.strip()]
        object_ids = []
        for raw_id in selected_ids:
            if not ObjectId.is_valid(raw_id):
                raise HTTPException(status_code=400, detail=f"Invalid consignment id: {raw_id}")
            object_ids.append(ObjectId(raw_id))

        query["_id"] = {"$in": object_ids}

    cursor = db.consignments.find(query).sort("date", -1)
    report_rows: List[ConsignmentReportItem] = []
    async for doc in cursor:
        report_rows.append(_serialize_consignment_report_item(doc))

    pdf_buffer = _build_consignment_report_pdf(report_rows)
    filename = f"consignment_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/", response_model=List[ConsignmentResponse])
async def list_consignments(
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    zone: Optional[ConsignmentZone] = None,
    user_id: Optional[str] = None,
    token_data: TokenData = Depends(require_admin)
):
    """List all consignments with optional filters (Admin only)."""
    db = db_helper.db
    
    query = {}
    
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}
    elif end_date:
        query["date"] = {"$lte": end_date}
    
    if zone:
        query["zone"] = zone
    
    if user_id:
        query["user_id"] = user_id
    
    cursor = db.consignments.find(query).sort("sr_no", -1).skip(skip).limit(limit)
    consignments = []
    async for doc in cursor:
        try:
            doc["_id"] = str(doc["_id"])
            if "docket_no" not in doc and "docketNo" in doc:
                doc["docket_no"] = doc.get("docketNo")
            if not doc.get("docket_no") and doc.get("consignment_no"):
                doc["docket_no"] = doc.get("consignment_no")
                await db.consignments.update_one(
                    {"_id": ObjectId(doc["_id"])},
                    {"$set": {"docket_no": doc["docket_no"]}}
                )
            # Handle potential missing fields or bad data by letting Pydantic validate
            # If validation fails, we log and skip instead of crashing the whol endpoint
            consignments.append(ConsignmentResponse(**doc))
        except Exception as e:
            print(f"Skipping invalid consignment {doc.get('_id', 'unknown')}: {e}")
            continue
    
    return consignments


@router.get("/by-user/{user_id}", response_model=List[ConsignmentResponse])
async def get_consignments_by_user(
    user_id: str,
    skip: int = 0,
    limit: int = 100,
    token_data: TokenData = Depends(require_admin)
):
    """Get all consignments for a specific user."""
    db = db_helper.db
    
    cursor = db.consignments.find({"user_id": user_id}).sort("sr_no", -1).skip(skip).limit(limit)
    consignments = []
    async for doc in cursor:
        if "docket_no" not in doc and "docketNo" in doc:
            doc["docket_no"] = doc.get("docketNo")
        if not doc.get("docket_no") and doc.get("consignment_no"):
            doc["docket_no"] = doc.get("consignment_no")
            await db.consignments.update_one(
                {"_id": doc["_id"]},
                {"$set": {"docket_no": doc["docket_no"]}}
            )
        doc["_id"] = str(doc["_id"])
        consignments.append(ConsignmentResponse(**doc))
    
    return consignments


@router.get("/by-invoice/{invoice_id}", response_model=List[ConsignmentResponse])
async def get_consignments_by_invoice(
    invoice_id: str,
    skip: int = 0,
    limit: int = 100,
    token_data: TokenData = Depends(require_admin)
):
    """Get all consignments for a specific invoice."""
    db = db_helper.db
    
    cursor = db.consignments.find({"invoice_id": invoice_id}).sort("sr_no", -1).skip(skip).limit(limit)
    consignments = []
    async for doc in cursor:
        if "docket_no" not in doc and "docketNo" in doc:
            doc["docket_no"] = doc.get("docketNo")
        if not doc.get("docket_no") and doc.get("consignment_no"):
            doc["docket_no"] = doc.get("consignment_no")
            await db.consignments.update_one(
                {"_id": doc["_id"]},
                {"$set": {"docket_no": doc["docket_no"]}}
            )
        doc["_id"] = str(doc["_id"])
        consignments.append(ConsignmentResponse(**doc))
    
    return consignments


@router.get("/{consignment_id}", response_model=ConsignmentResponse)
async def get_consignment(
    consignment_id: str,
    token_data: TokenData = Depends(require_admin)
):
    """Get a single consignment by ID."""
    db = db_helper.db
    
    doc = await db.consignments.find_one({"_id": ObjectId(consignment_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Consignment not found")
    
    if "docket_no" not in doc and "docketNo" in doc:
        doc["docket_no"] = doc.get("docketNo")
    if not doc.get("docket_no") and doc.get("consignment_no"):
        doc["docket_no"] = doc.get("consignment_no")
        await db.consignments.update_one(
            {"_id": ObjectId(consignment_id)},
            {"$set": {"docket_no": doc["docket_no"]}}
        )
    doc["_id"] = str(doc["_id"])
    return ConsignmentResponse(**doc)



async def sync_related_documents(db, consignment_doc):
    """Sync changes from consignment to linked shipment and invoice."""
    # 1. Update Shipment
    if consignment_doc.get("shipment_id"):
        try:
            shipment_update = {}
            # Always sync essential fields to ensure consistency
            curr_shipment = await db.shipments.find_one({"_id": ObjectId(consignment_doc["shipment_id"])})
            if curr_shipment:
                curr_dest = curr_shipment.get("destination", {}) or {}
                # Handle case where curr_dest might be None or empty
                if not isinstance(curr_dest, dict): curr_dest = {}
                
                new_dest = {
                    "name": consignment_doc.get("name") or curr_dest.get("name"),
                    "phone": curr_dest.get("phone", "") or "", # Preserve phone
                    "address_line1": consignment_doc.get("destination") or curr_dest.get("address_line1", ""),
                    "city": consignment_doc.get("destination_city") or consignment_doc.get("destination", "").split(",")[-1].strip() or curr_dest.get("city", ""),
                    "state": consignment_doc.get("destination_state") or curr_dest.get("state", ""),
                    "pincode": consignment_doc.get("destination_pincode") or curr_dest.get("pincode", ""),
                    "country": "India"
                }
                shipment_update["destination"] = new_dest
                shipment_update["total_weight"] = float(consignment_doc.get("weight", 0))
                shipment_update["description"] = consignment_doc.get("product_name", "")
                if "docket_no" in consignment_doc:
                    shipment_update["docket_no"] = consignment_doc.get("docket_no")
                
                dims = []
                if consignment_doc.get("box1_dimensions"): dims.append(consignment_doc["box1_dimensions"])
                if consignment_doc.get("box2_dimensions"): dims.append(consignment_doc["box2_dimensions"])
                if consignment_doc.get("box3_dimensions"): dims.append(consignment_doc["box3_dimensions"])
                if dims:
                    shipment_update["dimensions"] = " | ".join(dims)
                
                await db.shipments.update_one(
                    {"_id": ObjectId(consignment_doc["shipment_id"])},
                    {"$set": shipment_update}
                )
        except Exception as e:
            print(f"Failed to sync shipment {consignment_doc.get('shipment_id')}: {e}")

    # 2. Update Invoice
    if consignment_doc.get("invoice_id"):
        try:
            financials = _calculate_financials(consignment_doc)
            subtotal_with_fuel = financials["subtotal_with_fuel"]
            gst_amount = financials["gst_amount"]
            total_amount = financials["total_amount"]
            
            curr_invoice = await db.invoices.find_one({"_id": ObjectId(consignment_doc["invoice_id"])})
            if curr_invoice:
                amount_paid = curr_invoice.get("amount_paid", 0)
                current_items = curr_invoice.get("items", [])
                
                tracking_number = ""
                shipment_id_ref = consignment_doc.get("shipment_id", "")
                if current_items and isinstance(current_items, list) and len(current_items) > 0:
                    tracking_number = current_items[0].get("tracking_number", "")
                    if not shipment_id_ref:
                        shipment_id_ref = current_items[0].get("shipment_id", "")

                docket_suffix = f" (Docket: {consignment_doc.get('docket_no')})" if consignment_doc.get("docket_no") else ""
                new_item = {
                    "shipment_id": shipment_id_ref,
                    "tracking_number": tracking_number,
                    "docket_no": consignment_doc.get("docket_no", ""),
                    "description": f"Consignment {consignment_doc.get('consignment_no')}{docket_suffix} - {consignment_doc.get('product_name', 'Package')} to {consignment_doc.get('destination', 'Destination')}",
                    "weight_kg": float(consignment_doc.get("weight", 0)),
                    "amount": round(subtotal_with_fuel, 2)
                }
                
                invoice_update = {
                    "customer_name": consignment_doc.get("name"),
                    "items": [new_item],
                    "subtotal": round(subtotal_with_fuel, 2),
                    "gst_amount": round(gst_amount, 2),
                    "total_amount": round(total_amount, 2),
                    "balance_due": round(total_amount - amount_paid, 2)
                }
                
                await db.invoices.update_one(
                    {"_id": ObjectId(consignment_doc["invoice_id"])},
                    {"$set": invoice_update}
                )
        except Exception as e:
            print(f"Failed to sync invoice {consignment_doc.get('invoice_id')}: {e}")


@router.put("/{consignment_id}", response_model=ConsignmentResponse)
async def update_consignment(
    consignment_id: str,
    update: ConsignmentUpdate,
    token_data: TokenData = Depends(require_admin)
):
    """Update a consignment entry (Admin only)."""
    db = db_helper.db
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    
    if update_data:
        # Convert date to string if present
        if "date" in update_data and update_data["date"]:
            update_data["date"] = update_data["date"].isoformat()
        
        # Recalculate total if any rate fields changed
        doc = await db.consignments.find_one({"_id": ObjectId(consignment_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Consignment not found")
        
        merged_data = {**doc, **update_data}
        update_data["total"] = _calculate_financials(merged_data)["total_amount"]
        update_data["updated_at"] = datetime.utcnow()
        
        await db.consignments.update_one(
            {"_id": ObjectId(consignment_id)},
            {"$set": update_data}
        )
    
    doc = await db.consignments.find_one({"_id": ObjectId(consignment_id)})
    
    # Sync updates
    await sync_related_documents(db, doc)
    
    doc["_id"] = str(doc["_id"])
    return ConsignmentResponse(**doc)


@router.patch("/{consignment_id}", response_model=ConsignmentResponse)
async def patch_consignment(
    consignment_id: str,
    payload: dict,
    token_data: TokenData = Depends(require_admin)
):
    """Partially update a consignment entry."""
    db = db_helper.db

    # Ensure consignment exists
    doc = await db.consignments.find_one({"_id": ObjectId(consignment_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Consignment not found")

    update_data = dict(payload) or {}

    # Convert date to isoformat
    if "date" in update_data and update_data["date"]:
        try:
            update_data["date"] = str(update_data["date"])
        except Exception:
            update_data["date"] = str(update_data["date"])

    # Recalculate total
    merged_data = {**doc, **update_data}
    update_data["total"] = _calculate_financials(merged_data)["total_amount"]

    update_data["updated_at"] = datetime.utcnow()

    # Remove safe pops
    update_data.pop("_id", None)
    update_data.pop("id", None)

    await db.consignments.update_one(
        {"_id": ObjectId(consignment_id)},
        {"$set": update_data}
    )

    doc = await db.consignments.find_one({"_id": ObjectId(consignment_id)})
    
    # Sync updates
    await sync_related_documents(db, doc)

    doc["_id"] = str(doc["_id"])
    return ConsignmentResponse(**doc)


@router.delete("/{consignment_id}")
async def delete_consignment(
    consignment_id: str,
    token_data: TokenData = Depends(require_admin)
):
    """Delete a consignment entry (Admin only)."""
    db = db_helper.db
    
    result = await db.consignments.delete_one({"_id": ObjectId(consignment_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Consignment not found")
    
    return {"message": "Consignment deleted"}


@router.get("/export/excel")
async def export_consignments_excel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    ids: Optional[str] = None,
    token_data: TokenData = Depends(require_admin)
):
    """Export consignments to Excel (Admin only)."""
    db = db_helper.db
    
    query = {}
    if ids:
        obj_ids = [ObjectId(id.strip()) for id in ids.split(",") if id.strip()]
        query["_id"] = {"$in": obj_ids}
    elif start_date and end_date:
        # Only use date filter if no specific IDs are requested
        query["date"] = {"$gte": start_date, "$lte": end_date}
    
    cursor = db.consignments.find(query).sort("sr_no", 1)
    
    data = []
    async for doc in cursor:
        data.append({
            "SR NO": doc.get("sr_no"),
            "DATE": doc.get("date"),
            "CONSIGNMENT NO": doc.get("consignment_no"),
            "DOCKET NO": doc.get("docket_no", ""),
            "NAME": doc.get("name"),
            "USER ID": doc.get("user_id", ""),
            "DESTINATION": doc.get("destination"),
            "PIECES": doc.get("pieces"),
            "WEIGHT": doc.get("weight"),
            "PRODUCT NAME": doc.get("product_name"),
            "INVOICE NO": doc.get("invoice_no", ""),
            "ZONE": doc.get("zone"),
            "BASE RATE": doc.get("base_rate"),
            "DOCKET CHARGES": doc.get("docket_charges"),
            "ODA CHARGE": doc.get("oda_charge"),
            "FOV": doc.get("fov"),
            "VALUE": doc.get("value"),
            "TOTAL": doc.get("total"),
            "SHIPMENT ID": doc.get("shipment_id", ""),
            "BOX 1 L*B*H": doc.get("box1_dimensions", ""),
            "BOX 2 L*B*H": doc.get("box2_dimensions", ""),
            "BOX 3 L*B*H": doc.get("box3_dimensions", ""),
        })
    
    df = pd.DataFrame(data)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Consignments')
    output.seek(0)
    
    filename = f"consignments_{datetime.utcnow().strftime('%Y%m%d')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
