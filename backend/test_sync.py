import asyncio
from app.database import db_helper
from app.routers.consignments import create_consignment, update_consignment
from app.models.consignment import ConsignmentCreate, ConsignmentUpdate
from app.models.user import TokenData, UserRole
from bson import ObjectId

async def test_sync():
    # Mock token data
    token = TokenData(user_id="ADMIN_TEST", role=UserRole.ADMIN, email="admin@test.com")
    
    # 1. Create Consignment
    data = ConsignmentCreate(
        date="2023-10-27",
        name="Sync Test User",
        destination="Original City",
        pieces=1,
        weight=10.0,
        product_name="Test Widget",
        base_rate=100,
        gst=18
    )
    
    print("Creating consignment...")
    consignment = await create_consignment(data, token)
    c_id = consignment.id
    s_id = consignment.shipment_id
    i_id = consignment.invoice_id # ConsignmentResponse might not have invoice_id directly if not in model? 
                                  # Let's check model. ConsignmentResponse has shipment_id. 
                                  # Need to fetch doc to get invoice_id if not in response.
    
    db = db_helper.db
    c_doc = await db.consignments.find_one({"_id": ObjectId(c_id)})
    i_id = c_doc.get("invoice_id")
    
    print(f"Created Consignment: {c_id}")
    print(f"Linked Shipment: {s_id}")
    print(f"Linked Invoice: {i_id}")
    
    # 2. Update Consignment
    print("\nUpdating consignment (New Dest, Weight: 20kg)...")
    update_data = {
        "destination": "New Update City",
        "weight": 20.0,
        "base_rate": 200.0 # Should double price
    }
    
    await update_consignment(c_id, update_data, token)
    
    # 3. Verify Updates
    print("\nVerifying updates...")
    
    # Check Shipment
    shipment = await db.shipments.find_one({"_id": ObjectId(s_id)})
    s_city = shipment["destination"]["city"]
    s_weight = shipment["total_weight"]
    print(f"Shipment City: {s_city} (Expected: New Update City or derived)")
    print(f"Shipment Weight: {s_weight} (Expected: 20.0)")
    
    # Check Invoice
    invoice = await db.invoices.find_one({"_id": ObjectId(i_id)})
    i_subtotal = invoice["subtotal"]
    i_total = invoice["total_amount"]
    print(f"Invoice Subtotal: {i_subtotal} (Expected ~200 + charges)")
    print(f"Invoice Total: {i_total} (Expected ~236 with 18% GST)")
    
    if s_weight == 20.0 and i_subtotal >= 200.0:
        print("\nSUCCESS: Sync working!")
    else:
        print("\nFAILURE: Value mismatch.")

if __name__ == "__main__":
    import sys
    import os
    # Add backend path
    sys.path.append(os.getcwd())
    loop = asyncio.get_event_loop()
    loop.run_until_complete(test_sync())
