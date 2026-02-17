from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from bson import ObjectId
from datetime import datetime
from ..database import db_helper
from ..models.rate_card import (
    RateCardCreate, RateCardResponse, RateCardUpdate,
    RateCardFetchRequest, RateCardFetchResponse,
    ServiceType, TransportMode, CargoRegion, CourierZone,
    DELIVERY_PARTNERS
)
from ..models.user import TokenData
from ..utils.auth import require_admin, require_master_admin

router = APIRouter(prefix="/api/rate-cards", tags=["Rate Cards"])


@router.get("/config")
async def get_rate_card_config():
    """Get configuration options for rate cards (public endpoint)."""
    return {
        "service_types": [{"value": s.value, "label": s.value.title()} for s in ServiceType],
        "transport_modes": [{"value": m.value, "label": m.value.title()} for m in TransportMode],
        "cargo_regions": [
            {"value": "north", "label": "North"},
            {"value": "east", "label": "East"},
            {"value": "west", "label": "West"},
            {"value": "south", "label": "South"},
            {"value": "central", "label": "Central"},
            {"value": "kerala", "label": "Kerala"},
            {"value": "guwahati", "label": "Guwahati"},
            {"value": "north_east", "label": "North East"},
        ],
        "courier_zones": [
            {"value": "zone_1", "label": "Zone 1 - Tricity"},
            {"value": "zone_2", "label": "Zone 2 - Delhi, Punjab, Haryana"},
            {"value": "zone_3", "label": "Zone 3 - UP, HP, Jammu, Rajasthan"},
            {"value": "zone_4", "label": "Zone 4 - Rest of India (except Assam)"},
            {"value": "zone_5", "label": "Zone 5 - Assam"},
            {"value": "zone_6", "label": "Zone 6 - North East"},
        ],
        "delivery_partners": DELIVERY_PARTNERS
    }


@router.post("/", response_model=RateCardResponse)
async def create_rate_card(
    rate_card: RateCardCreate,
    token_data: TokenData = Depends(require_admin)
):
    """Create a new rate card (Admin only)."""
    db = db_helper.db
    
    # Validate service type specific fields
    if rate_card.service_type == ServiceType.CARGO and not rate_card.region:
        raise HTTPException(
            status_code=400,
            detail="Region is required for Cargo service type"
        )
    if rate_card.service_type == ServiceType.COURIER and not rate_card.zone:
        raise HTTPException(
            status_code=400,
            detail="Zone is required for Courier service type"
        )
    
    # Check for duplicate rate card
    query = {
        "user_id": rate_card.user_id,
        "delivery_partner": rate_card.delivery_partner,
        "service_type": rate_card.service_type.value,
        "mode": rate_card.mode.value,
    }
    if rate_card.region:
        query["region"] = rate_card.region
    if rate_card.zone:
        query["zone"] = rate_card.zone
    
    existing = await db.rate_cards.find_one(query)
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A rate card with the same criteria already exists for this user"
        )
    
    # Validate FOV range
    if rate_card.fov < 0 or rate_card.fov > 1:
        raise HTTPException(
            status_code=400,
            detail="FOV must be between 0 and 1 (e.g., 0.1 to 0.8)"
        )
    
    rate_card_dict = rate_card.model_dump()
    rate_card_dict["service_type"] = rate_card.service_type.value
    rate_card_dict["mode"] = rate_card.mode.value
    rate_card_dict["created_at"] = datetime.utcnow()
    rate_card_dict["updated_at"] = datetime.utcnow()
    rate_card_dict["created_by"] = token_data.user_id
    
    result = await db.rate_cards.insert_one(rate_card_dict)
    rate_card_dict["_id"] = str(result.inserted_id)
    
    return RateCardResponse(**rate_card_dict)


@router.get("/", response_model=List[RateCardResponse])
async def list_rate_cards(
    user_id: Optional[str] = None,
    delivery_partner: Optional[str] = None,
    service_type: Optional[ServiceType] = None,
    mode: Optional[TransportMode] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    token_data: TokenData = Depends(require_admin)
):
    """List all rate cards with optional filters (Admin only)."""
    db = db_helper.db
    
    query = {}
    if user_id:
        query["user_id"] = user_id
    if delivery_partner:
        query["delivery_partner"] = delivery_partner
    if service_type:
        query["service_type"] = service_type.value
    if mode:
        query["mode"] = mode.value
    if is_active is not None:
        query["is_active"] = is_active
    
    cursor = db.rate_cards.find(query).sort("created_at", -1).skip(skip).limit(limit)
    rate_cards = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        rate_cards.append(RateCardResponse(**doc))
    
    return rate_cards


@router.get("/user/{user_id}", response_model=List[RateCardResponse])
async def get_rate_cards_for_user(
    user_id: str,
    token_data: TokenData = Depends(require_admin)
):
    """Get all rate cards for a specific user."""
    db = db_helper.db
    
    cursor = db.rate_cards.find({"user_id": user_id, "is_active": True}).sort("created_at", -1)
    rate_cards = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        rate_cards.append(RateCardResponse(**doc))
    
    return rate_cards


@router.get("/fetch", response_model=RateCardFetchResponse)
async def fetch_rate_card(
    user_id: str = Query(..., description="User/Client ID"),
    delivery_partner: str = Query(..., description="Delivery partner name"),
    service_type: ServiceType = Query(..., description="Service type"),
    mode: TransportMode = Query(..., description="Transport mode"),
    region: Optional[str] = Query(None, description="Cargo region"),
    zone: Optional[str] = Query(None, description="Courier zone"),
):
    """Fetch a matching rate card based on criteria (for consignment creation)."""
    db = db_helper.db
    
    # Validate service type specific fields
    if service_type == ServiceType.CARGO and not region:
        return RateCardFetchResponse(
            found=False,
            message="Region is required for Cargo service type"
        )
    if service_type == ServiceType.COURIER and not zone:
        return RateCardFetchResponse(
            found=False,
            message="Zone is required for Courier service type"
        )
    
    # Build query
    query = {
        "user_id": user_id,
        "delivery_partner": delivery_partner,
        "service_type": service_type.value,
        "mode": mode.value,
        "is_active": True
    }
    
    if service_type == ServiceType.CARGO:
        query["region"] = region
    elif service_type == ServiceType.COURIER:
        query["zone"] = zone
    
    # Find matching rate card
    doc = await db.rate_cards.find_one(query)
    
    if not doc:
        return RateCardFetchResponse(
            found=False,
            message=f"No active rate card found for the selected criteria. Please contact admin to create a rate card."
        )
    
    doc["_id"] = str(doc["_id"])
    return RateCardFetchResponse(
        found=True,
        rate_card=RateCardResponse(**doc),
        message="Rate card found"
    )


@router.get("/{rate_card_id}", response_model=RateCardResponse)
async def get_rate_card(
    rate_card_id: str,
    token_data: TokenData = Depends(require_admin)
):
    """Get a specific rate card by ID."""
    db = db_helper.db
    
    doc = await db.rate_cards.find_one({"_id": ObjectId(rate_card_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Rate card not found")
    
    doc["_id"] = str(doc["_id"])
    return RateCardResponse(**doc)


@router.put("/{rate_card_id}", response_model=RateCardResponse)
async def update_rate_card(
    rate_card_id: str,
    update: RateCardUpdate,
    token_data: TokenData = Depends(require_admin)
):
    """Update a rate card (Admin only)."""
    db = db_helper.db
    
    # Validate FOV if provided
    if update.fov is not None and (update.fov < 0 or update.fov > 1):
        raise HTTPException(
            status_code=400,
            detail="FOV must be between 0 and 1 (e.g., 0.1 to 0.8)"
        )
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    
    # Convert enums to string values
    if "service_type" in update_data:
        update_data["service_type"] = update_data["service_type"].value
    if "mode" in update_data:
        update_data["mode"] = update_data["mode"].value
    
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.rate_cards.update_one(
            {"_id": ObjectId(rate_card_id)},
            {"$set": update_data}
        )
    
    doc = await db.rate_cards.find_one({"_id": ObjectId(rate_card_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Rate card not found")
    
    doc["_id"] = str(doc["_id"])
    return RateCardResponse(**doc)


@router.delete("/{rate_card_id}")
async def delete_rate_card(
    rate_card_id: str,
    token_data: TokenData = Depends(require_admin)
):
    """Delete a rate card (Admin only)."""
    db = db_helper.db
    
    result = await db.rate_cards.delete_one({"_id": ObjectId(rate_card_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rate card not found")
    
    return {"message": "Rate card deleted successfully"}


@router.patch("/{rate_card_id}/toggle-status", response_model=RateCardResponse)
async def toggle_rate_card_status(
    rate_card_id: str,
    token_data: TokenData = Depends(require_admin)
):
    """Toggle the active status of a rate card (Admin only)."""
    db = db_helper.db
    
    doc = await db.rate_cards.find_one({"_id": ObjectId(rate_card_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Rate card not found")
    
    new_status = not doc.get("is_active", True)
    
    await db.rate_cards.update_one(
        {"_id": ObjectId(rate_card_id)},
        {"$set": {"is_active": new_status, "updated_at": datetime.utcnow()}}
    )
    
    doc["is_active"] = new_status
    doc["_id"] = str(doc["_id"])
    return RateCardResponse(**doc)
