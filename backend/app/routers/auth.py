from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from bson import ObjectId
from ..database import db_helper
from ..config import settings
from ..models.user import (
    UserCreate, UserResponse, UserUpdate, UserInDB, 
    UserRole, Token
)
from ..utils.auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user_token, require_admin, require_master_admin
)
from ..models.user import TokenData

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def normalize_user_for_response(user: dict) -> dict:
    """Normalize legacy user documents so they satisfy UserResponse schema."""
    normalized = dict(user)
    normalized.pop("hashed_password", None)
    normalized.pop("password_hash", None)

    if normalized.get("_id") is not None:
        normalized["_id"] = str(normalized["_id"])

    role = normalized.get("role")
    if role == "admin":
        role = UserRole.CHILD_ADMIN.value
    allowed_roles = {r.value for r in UserRole}
    if role not in allowed_roles:
        role = UserRole.CUSTOMER.value
    normalized["role"] = role

    full_name = (normalized.get("full_name") or "").strip()
    if not full_name:
        full_name = (normalized.get("company_name") or "").strip()
    if not full_name and normalized.get("email"):
        full_name = str(normalized["email"]).split("@")[0]
    normalized["full_name"] = full_name or "User"

    normalized.setdefault("address", None)
    normalized.setdefault("city", None)
    normalized.setdefault("state", None)
    normalized.setdefault("pincode", None)
    normalized.setdefault("pricing_rule_id", None)
    normalized.setdefault("permissions", [])
    normalized.setdefault("is_active", True)
    return normalized


@router.post("/register", response_model=UserResponse)
async def register_user(user: UserCreate):
    """Register a new user (customer by default)."""
    try:
        db = db_helper.db
        
        # Check if email exists
        existing = await db.users.find_one({"email": user.email})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Get password and remove from dict, then hash separately
        password = user.password
        
        # Create user document WITHOUT password field
        user_dict = user.model_dump(exclude={"password"})
        
        # Hash password with truncation (bcrypt limit is 72 bytes)
        try:
            hashed_pass = get_password_hash(password)
        except Exception as pwd_err:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Password hashing failed: {str(pwd_err)}"
            )
        
        user_dict["hashed_password"] = hashed_pass
        user_dict["role"] = UserRole.CUSTOMER
        user_dict["permissions"] = []
        now = datetime.utcnow()
        user_dict["created_at"] = now
        user_dict["updated_at"] = now
        user_dict["is_active"] = True
        
        result = await db.users.insert_one(user_dict)
        user_dict["_id"] = str(result.inserted_id)
        
        # Remove sensitive data
        user_dict.pop("hashed_password", None)
        
        return UserResponse(**user_dict)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration error: {str(e)}"
        )


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login and get access token."""
    try:
        db = db_helper.db
        
        user = await db.users.find_one({"email": form_data.username})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        hashed_password = user.get("hashed_password") or user.get("password_hash")
        if not hashed_password or not verify_password(form_data.password, hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled"
            )
        
        role_for_token = user.get("role", UserRole.CUSTOMER.value)
        if role_for_token == "admin":
            role_for_token = UserRole.CHILD_ADMIN.value
        if role_for_token not in {r.value for r in UserRole}:
            role_for_token = UserRole.CUSTOMER.value

        access_token = create_access_token(
            data={"sub": str(user["_id"]), "role": role_for_token}
        )
        return Token(access_token=access_token, token_type="bearer")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login error: {str(e)}"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user(token_data: TokenData = Depends(get_current_user_token)):
    """Get current user profile."""
    try:
        db = db_helper.db
        
        user = await db.users.find_one({"_id": ObjectId(token_data.user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return UserResponse(**normalize_user_for_response(user))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve user: {str(e)}"
        )


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    update: UserUpdate,
    token_data: TokenData = Depends(get_current_user_token)
):
    """Update current user profile."""
    try:
        db = db_helper.db
        
        update_data = {k: v for k, v in update.model_dump().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow()
        
        if update_data:
            await db.users.update_one(
                {"_id": ObjectId(token_data.user_id)},
                {"$set": update_data}
            )
        
        user = await db.users.find_one({"_id": ObjectId(token_data.user_id)})
        return UserResponse(**normalize_user_for_response(user))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user: {str(e)}"
        )


# Admin endpoints for user management
@router.post("/admin/create-user", response_model=UserResponse)
async def create_user_admin(
    user: UserCreate,
    token_data: TokenData = Depends(require_master_admin)
):
    """Create a user with any role (Master Admin only)."""
    try:
        db = db_helper.db
        
        existing = await db.users.find_one({"email": user.email})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        password = user.password
        user_dict = user.model_dump(exclude={"password"})
        user_dict["hashed_password"] = get_password_hash(password)
        user_dict["permissions"] = []
        now = datetime.utcnow()
        user_dict["created_at"] = now
        user_dict["updated_at"] = now
        user_dict["is_active"] = True
        
        result = await db.users.insert_one(user_dict)
        user_dict["_id"] = str(result.inserted_id)
        user_dict.pop("hashed_password", None)
        
        return UserResponse(**user_dict)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )


@router.get("/admin/users", response_model=list[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 50,
    token_data: TokenData = Depends(require_admin)
):
    """List all users (Admin only)."""
    try:
        db = db_helper.db
        
        cursor = db.users.find().skip(skip).limit(limit)
        users = []
        async for user in cursor:
            try:
                users.append(UserResponse(**normalize_user_for_response(user)))
            except Exception as e:
                print(f"Error processing user {user.get('email', 'unknown')}: {e}")
                continue
        
        return users
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve users: {str(e)}"
        )
