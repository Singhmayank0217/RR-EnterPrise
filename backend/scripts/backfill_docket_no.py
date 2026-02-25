import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from bson.errors import InvalidId

def _load_env_file() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_env_file()

MONGODB_URL = os.getenv(
    "MONGODB_URL",
    "mongodb+srv://user:pass@cluster.mongodb.net/rr_enterprise?retryWrites=true&w=majority",
)
DB_NAME = os.getenv("DB_NAME", "rr_enterprise")


async def backfill_docket_no() -> None:
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]

    try:
        # 1) Consignments: set docket_no to consignment_no when missing
        consignment_cursor = db.consignments.find({
            "$or": [
                {"docket_no": {"$exists": False}},
                {"docket_no": ""},
                {"docket_no": None},
            ]
        })

        consignment_updates = 0
        async for consignment in consignment_cursor:
            consignment_no = consignment.get("consignment_no")
            if not consignment_no:
                continue
            result = await db.consignments.update_one(
                {"_id": consignment["_id"]},
                {"$set": {"docket_no": consignment_no, "updated_at": datetime.utcnow()}},
            )
            consignment_updates += result.modified_count

        # 2) Shipments: set docket_no from linked consignment when missing
        shipment_cursor = db.shipments.find({
            "$or": [
                {"docket_no": {"$exists": False}},
                {"docket_no": ""},
                {"docket_no": None},
            ]
        })

        shipment_updates = 0
        async for shipment in shipment_cursor:
            docket_no = None
            consignment_id = shipment.get("consignment_id")
            if consignment_id:
                consignment = None
                if isinstance(consignment_id, ObjectId):
                    consignment = await db.consignments.find_one({"_id": consignment_id})
                elif isinstance(consignment_id, str):
                    try:
                        consignment = await db.consignments.find_one({"_id": ObjectId(consignment_id)})
                    except InvalidId:
                        consignment = await db.consignments.find_one({"shipment_id": consignment_id})
                if not consignment:
                    consignment = await db.consignments.find_one({"shipment_id": str(shipment.get("_id"))})
                if consignment:
                    docket_no = consignment.get("docket_no") or consignment.get("consignment_no")

            if not docket_no:
                consignment = await db.consignments.find_one({"shipment_id": str(shipment.get("_id"))})
                if consignment:
                    docket_no = consignment.get("docket_no") or consignment.get("consignment_no")

            if not docket_no:
                # Fallback: match consignment by tracking_number
                tracking_number = shipment.get("tracking_number")
                if tracking_number:
                    consignment = await db.consignments.find_one({"consignment_no": tracking_number})
                    if consignment:
                        docket_no = consignment.get("docket_no") or consignment.get("consignment_no")

            if docket_no:
                result = await db.shipments.update_one(
                    {"_id": shipment["_id"]},
                    {"$set": {"docket_no": docket_no, "updated_at": datetime.utcnow()}},
                )
                shipment_updates += result.modified_count

        # 3) Invoices: fill missing docket_no in line items
        invoice_cursor = db.invoices.find({"items": {"$exists": True, "$ne": []}})

        invoice_updates = 0
        async for invoice in invoice_cursor:
            items = invoice.get("items", [])
            updated = False

            for item in items:
                if item.get("docket_no"):
                    continue

                docket_no = None
                shipment_id = item.get("shipment_id")
                tracking_number = item.get("tracking_number")

                if shipment_id:
                    consignment = await db.consignments.find_one({"shipment_id": shipment_id})
                    if consignment:
                        docket_no = consignment.get("docket_no") or consignment.get("consignment_no")

                if not docket_no and tracking_number:
                    shipment = await db.shipments.find_one({"tracking_number": tracking_number})
                    if shipment:
                        docket_no = shipment.get("docket_no")

                if docket_no:
                    item["docket_no"] = docket_no
                    updated = True

            if updated:
                result = await db.invoices.update_one(
                    {"_id": invoice["_id"]},
                    {"$set": {"items": items, "updated_at": datetime.utcnow()}},
                )
                invoice_updates += result.modified_count

        print("Backfill completed.")
        print(f"Consignments updated: {consignment_updates}")
        print(f"Shipments updated: {shipment_updates}")
        print(f"Invoices updated: {invoice_updates}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(backfill_docket_no())
