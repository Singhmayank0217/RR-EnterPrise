from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import Optional, List
from bson import ObjectId
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
            shipment["_id"] = str(shipment["_id"])
            shipments.append(ShipmentResponse(**shipment))
        except Exception as e:
            print(f"Skipping invalid shipment {shipment.get('_id', 'unknown')}: {e}")
            continue
    
    return shipments


@router.get("/track/{tracking_number}", response_model=TrackingResponse)
async def track_shipment(tracking_number: str):
    """Track a shipment by tracking number (Public endpoint)."""
    db = db_helper.db
    
    # Check shipments first
    shipment = await db.shipments.find_one({"tracking_number": tracking_number})
    if shipment:
        return TrackingResponse(
            tracking_number=shipment["tracking_number"],
            status=shipment["status"],
            origin=shipment["origin"],
            destination=shipment["destination"],
            tracking_history=shipment.get("tracking_history", []),
            estimated_delivery=shipment.get("estimated_delivery")
        )
    
    # Check consignments as fallback
    consignment = await db.consignments.find_one({"consignment_no": tracking_number})
    if consignment:
        # Map consignment to TrackingResponse structure
        return TrackingResponse(
            tracking_number=consignment["consignment_no"],
            status=ShipmentStatus.IN_TRANSIT,
            origin={
                "name": "RR Enterprise",
                "phone": "+91 0000000000",
                "address_line1": "Regional Office",
                "city": "Origin",
                "state": "N/A",
                "pincode": "000000"
            },
            destination={
                "name": consignment["name"],
                "phone": "+91 0000000000",
                "address_line1": "Delivery Address",
                "city": consignment["destination"],
                "state": "N/A",
                "pincode": "000000"
            },
            tracking_history=[{
                "status": ShipmentStatus.IN_TRANSIT,
                "location": "Processing Center",
                "timestamp": consignment["created_at"],
                "description": f"Consignment for {consignment['product_name']} is being processed."
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
