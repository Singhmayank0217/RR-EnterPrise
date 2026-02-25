from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import Optional, List
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime
from ..database import db_helper
from ..models.shipment import (
    ShipmentCreate, ShipmentResponse, ShipmentUpdate, ShipmentStatus,
    TrackingEvent, TrackingResponse
)
from ..models.user import TokenData, UserRole
from ..utils.auth import get_current_user_token, require_admin
from ..utils.helpers import generate_tracking_number

router = APIRouter(prefix="/api/shipments", tags=["Shipments"])


@router.post("/", response_model=ShipmentResponse)
async def create_shipment(
    shipment: ShipmentCreate,
    token_data: TokenData = Depends(require_admin)
):
    """Create a new shipment (Admin only)."""
    db = db_helper.db
    
    shipment_dict = shipment.model_dump()
    shipment_dict["tracking_number"] = generate_tracking_number()
    shipment_dict["status"] = ShipmentStatus.PENDING
    shipment_dict["tracking_history"] = [{
        "status": ShipmentStatus.PENDING,
        "location": shipment_dict["origin"]["city"],
        "timestamp": datetime.utcnow(),
        "description": "Shipment created",
        "updated_by": token_data.user_id
    }]
    shipment_dict["created_at"] = datetime.utcnow()
    shipment_dict["created_by"] = token_data.user_id
    
    result = await db.shipments.insert_one(shipment_dict)
    shipment_dict["_id"] = str(result.inserted_id)
    
    return ShipmentResponse(**shipment_dict)


@router.get("/", response_model=List[ShipmentResponse])
async def list_shipments(
    skip: int = 0,
    limit: int = 50,
    status: Optional[ShipmentStatus] = None,
    customer_id: Optional[str] = None,
    token_data: TokenData = Depends(get_current_user_token)
):
    """List shipments. Customers see only their shipments, admins see all."""
    db = db_helper.db
    
    query = {}
    
    # Customers can only see their own shipments
    if token_data.role == UserRole.CUSTOMER:
        query["customer_id"] = token_data.user_id
    elif customer_id:
        query["customer_id"] = customer_id
    
    if status:
        query["status"] = status
    
    cursor = db.shipments.find(query).sort("created_at", -1).skip(skip).limit(limit)
    shipments = []
    async for shipment in cursor:
        try:
            shipment_db_id = shipment["_id"]
            if not shipment.get("docket_no"):
                consignment = None
                consignment_id = shipment.get("consignment_id")
                if isinstance(consignment_id, ObjectId):
                    consignment = await db.consignments.find_one({"_id": consignment_id})
                elif isinstance(consignment_id, str):
                    try:
                        consignment = await db.consignments.find_one({"_id": ObjectId(consignment_id)})
                    except InvalidId:
                        consignment = await db.consignments.find_one({"shipment_id": consignment_id})
                if not consignment:
                    consignment = await db.consignments.find_one({"shipment_id": str(shipment_db_id)})
                if consignment:
                    docket_no = consignment.get("docket_no") or consignment.get("consignment_no")
                    if docket_no:
                        shipment["docket_no"] = docket_no
                        await db.shipments.update_one(
                            {"_id": shipment_db_id},
                            {"$set": {"docket_no": docket_no}}
                        )
            shipment["_id"] = str(shipment_db_id)
            shipments.append(ShipmentResponse(**shipment))
        except Exception as e:
            print(f"Skipping invalid shipment {shipment.get('_id', 'unknown')}: {e}")
            continue
    
    return shipments


@router.get("/track/{tracking_number}", response_model=TrackingResponse)
async def track_shipment(tracking_number: str):
    """Track a shipment by tracking number (Public endpoint)."""
    db = db_helper.db

    def _to_tracking_response(shipment_doc: dict) -> TrackingResponse:
        return TrackingResponse(
            tracking_number=shipment_doc["tracking_number"],
            status=shipment_doc["status"],
            origin=shipment_doc["origin"],
            destination=shipment_doc["destination"],
            tracking_history=shipment_doc.get("tracking_history", []),
            estimated_delivery=shipment_doc.get("estimated_delivery")
        )
    
    # Check shipments first
    shipment = await db.shipments.find_one({"tracking_number": tracking_number})
    if shipment:
        return _to_tracking_response(shipment)

    # Also allow direct tracking via docket number
    shipment = await db.shipments.find_one({"docket_no": tracking_number})
    if shipment:
        return _to_tracking_response(shipment)
    
    # Check consignments by consignment number OR docket number
    consignment = await db.consignments.find_one({
        "$or": [
            {"consignment_no": tracking_number},
            {"docket_no": tracking_number}
        ]
    })
    if consignment:
        # Prefer real linked shipment data whenever available
        linked_shipment = None
        shipment_id = consignment.get("shipment_id")

        if isinstance(shipment_id, ObjectId):
            linked_shipment = await db.shipments.find_one({"_id": shipment_id})
        elif isinstance(shipment_id, str) and shipment_id:
            try:
                linked_shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
            except InvalidId:
                linked_shipment = await db.shipments.find_one({"tracking_number": shipment_id})

        if not linked_shipment:
            linked_shipment = await db.shipments.find_one({"docket_no": consignment.get("docket_no")})

        if not linked_shipment:
            linked_shipment = await db.shipments.find_one({"consignment_id": str(consignment.get("_id"))})

        if linked_shipment:
            return _to_tracking_response(linked_shipment)

        # Fallback only when no shipment exists yet
        return TrackingResponse(
            tracking_number=consignment.get("consignment_no", tracking_number),
            status=ShipmentStatus.PENDING,
            origin={
                "name": "RR Enterprise",
                "phone": "",
                "address_line1": "Regional Office",
                "city": "Origin",
                "state": "N/A",
                "pincode": "000000"
            },
            destination={
                "name": consignment.get("name", "Consignee"),
                "phone": "",
                "address_line1": consignment.get("destination", "Delivery Address"),
                "city": consignment.get("destination_city") or consignment.get("destination", "Destination"),
                "state": consignment.get("destination_state", "N/A"),
                "pincode": consignment.get("destination_pincode", "")
            },
            tracking_history=[{
                "status": ShipmentStatus.PENDING,
                "location": "Consignment Desk",
                "timestamp": consignment.get("created_at", datetime.utcnow()),
                "description": f"Consignment {consignment.get('consignment_no', tracking_number)} created and awaiting shipment processing."
            }],
            estimated_delivery=None
        )
    
    raise HTTPException(status_code=404, detail="Shipment not found")


@router.get("/{shipment_id}", response_model=ShipmentResponse)
async def get_shipment(
    shipment_id: str,
    token_data: TokenData = Depends(get_current_user_token)
):
    """Get shipment details."""
    db = db_helper.db
    
    shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if not shipment.get("docket_no"):
        consignment = None
        consignment_id = shipment.get("consignment_id")
        if isinstance(consignment_id, ObjectId):
            consignment = await db.consignments.find_one({"_id": consignment_id})
        elif isinstance(consignment_id, str):
            try:
                consignment = await db.consignments.find_one({"_id": ObjectId(consignment_id)})
            except InvalidId:
                consignment = await db.consignments.find_one({"shipment_id": consignment_id})
        if not consignment:
            consignment = await db.consignments.find_one({"shipment_id": shipment_id})
        if consignment:
            docket_no = consignment.get("docket_no") or consignment.get("consignment_no")
            if docket_no:
                shipment["docket_no"] = docket_no
                await db.shipments.update_one(
                    {"_id": ObjectId(shipment_id)},
                    {"$set": {"docket_no": docket_no}}
                )
    
    # Check access for customers
    if token_data.role == UserRole.CUSTOMER and shipment["customer_id"] != token_data.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    shipment["_id"] = str(shipment["_id"])
    return ShipmentResponse(**shipment)


@router.put("/{shipment_id}/status", response_model=ShipmentResponse)
async def update_shipment_status(
    shipment_id: str,
    new_status: ShipmentStatus,
    location: str,
    description: str = "",
    token_data: TokenData = Depends(require_admin)
):
    """Update shipment status (Admin only)."""
    db = db_helper.db
    
    shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    tracking_event = {
        "status": new_status,
        "location": location,
        "timestamp": datetime.utcnow(),
        "description": description or f"Status updated to {new_status.value}",
        "updated_by": token_data.user_id
    }
    
    await db.shipments.update_one(
        {"_id": ObjectId(shipment_id)},
        {
            "$set": {"status": new_status, "updated_at": datetime.utcnow()},
            "$push": {"tracking_history": tracking_event}
        }
    )
    
    shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    shipment["_id"] = str(shipment["_id"])
    return ShipmentResponse(**shipment)


@router.delete("/{shipment_id}")
async def delete_shipment(
    shipment_id: str,
    token_data: TokenData = Depends(require_admin)
):
    """Delete a shipment (Admin only)."""
    db = db_helper.db
    
    result = await db.shipments.delete_one({"_id": ObjectId(shipment_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    return {"message": "Shipment deleted"}
