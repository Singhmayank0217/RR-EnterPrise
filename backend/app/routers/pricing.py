from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from bson import ObjectId
from datetime import datetime
from ..database import db_helper
from ..models.pricing import (
    PricingRuleCreate, PricingRuleResponse, PricingRuleUpdate,
    PriceCalculationRequest, PriceCalculationResponse, PricingZone
)
from ..models.user import TokenData
from ..utils.auth import require_admin, require_master_admin
from ..utils.helpers import determine_pricing_zone, calculate_estimated_days

router = APIRouter(prefix="/api/pricing", tags=["Pricing"])


@router.post("/calculate", response_model=PriceCalculationResponse)
async def calculate_price(request: PriceCalculationRequest):
    """Calculate shipping price (Public endpoint)."""
    db = db_helper.db
    
    # Determine zone
    zone = determine_pricing_zone(request.origin_pincode, request.destination_pincode)
    
    # Find matching pricing rule
    rule = await db.pricing_rules.find_one({
        "zone": zone,
        "shipment_type": request.shipment_type,
        "service_type": request.service_type,
        "is_active": True
    })
    
    # Fallback to default pricing if no rule found
    if not rule:
        rule = {
            "base_rate": 50,
            "per_kg_rate": 30,
            "fuel_surcharge_percent": 15,
            "gst_percent": 18,
            "min_weight_kg": 0.5
        }
    
    # Calculate charges
    chargeable_weight = max(request.weight_kg, rule.get("min_weight_kg", 0.5))
    base_amount = rule["base_rate"]
    weight_charges = chargeable_weight * rule["per_kg_rate"]
    subtotal = base_amount + weight_charges
    
    fuel_surcharge = subtotal * (rule.get("fuel_surcharge_percent", 0) / 100)
    
    # Insurance (optional, 1% of declared value)
    insurance_amount = 0
    if request.declared_value and request.declared_value > 5000:
        insurance_amount = request.declared_value * 0.01
    
    pre_tax = subtotal + fuel_surcharge + insurance_amount
    gst_amount = pre_tax * (rule.get("gst_percent", 18) / 100)
    total_amount = pre_tax + gst_amount
    
    estimated_days = calculate_estimated_days(zone, request.service_type)
    
    return PriceCalculationResponse(
        base_amount=round(base_amount, 2),
        weight_charges=round(weight_charges, 2),
        fuel_surcharge=round(fuel_surcharge, 2),
        gst_amount=round(gst_amount, 2),
        insurance_amount=round(insurance_amount, 2),
        total_amount=round(total_amount, 2),
        zone=PricingZone(zone),
        estimated_days=estimated_days,
        breakdown={
            "chargeable_weight_kg": chargeable_weight,
            "base_rate": rule["base_rate"],
            "per_kg_rate": rule["per_kg_rate"],
            "fuel_surcharge_percent": rule.get("fuel_surcharge_percent", 0),
            "gst_percent": rule.get("gst_percent", 18)
        }
    )


@router.post("/rules", response_model=PricingRuleResponse)
async def create_pricing_rule(
    rule: PricingRuleCreate,
    token_data: TokenData = Depends(require_master_admin)
):
    """Create a new pricing rule (Master Admin only)."""
    db = db_helper.db
    
    rule_dict = rule.model_dump()
    rule_dict["created_at"] = datetime.utcnow()
    rule_dict["created_by"] = token_data.user_id
    
    result = await db.pricing_rules.insert_one(rule_dict)
    rule_dict["_id"] = str(result.inserted_id)
    
    return PricingRuleResponse(**rule_dict)


@router.get("/rules", response_model=List[PricingRuleResponse])
async def list_pricing_rules(
    token_data: TokenData = Depends(require_admin)
):
    """List all pricing rules (Admin only)."""
    db = db_helper.db
    
    cursor = db.pricing_rules.find()
    rules = []
    async for rule in cursor:
        rule["_id"] = str(rule["_id"])
        rules.append(PricingRuleResponse(**rule))
    
    return rules


@router.put("/rules/{rule_id}", response_model=PricingRuleResponse)
async def update_pricing_rule(
    rule_id: str,
    update: PricingRuleUpdate,
    token_data: TokenData = Depends(require_master_admin)
):
    """Update a pricing rule (Master Admin only)."""
    db = db_helper.db
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.pricing_rules.update_one(
            {"_id": ObjectId(rule_id)},
            {"$set": update_data}
        )
    
    rule = await db.pricing_rules.find_one({"_id": ObjectId(rule_id)})
    if not rule:
        raise HTTPException(status_code=404, detail="Pricing rule not found")
    
    rule["_id"] = str(rule["_id"])
    return PricingRuleResponse(**rule)


@router.delete("/rules/{rule_id}")
async def delete_pricing_rule(
    rule_id: str,
    token_data: TokenData = Depends(require_master_admin)
):
    """Delete a pricing rule (Master Admin only)."""
    db = db_helper.db
    
    result = await db.pricing_rules.delete_one({"_id": ObjectId(rule_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pricing rule not found")
    
    return {"message": "Pricing rule deleted"}
