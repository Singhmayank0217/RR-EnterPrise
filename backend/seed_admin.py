"""
Seed script to create a master admin user.
Run this once to set up the initial admin account.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime

# Configuration
MONGODB_URL = "mongodb+srv://Task:1234@cluster0.lnxh7gs.mongodb.net/rr_enterprise?retryWrites=true&w=majority"
DB_NAME = "rr_enterprise"

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed_admin():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    
    # Check if admin already exists
    existing = await db.users.find_one({"email": "admin@rrenterprise.com"})
    if existing:
        print("Admin user already exists!")
        print(f"Email: admin@rrenterprise.com")
        client.close()
        return
    
    # Create master admin
    admin_user = {
        "email": "admin@rrenterprise.com",
        "full_name": "Master Admin",
        "phone": "+91 9876543210",
        "company_name": "RR Enterprise",
        "role": "master_admin",
        "is_active": True,
        "hashed_password": pwd_context.hash("admin123"),
        "permissions": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(admin_user)
    print("✅ Master Admin created successfully!")
    print(f"   Email: admin@rrenterprise.com")
    print(f"   Password: admin123")
    print(f"   ID: {result.inserted_id}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_admin())
