from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ShipmentStatus(str, Enum):
    PENDING = "pending"
    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    RETURNED = "returned"


class ShipmentType(str, Enum):
    DOCUMENT = "document"
    PARCEL = "parcel"
    FREIGHT = "freight"
    EXPRESS = "express"


class Address(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = "India"


class TrackingEvent(BaseModel):
    status: ShipmentStatus
    location: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    description: str
    updated_by: Optional[str] = None


class ShipmentBase(BaseModel):
    shipment_type: ShipmentType
    origin: Address
    destination: Address
    weight_kg: float
    dimensions: Optional[dict] = None  # {length, width, height in cm}
    declared_value: Optional[float] = None
    description: Optional[str] = None
    special_instructions: Optional[str] = None


class ShipmentCreate(ShipmentBase):
    customer_id: str


class ShipmentUpdate(BaseModel):
    status: Optional[ShipmentStatus] = None
    weight_kg: Optional[float] = None
    declared_value: Optional[float] = None
    special_instructions: Optional[str] = None


class ShipmentInDB(ShipmentBase):
    id: str = Field(alias="_id")
    tracking_number: str
    customer_id: Optional[str] = None
    status: ShipmentStatus = ShipmentStatus.PENDING
    tracking_history: List[TrackingEvent] = []
    pricing: Optional[dict] = None  # Calculated pricing details
    invoice_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class ShipmentResponse(ShipmentBase):
    id: str = Field(alias="_id")
    tracking_number: str
    customer_id: Optional[str] = None
    origin: Optional[dict] = None
    destination: Optional[dict] = None
    status: Optional[str] = None
    created_at: Optional[datetime | str] = None

    class Config:
        populate_by_name = True


class TrackingResponse(BaseModel):
    tracking_number: str
    status: ShipmentStatus
    origin: Address
    destination: Address
    tracking_history: List[TrackingEvent]
    estimated_delivery: Optional[datetime] = None
