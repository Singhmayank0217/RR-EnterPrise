from fastapi import APIRouter, HTTPException, status, Depends, Response
from fastapi.responses import StreamingResponse
from typing import List, Optional
from bson import ObjectId
from datetime import datetime, date
from io import BytesIO
import pandas as pd
from fpdf import FPDF
from ..database import db_helper
from ..models.invoice import (
    InvoiceCreate, InvoiceResponse, InvoiceUpdate, InvoiceItem,
    PaymentCreate, PaymentRecord, PaymentStatus
)
from ..models.user import TokenData, UserRole
from ..utils.auth import get_current_user_token, require_admin
from ..utils.helpers import generate_invoice_number

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])


@router.post("/", response_model=InvoiceResponse)
async def create_invoice(
    invoice: InvoiceCreate,
    token_data: TokenData = Depends(require_admin)
):
    """Create a new invoice from shipments (Admin only)."""
    db = db_helper.db
    
    # Get shipments and calculate totals
    items = []
    subtotal = 0
    
    for shipment_id in invoice.shipment_ids:
        shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
        if not shipment:
            raise HTTPException(status_code=404, detail=f"Shipment {shipment_id} not found")
        
        # Get pricing if available
        amount = shipment.get("pricing", {}).get("total_amount", 0)
        
        items.append(InvoiceItem(
            shipment_id=shipment_id,
            tracking_number=shipment["tracking_number"],
            description=f"{shipment['shipment_type']} - {shipment['origin']['city']} to {shipment['destination']['city']}",
            weight_kg=shipment["weight_kg"],
            amount=amount
        ))
        subtotal += amount
    
    gst_amount = subtotal * 0.18
    total_amount = subtotal + gst_amount
    
    invoice_dict = invoice.model_dump()
    invoice_dict["invoice_number"] = generate_invoice_number()
    invoice_dict["items"] = [item.model_dump() for item in items]
    invoice_dict["subtotal"] = round(subtotal, 2)
    invoice_dict["gst_amount"] = round(gst_amount, 2)
    invoice_dict["total_amount"] = round(total_amount, 2)
    invoice_dict["amount_paid"] = 0
    invoice_dict["balance_due"] = round(total_amount, 2)
    invoice_dict["payment_status"] = PaymentStatus.PENDING
    invoice_dict["payments"] = []
    invoice_dict["created_at"] = datetime.utcnow()
    invoice_dict["created_by"] = token_data.user_id
    
    if invoice.due_date:
        invoice_dict["due_date"] = invoice.due_date.isoformat()
    
    result = await db.invoices.insert_one(invoice_dict)
    invoice_dict["_id"] = str(result.inserted_id)
    
    # Update shipments with invoice_id
    for shipment_id in invoice.shipment_ids:
        await db.shipments.update_one(
            {"_id": ObjectId(shipment_id)},
            {"$set": {"invoice_id": str(result.inserted_id)}}
        )
    
    return InvoiceResponse(**invoice_dict)


@router.get("/", response_model=List[InvoiceResponse])
async def list_invoices(
    skip: int = 0,
    limit: int = 50,
    status: Optional[PaymentStatus] = None,
    customer_id: Optional[str] = None,
    token_data: TokenData = Depends(get_current_user_token)
):
    """List invoices."""
    db = db_helper.db
    
    query = {}
    
    # Customers see only their invoices
    if token_data.role == UserRole.CUSTOMER:
        query["customer_id"] = token_data.user_id
    elif customer_id:
        query["customer_id"] = customer_id
    
    if status:
        query["payment_status"] = status
    
    cursor = db.invoices.find(query).sort("created_at", -1).skip(skip).limit(limit)
    invoices = []
    
    async for inv in cursor:
        try:
            inv["_id"] = str(inv["_id"])
            invoices.append(InvoiceResponse(**inv))
        except Exception as e:
            print(f"Skipping invalid invoice {inv.get('_id', 'unknown')}: {e}")
            continue
    
    return invoices


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: str,
    token_data: TokenData = Depends(get_current_user_token)
):
    """Get invoice details."""
    db = db_helper.db
    
    invoice = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Check access for customers
    if token_data.role == UserRole.CUSTOMER and invoice["customer_id"] != token_data.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    invoice["_id"] = str(invoice["_id"])
    return InvoiceResponse(**invoice)


@router.post("/{invoice_id}/payment", response_model=InvoiceResponse)
async def add_payment(
    invoice_id: str,
    payment: PaymentCreate,
    token_data: TokenData = Depends(require_admin)
):
    """Add a payment to an invoice (Admin only)."""
    db = db_helper.db
    
    invoice = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    payment_record = PaymentRecord(
        amount=payment.amount,
        method=payment.method,
        transaction_ref=payment.transaction_ref,
        payment_date=datetime.utcnow(),
        received_by=token_data.user_id,
        notes=payment.notes
    )
    
    new_amount_paid = invoice["amount_paid"] + payment.amount
    new_balance = invoice["total_amount"] - new_amount_paid
    
    # Determine payment status
    if new_balance <= 0:
        new_status = PaymentStatus.PAID
        new_balance = 0
    elif new_amount_paid > 0:
        new_status = PaymentStatus.PARTIAL
    else:
        new_status = PaymentStatus.PENDING
    
    await db.invoices.update_one(
        {"_id": ObjectId(invoice_id)},
        {
            "$push": {"payments": payment_record.model_dump()},
            "$set": {
                "amount_paid": round(new_amount_paid, 2),
                "balance_due": round(new_balance, 2),
                "payment_status": new_status,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    invoice = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    invoice["_id"] = str(invoice["_id"])
    return InvoiceResponse(**invoice)


@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: str,
    token_data: TokenData = Depends(get_current_user_token)
):
    """Download invoice as PDF."""
    db = db_helper.db
    
    invoice = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Check access for customers
    if token_data.role == UserRole.CUSTOMER and invoice["customer_id"] != token_data.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Generate PDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", "B", 16)
    pdf.cell(0, 10, "RR Enterprise Logistics", ln=True, align="C")
    pdf.set_font("Arial", "", 12)
    pdf.cell(0, 10, f"Invoice: {invoice['invoice_number']}", ln=True)
    pdf.cell(0, 8, f"Customer: {invoice['customer_name']}", ln=True)
    pdf.cell(0, 8, f"Date: {invoice['created_at'][:10]}", ln=True)
    pdf.ln(10)
    
    # Items table header
    pdf.set_font("Arial", "B", 10)
    pdf.cell(60, 8, "Tracking #", 1)
    pdf.cell(80, 8, "Description", 1)
    pdf.cell(25, 8, "Weight", 1)
    pdf.cell(25, 8, "Amount", 1, ln=True)
    
    # Items
    pdf.set_font("Arial", "", 10)
    for item in invoice.get("items", []):
        pdf.cell(60, 8, item["tracking_number"], 1)
        pdf.cell(80, 8, item["description"][:35], 1)
        pdf.cell(25, 8, f"{item['weight_kg']} kg", 1)
        pdf.cell(25, 8, f"Rs.{item['amount']}", 1, ln=True)
    
    pdf.ln(5)
    pdf.set_font("Arial", "B", 10)
    pdf.cell(140, 8, "Subtotal:", align="R")
    pdf.cell(50, 8, f"Rs.{invoice['subtotal']}", ln=True)
    pdf.cell(140, 8, "GST (18%):", align="R")
    pdf.cell(50, 8, f"Rs.{invoice['gst_amount']}", ln=True)
    pdf.cell(140, 8, "Total:", align="R")
    pdf.cell(50, 8, f"Rs.{invoice['total_amount']}", ln=True)
    pdf.cell(140, 8, "Amount Paid:", align="R")
    pdf.cell(50, 8, f"Rs.{invoice['amount_paid']}", ln=True)
    pdf.cell(140, 8, "Balance Due:", align="R")
    pdf.cell(50, 8, f"Rs.{invoice['balance_due']}", ln=True)
    
    pdf_bytes = pdf.output()
    
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=invoice_{invoice['invoice_number']}.pdf"}
    )


@router.get("/{invoice_id}/excel")
async def download_invoice_excel(
    invoice_id: str,
    token_data: TokenData = Depends(get_current_user_token)
):
    """Download invoice as Excel."""
    db = db_helper.db
    
    invoice = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Check access for customers
    if token_data.role == UserRole.CUSTOMER and invoice["customer_id"] != token_data.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Create DataFrame
    items_data = []
    for item in invoice.get("items", []):
        items_data.append({
            "Tracking Number": item["tracking_number"],
            "Description": item["description"],
            "Weight (kg)": item["weight_kg"],
            "Amount (Rs.)": item["amount"]
        })
    
    df = pd.DataFrame(items_data)
    
    # Add summary rows
    summary_df = pd.DataFrame([
        {"Tracking Number": "", "Description": "Subtotal", "Weight (kg)": "", "Amount (Rs.)": invoice["subtotal"]},
        {"Tracking Number": "", "Description": "GST (18%)", "Weight (kg)": "", "Amount (Rs.)": invoice["gst_amount"]},
        {"Tracking Number": "", "Description": "Total", "Weight (kg)": "", "Amount (Rs.)": invoice["total_amount"]},
    ])
    
    df = pd.concat([df, summary_df], ignore_index=True)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Invoice')
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=invoice_{invoice['invoice_number']}.xlsx"}
    )
