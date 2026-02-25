from fastapi import APIRouter, HTTPException, status, Depends, Response
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict
from bson import ObjectId
from datetime import datetime, date, timedelta
from io import BytesIO
import pandas as pd
from ..database import db_helper
from ..models.consignment import (
    ConsignmentCreate, ConsignmentResponse, ConsignmentUpdate, ConsignmentZone
)
from ..models.shipment import ShipmentStatus, ShipmentType, Address, TrackingEvent
from ..models.invoice import PaymentStatus, InvoiceItem, PaymentMethod
from ..models.user import TokenData
from ..utils.auth import require_admin
from ..utils.helpers import generate_invoice_number

router = APIRouter(prefix="/api/consignments", tags=["Consignments"])


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
    
    # Calculate totals
    base_rate = float(consignment_dict.get("base_rate", 0) or 0)
    docket_charges = float(consignment_dict.get("docket_charges", 0) or 0)
    oda_charge = float(consignment_dict.get("oda_charge", 0) or 0)
    fov = float(consignment_dict.get("fov", 0) or 0)
    fuel_charge = float(consignment_dict.get("fuel_charge", 0) or 0)
    gst_percent = float(consignment_dict.get("gst", 18) or 0)
    
    # Calculate subtotal
    subtotal = base_rate + docket_charges + oda_charge + fov
    
    # Apply fuel charge percentage
    fuel_amount = subtotal * (fuel_charge / 100) if fuel_charge else 0
    subtotal_with_fuel = subtotal + fuel_amount
    
    # Apply GST
    gst_amount = subtotal_with_fuel * (gst_percent / 100)
    total_amount = subtotal_with_fuel + gst_amount

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
    consignment_dict["total"] = (
        consignment_dict.get("base_rate", 0) + 
        consignment_dict.get("docket_charges", 0) + 
        consignment_dict.get("oda_charge", 0) + 
        consignment_dict.get("fov", 0)
    )
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
            # Re-calculate totals
            base_rate = float(consignment_doc.get("base_rate", 0) or 0)
            docket_charges = float(consignment_doc.get("docket_charges", 0) or 0)
            oda_charge = float(consignment_doc.get("oda_charge", 0) or 0)
            fov = float(consignment_doc.get("fov", 0) or 0)
            fuel_charge = float(consignment_doc.get("fuel_charge", 0) or 0)
            gst_percent = float(consignment_doc.get("gst", 18) or 0)
            
            subtotal = base_rate + docket_charges + oda_charge + fov
            fuel_amount = subtotal * (fuel_charge / 100) if fuel_charge else 0
            subtotal_with_fuel = subtotal + fuel_amount
            gst_amount = subtotal_with_fuel * (gst_percent / 100)
            total_amount = subtotal_with_fuel + gst_amount
            
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
        
        base = update_data.get("base_rate", doc.get("base_rate", 0))
        docket = update_data.get("docket_charges", doc.get("docket_charges", 0))
        oda = update_data.get("oda_charge", doc.get("oda_charge", 0))
        fov = update_data.get("fov", doc.get("fov", 0))
        update_data["total"] = base + docket + oda + fov
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
    base = update_data.get("base_rate", doc.get("base_rate", 0))
    docket = update_data.get("docket_charges", doc.get("docket_charges", 0))
    oda = update_data.get("oda_charge", doc.get("oda_charge", 0))
    fov = update_data.get("fov", doc.get("fov", 0))
    update_data["total"] = base + docket + oda + fov

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
