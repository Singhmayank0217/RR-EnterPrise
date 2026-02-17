from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


class ConsignmentZone(str, Enum):
    LOCAL = "LOCAL"
    ZONAL = "ZONAL"
    METRO = "METRO"
    ROI = "ROI"  # Rest of India
    WEST = "WEST"
    NORTH = "NORTH"
    SOUTH = "SOUTH"
    EAST = "EAST"


class BoxDimensions(BaseModel):
    length: Optional[float] = None
    breadth: Optional[float] = None
    height: Optional[float] = None


class ConsignmentBase(BaseModel):
    date: date
    name: str  # Customer/sender name (display)
    user_id: Optional[str] = None  # Link to user
    destination: str
    destination_city: Optional[str] = None
    destination_state: Optional[str] = None
    destination_pincode: Optional[str] = None
    pieces: int = 1
    weight: float  # in kg
    product_name: str
    invoice_no: Optional[str] = None  # Display
    invoice_id: Optional[str] = None  # Link to invoice
    # Rate card fields
    delivery_partner: Optional[str] = None  # e.g., DTDC, Delhivery
    service_type: Optional[str] = None  # cargo, courier, other
    mode: Optional[str] = None  # surface, air
    region: Optional[str] = None  # For cargo service type
    zone: ConsignmentZone = ConsignmentZone.LOCAL
    courier_zone: Optional[str] = None  # For courier service type (zone_1 to zone_6)
    # Pricing fields (auto-populated from rate card)
    base_rate: float = 0
    docket_charges: float = 0
    oda_charge: float = 0  # Out of Delivery Area / ODI
    fov: float = 0  # Freight on Value
    fuel_charge: float = 0  # Fuel surcharge
    gst: float = 0  # GST amount
    value: float = 0  # Declared value
    rate_card_id: Optional[str] = None  # Reference to the rate card used
    box1_dimensions: Optional[str] = None  # Format: "L*B*H"
    box2_dimensions: Optional[str] = None
    box3_dimensions: Optional[str] = None
    remarks: Optional[str] = None


class ConsignmentCreate(ConsignmentBase):
    pass


class ConsignmentUpdate(BaseModel):
    date: Optional[date] = None
    name: Optional[str] = None
    user_id: Optional[str] = None
    destination: Optional[str] = None
    destination_city: Optional[str] = None
    destination_state: Optional[str] = None
    destination_pincode: Optional[str] = None
    pieces: Optional[int] = None
    weight: Optional[float] = None
    product_name: Optional[str] = None
    invoice_no: Optional[str] = None
    invoice_id: Optional[str] = None
    delivery_partner: Optional[str] = None
    service_type: Optional[str] = None
    mode: Optional[str] = None
    region: Optional[str] = None
    zone: Optional[ConsignmentZone] = None
    courier_zone: Optional[str] = None
    base_rate: Optional[float] = None
    docket_charges: Optional[float] = None
    oda_charge: Optional[float] = None
    fov: Optional[float] = None
    fuel_charge: Optional[float] = None
    gst: Optional[float] = None
    value: Optional[float] = None
    rate_card_id: Optional[str] = None
    box1_dimensions: Optional[str] = None
    box2_dimensions: Optional[str] = None
    box3_dimensions: Optional[str] = None
    remarks: Optional[str] = None


class ConsignmentInDB(ConsignmentBase):
    id: str = Field(alias="_id")
    sr_no: int  # Serial number
    consignment_no: str  # Auto-generated
    shipment_id: Optional[str] = None  # Auto-created shipment
    total: float  # Calculated: base_rate + docket_charges + oda_charge + fov
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }


class ConsignmentResponse(ConsignmentBase):
    id: str = Field(alias="_id")
    sr_no: int
    consignment_no: str
    shipment_id: Optional[str] = None
    total: float
    created_at: datetime

    class Config:
        populate_by_name = True
