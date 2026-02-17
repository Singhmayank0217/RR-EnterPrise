from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    MASTER_ADMIN = "master_admin"
    CHILD_ADMIN = "child_admin"
    CUSTOMER = "customer"


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    company_name: Optional[str] = None
    address: Optional[str] = None  # For shipment origin
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    pricing_rule_id: Optional[str] = None  # User's assigned pricing rule
    role: UserRole = UserRole.CUSTOMER
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    pricing_rule_id: Optional[str] = None
    is_active: Optional[bool] = None


class UserInDB(UserBase):
    id: str = Field(alias="_id")
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    permissions: List[str] = []

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class UserResponse(UserBase):
    id: str = Field(alias="_id")
    created_at: Optional[datetime] = None
    updated_at: datetime = None
    permissions: List[str] = Field(default_factory=list)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat() if v else None}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[str] = None
    role: Optional[UserRole] = None
