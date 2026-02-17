from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PARTIAL = "partial"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class PaymentMethod(str, Enum):
    CASH = "cash"
    UPI = "upi"
    BANK_TRANSFER = "bank_transfer"
    CREDIT = "credit"  # Customer credit account
    CHEQUE = "cheque"


class InvoiceItem(BaseModel):
    shipment_id: Optional[str] = ""
    tracking_number: Optional[str] = ""
    description: Optional[str] = ""
    weight_kg: Optional[float] = 0
    amount: Optional[float] = 0


class PaymentRecord(BaseModel):
    amount: float
    method: PaymentMethod
    transaction_ref: Optional[str] = None
    payment_date: datetime = Field(default_factory=datetime.utcnow)
    received_by: Optional[str] = None
    notes: Optional[str] = None


class InvoiceBase(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    billing_address: Optional[str] = None


class InvoiceCreate(InvoiceBase):
    shipment_ids: List[str]
    due_date: Optional[date] = None


class InvoiceUpdate(BaseModel):
    due_date: Optional[date] = None
    notes: Optional[str] = None


class InvoiceInDB(InvoiceBase):
    id: str = Field(alias="_id")
    invoice_number: str
    items: List[InvoiceItem] = []
    subtotal: float = 0
    gst_amount: float = 0
    total_amount: float = 0
    amount_paid: float = 0
    balance_due: float = 0
    payment_status: PaymentStatus = PaymentStatus.PENDING
    payments: List[PaymentRecord] = []
    due_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }


class InvoiceResponse(InvoiceBase):
    id: str = Field(alias="_id")
    invoice_number: str
    items: List[InvoiceItem]
    subtotal: float
    gst_amount: float
    total_amount: float
    amount_paid: float
    balance_due: float
    payment_status: Optional[str] = Field(default=PaymentStatus.PENDING)
    payments: List[PaymentRecord] = []
    due_date: Optional[str | date] = None
    created_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


class PaymentCreate(BaseModel):
    invoice_id: str
    amount: float
    method: PaymentMethod
    transaction_ref: Optional[str] = None
    notes: Optional[str] = None
