from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class PricingZone(str, Enum):
    LOCAL = "local"           # Within city
    ZONAL = "zonal"           # Within state
    METRO = "metro"           # Metro to metro
    REST_OF_INDIA = "roi"     # Inter-state
    SPECIAL = "special"       # Special zones (NE, J&K, etc.)


class ServiceType(str, Enum):
    STANDARD = "standard"
    EXPRESS = "express"
    OVERNIGHT = "overnight"
    SAME_DAY = "same_day"


class PricingRuleBase(BaseModel):
    name: str
    zone: PricingZone
    shipment_type: str  # document, parcel, freight
    service_type: ServiceType
    base_rate: float
    per_kg_rate: float
    min_weight_kg: float = 0.5
    max_weight_kg: Optional[float] = None
    fuel_surcharge_percent: float = 0
    gst_percent: float = 18.0
    is_active: bool = True


class PricingRuleCreate(PricingRuleBase):
    pass


class PricingRuleUpdate(BaseModel):
    name: Optional[str] = None
    base_rate: Optional[float] = None
    per_kg_rate: Optional[float] = None
    fuel_surcharge_percent: Optional[float] = None
    is_active: Optional[bool] = None


class PricingRuleInDB(PricingRuleBase):
    id: str = Field(alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class PricingRuleResponse(PricingRuleBase):
    id: str = Field(alias="_id")
    created_at: datetime

    class Config:
        populate_by_name = True


class PriceCalculationRequest(BaseModel):
    origin_pincode: str
    destination_pincode: str
    weight_kg: float
    shipment_type: str
    service_type: ServiceType = ServiceType.STANDARD
    declared_value: Optional[float] = None


class PriceCalculationResponse(BaseModel):
    base_amount: float
    weight_charges: float
    fuel_surcharge: float
    gst_amount: float
    insurance_amount: float = 0
    total_amount: float
    zone: PricingZone
    estimated_days: int
    breakdown: dict
