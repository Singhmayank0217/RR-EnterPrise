from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ServiceType(str, Enum):
    CARGO = "cargo"
    COURIER = "courier"
    OTHER = "other"


class TransportMode(str, Enum):
    SURFACE = "surface"
    AIR = "air"


class CargoRegion(str, Enum):
    NORTH = "north"
    EAST = "east"
    WEST = "west"
    SOUTH = "south"
    CENTRAL = "central"
    KERALA = "kerala"
    GUWAHATI = "guwahati"
    NORTH_EAST = "north_east"


class CourierZone(str, Enum):
    ZONE_1 = "zone_1"  # Tricity
    ZONE_2 = "zone_2"  # Delhi, Punjab, Haryana
    ZONE_3 = "zone_3"  # UP, HP, Jammu, Rajasthan
    ZONE_4 = "zone_4"  # Rest of India (except Assam)
    ZONE_5 = "zone_5"  # Assam
    ZONE_6 = "zone_6"  # North East


# Delivery partner options
DELIVERY_PARTNERS = [
    "DTDC",
    "Delhivery",
    "BlueDart",
    "FedEx",
    "DHL",
    "Ecom Express",
    "Xpressbees",
    "Shadowfax",
    "Other"
]


class RateCardBase(BaseModel):
    user_id: str  # Client/User reference
    user_name: str  # For display
    delivery_partner: str  # e.g., DTDC, Delhivery
    service_type: ServiceType
    mode: TransportMode
    region: Optional[str] = None  # For Cargo (CargoRegion value)
    zone: Optional[str] = None  # For Courier (CourierZone value)
    base_rate: float = 0
    docket_charge: float = 0
    fov: float = 0  # Freight on Value (0.1 - 0.8)
    fuel_charge: float = 0  # Percentage on invoice value
    gst: float = 18.0  # Percentage (typically 18%)
    odi: float = 0  # Out of Delivery area / ODI charge
    is_active: bool = True


class RateCardCreate(RateCardBase):
    pass


class RateCardUpdate(BaseModel):
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    delivery_partner: Optional[str] = None
    service_type: Optional[ServiceType] = None
    mode: Optional[TransportMode] = None
    region: Optional[str] = None
    zone: Optional[str] = None
    base_rate: Optional[float] = None
    docket_charge: Optional[float] = None
    fov: Optional[float] = None
    fuel_charge: Optional[float] = None
    gst: Optional[float] = None
    odi: Optional[float] = None
    is_active: Optional[bool] = None


class RateCardInDB(RateCardBase):
    id: str = Field(alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class RateCardResponse(RateCardBase):
    id: str = Field(alias="_id")
    created_at: datetime

    class Config:
        populate_by_name = True


class RateCardFetchRequest(BaseModel):
    """Request model for fetching a specific rate card."""
    user_id: str
    delivery_partner: str
    service_type: ServiceType
    mode: TransportMode
    region: Optional[str] = None  # Required for Cargo
    zone: Optional[str] = None  # Required for Courier


class RateCardFetchResponse(BaseModel):
    """Response model with rate card details for consignment creation."""
    found: bool
    rate_card: Optional[RateCardResponse] = None
    message: str = ""
