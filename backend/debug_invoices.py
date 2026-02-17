from pymongo import MongoClient
from app.models.invoice import InvoiceResponse
import traceback
import os
import sys

# Add backend directory to sys.path to resolve app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def debug():
    try:
        client = MongoClient("mongodb://localhost:27017/")
        db = client["rr_enterprise_db"]
        
        count = db.invoices.count_documents({})
        print(f"Total invoices in DB: {count}")
        
        cursor = db.invoices.find({})
        for doc in cursor:
            print(f"\nChecking invoice {doc.get('invoice_number', 'UNKNOWN')} ({doc['_id']})")
            try:
                doc["_id"] = str(doc["_id"])
                # Identify which field causes the error
                InvoiceResponse(**doc)
                print("  [OK] Valid")
            except Exception as e:
                print(f"  [ERROR] Validation failed: {e}")
                # Print specific validation errors
                # traceback.print_exc()

    except Exception as e:
        print(f"Connection/Script Error: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    debug()
