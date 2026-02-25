from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from typing import List, Optional
from bson import ObjectId
from datetime import datetime
from io import BytesIO

import pandas as pd
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, HRFlowable
)
from reportlab.platypus import KeepTogether

from ..database import db_helper
from ..models.invoice import InvoiceResponse, PaymentCreate, PaymentRecord, PaymentMethod, PaymentStatus
from ..models.user import TokenData
from ..utils.auth import require_admin

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])


# ─────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────

def _fix_doc(doc: dict) -> dict:
    """Convert ObjectId → str and ensure required defaults."""
    doc["_id"] = str(doc["_id"])
    doc.setdefault("items", [])
    doc.setdefault("payments", [])
    doc.setdefault("subtotal", 0)
    doc.setdefault("gst_amount", 0)
    doc.setdefault("total_amount", 0)
    doc.setdefault("amount_paid", 0)
    doc.setdefault("balance_due", 0)
    doc.setdefault("payment_status", PaymentStatus.PENDING.value)
    doc.setdefault("customer_name", "")
    doc.setdefault("invoice_number", "")
    return doc


async def _enrich_items_with_docket(db, doc: dict) -> dict:
    """Fill missing docket numbers on invoice items from consignments/shipments."""
    items = doc.get("items", []) or []
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
        await db.invoices.update_one(
            {"_id": ObjectId(doc["_id"])},
            {"$set": {"items": items, "updated_at": datetime.utcnow()}}
        )
        doc["items"] = items

    return doc


# ─────────────────────────────────────────────
#  CRUD
# ─────────────────────────────────────────────

@router.get("/", response_model=List[InvoiceResponse])
async def list_invoices(
    customer_id: Optional[str] = None,
    payment_status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    token_data: TokenData = Depends(require_admin),
):
    """List all invoices with optional filters (Admin only)."""
    db = db_helper.db
    query: dict = {}
    if customer_id:
        query["customer_id"] = customer_id
    if payment_status:
        query["payment_status"] = payment_status

    cursor = db.invoices.find(query).sort("created_at", -1).skip(skip).limit(limit)
    result = []
    async for doc in cursor:
        try:
            fixed = _fix_doc(doc)
            fixed = await _enrich_items_with_docket(db, fixed)
            result.append(InvoiceResponse(**fixed))
        except Exception as e:
            print(f"Skipping invoice {doc.get('_id')}: {e}")
    return result


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: str,
    token_data: TokenData = Depends(require_admin),
):
    """Get a single invoice by ID."""
    db = db_helper.db
    doc = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    fixed = _fix_doc(doc)
    fixed = await _enrich_items_with_docket(db, fixed)
    return InvoiceResponse(**fixed)


@router.post("/{invoice_id}/payment")
async def add_payment(
    invoice_id: str,
    payment: PaymentCreate,
    token_data: TokenData = Depends(require_admin),
):
    """Record a payment against an invoice."""
    db = db_helper.db
    doc = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")

    balance_due = doc.get("balance_due", 0)
    if payment.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be positive")
    if payment.amount > balance_due + 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Payment ₹{payment.amount:.2f} exceeds balance due ₹{balance_due:.2f}",
        )

    payment_record = {
        "amount": payment.amount,
        "method": payment.method.value if hasattr(payment.method, "value") else payment.method,
        "transaction_ref": payment.transaction_ref or "",
        "payment_date": datetime.utcnow(),
        "received_by": token_data.user_id,
        "notes": payment.notes or "",
    }

    new_paid = doc.get("amount_paid", 0) + payment.amount
    new_balance = doc.get("total_amount", 0) - new_paid
    new_status = (
        PaymentStatus.PAID.value
        if new_balance <= 0.01
        else PaymentStatus.PARTIAL.value
    )

    await db.invoices.update_one(
        {"_id": ObjectId(invoice_id)},
        {
            "$push": {"payments": payment_record},
            "$set": {
                "amount_paid": round(new_paid, 2),
                "balance_due": round(max(new_balance, 0), 2),
                "payment_status": new_status,
                "updated_at": datetime.utcnow(),
            },
        },
    )
    return {"message": "Payment recorded", "new_status": new_status}


# ─────────────────────────────────────────────
#  PDF Download  (reportlab)
# ─────────────────────────────────────────────

def _build_pdf(invoice: dict) -> BytesIO:
    """Generate a professional A4 invoice PDF."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    W, H = A4
    usable_w = W - 30 * mm

    styles = getSampleStyleSheet()
    normal = styles["Normal"]

    # Custom styles
    title_style = ParagraphStyle(
        "InvTitle",
        parent=normal,
        fontSize=22,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=2,
    )
    sub_style = ParagraphStyle(
        "Sub",
        parent=normal,
        fontSize=9,
        textColor=colors.HexColor("#64748b"),
    )
    label_style = ParagraphStyle(
        "Label",
        parent=normal,
        fontSize=8,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#64748b"),
        spaceAfter=1,
    )
    value_style = ParagraphStyle(
        "Value",
        parent=normal,
        fontSize=10,
        textColor=colors.HexColor("#1e293b"),
    )
    right_style = ParagraphStyle(
        "Right",
        parent=normal,
        fontSize=10,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#1e293b"),
    )
    center_style = ParagraphStyle(
        "Center",
        parent=normal,
        fontSize=9,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#64748b"),
    )

    story = []

    # ── Header ──────────────────────────────────────────────────────────
    header_data = [
        [
            Paragraph("<b>RR Enterprise</b>", title_style),
            Paragraph(
                f"<b>INVOICE</b><br/>"
                f"<font color='#6366f1' size=13>{invoice.get('invoice_number', '')}</font>",
                ParagraphStyle("InvNum", parent=normal, fontSize=11,
                               fontName="Helvetica-Bold", alignment=TA_RIGHT,
                               textColor=colors.HexColor("#1e293b")),
            ),
        ]
    ]
    header_table = Table(header_data, colWidths=[usable_w * 0.55, usable_w * 0.45])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    story.append(header_table)

    story.append(Paragraph("Logistics & Courier Services", sub_style))
    story.append(Spacer(1, 3 * mm))
    story.append(HRFlowable(width="100%", thickness=1.5,
                             color=colors.HexColor("#6366f1"), spaceAfter=4 * mm))

    # ── Bill To / Invoice Details ────────────────────────────────────────
    created_at = invoice.get("created_at", "")
    if isinstance(created_at, datetime):
        created_at = created_at.strftime("%d %b %Y")
    elif isinstance(created_at, str) and "T" in created_at:
        try:
            created_at = datetime.fromisoformat(created_at.split(".")[0]).strftime("%d %b %Y")
        except Exception:
            pass

    due_date = invoice.get("due_date", "")
    if isinstance(due_date, str) and "T" in due_date:
        try:
            due_date = datetime.fromisoformat(due_date.split(".")[0]).strftime("%d %b %Y")
        except Exception:
            pass

    status = invoice.get("payment_status", "pending").upper()
    status_color = {
        "PAID": "#16a34a",
        "PARTIAL": "#d97706",
        "PENDING": "#dc2626",
        "OVERDUE": "#dc2626",
    }.get(status, "#64748b")

    meta_data = [
        [
            # Left – Bill To
            Table(
                [
                    [Paragraph("BILL TO", label_style)],
                    [Paragraph(f"<b>{invoice.get('customer_name', '')}</b>",
                               ParagraphStyle("BT", parent=normal, fontSize=11,
                                              fontName="Helvetica-Bold",
                                              textColor=colors.HexColor("#1e293b")))],
                    [Paragraph(invoice.get("customer_email", "") or "", sub_style)],
                    [Paragraph(invoice.get("billing_address", "") or "", sub_style)],
                ],
                colWidths=[usable_w * 0.5],
                style=[("LEFTPADDING", (0, 0), (-1, -1), 0),
                       ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                       ("TOPPADDING", (0, 0), (-1, -1), 1),
                       ("BOTTOMPADDING", (0, 0), (-1, -1), 1)],
            ),
            # Right – Invoice meta
            Table(
                [
                    [Paragraph("Date", label_style),
                     Paragraph(str(created_at), right_style)],
                    [Paragraph("Due Date", label_style),
                     Paragraph(str(due_date) if due_date else "—", right_style)],
                    [Paragraph("Status", label_style),
                     Paragraph(
                         f"<font color='{status_color}'><b>{status}</b></font>",
                         right_style,
                     )],
                ],
                colWidths=[usable_w * 0.2, usable_w * 0.3],
                style=[("LEFTPADDING", (0, 0), (-1, -1), 2),
                       ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                       ("TOPPADDING", (0, 0), (-1, -1), 2),
                       ("BOTTOMPADDING", (0, 0), (-1, -1), 2)],
            ),
        ]
    ]
    meta_table = Table(meta_data, colWidths=[usable_w * 0.5, usable_w * 0.5])
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 5 * mm))

    # ── Line Items Table ─────────────────────────────────────────────────
    col_w = [usable_w * 0.05, usable_w * 0.37, usable_w * 0.14,
             usable_w * 0.12, usable_w * 0.14, usable_w * 0.18]
    item_header = ["#", "Description", "Docket No.", "Weight (kg)", "Tracking No.", "Amount (₹)"]
    item_rows = [item_header]

    items = invoice.get("items", [])
    for i, item in enumerate(items, 1):
        item_rows.append([
            str(i),
            item.get("description", ""),
            item.get("docket_no", "—") or "—",
            f"{item.get('weight_kg', 0):.2f}",
            item.get("tracking_number", "—"),
            f"₹{item.get('amount', 0):,.2f}",
        ])

    if not items:
        item_rows.append(["—", "No items", "—", "—", "—", "—"])

    item_table = Table(item_rows, colWidths=col_w, repeatRows=1)
    item_table.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        # Body
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("TOPPADDING", (0, 1), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ALIGN", (0, 1), (0, -1), "CENTER"),
        ("ALIGN", (2, 1), (4, -1), "RIGHT"),
        ("ALIGN", (3, 1), (3, -1), "CENTER"),
        # Alternating rows
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.HexColor("#f8fafc"), colors.white]),
        # Grid
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("LINEBELOW", (0, 0), (-1, 0), 1.5, colors.HexColor("#6366f1")),
    ]))
    story.append(item_table)
    story.append(Spacer(1, 5 * mm))

    # ── Totals ───────────────────────────────────────────────────────────
    subtotal = invoice.get("subtotal", 0)
    gst_amount = invoice.get("gst_amount", 0)
    total_amount = invoice.get("total_amount", 0)
    amount_paid = invoice.get("amount_paid", 0)
    balance_due = invoice.get("balance_due", 0)

    totals_data = [
        ["Subtotal", f"₹{subtotal:,.2f}"],
        ["GST", f"₹{gst_amount:,.2f}"],
        ["", ""],
        ["Total", f"₹{total_amount:,.2f}"],
        ["Amount Paid", f"₹{amount_paid:,.2f}"],
        ["Balance Due", f"₹{balance_due:,.2f}"],
    ]
    totals_table = Table(
        totals_data,
        colWidths=[usable_w * 0.75, usable_w * 0.25],
    )
    totals_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        # Separator before Total
        ("LINEABOVE", (0, 3), (-1, 3), 1, colors.HexColor("#6366f1")),
        ("FONTNAME", (0, 3), (-1, 3), "Helvetica-Bold"),
        ("FONTSIZE", (0, 3), (-1, 3), 11),
        # Balance Due highlight
        ("BACKGROUND", (0, 5), (-1, 5), colors.HexColor("#fef2f2")),
        ("TEXTCOLOR", (0, 5), (-1, 5), colors.HexColor("#dc2626")),
        ("FONTNAME", (0, 5), (-1, 5), "Helvetica-Bold"),
        ("FONTSIZE", (0, 5), (-1, 5), 11),
        # Paid highlight
        ("TEXTCOLOR", (0, 4), (-1, 4), colors.HexColor("#16a34a")),
        # Empty row
        ("TOPPADDING", (0, 2), (-1, 2), 0),
        ("BOTTOMPADDING", (0, 2), (-1, 2), 0),
    ]))
    story.append(totals_table)

    # ── Payment History ──────────────────────────────────────────────────
    payments = invoice.get("payments", [])
    if payments:
        story.append(Spacer(1, 5 * mm))
        story.append(HRFlowable(width="100%", thickness=0.5,
                                 color=colors.HexColor("#e2e8f0"), spaceAfter=3 * mm))
        story.append(Paragraph("Payment History", ParagraphStyle(
            "PH", parent=normal, fontSize=10, fontName="Helvetica-Bold",
            textColor=colors.HexColor("#1e293b"), spaceAfter=3)))

        pay_rows = [["Date", "Method", "Reference", "Amount (₹)"]]
        for p in payments:
            pay_date = p.get("payment_date", "")
            if isinstance(pay_date, datetime):
                pay_date = pay_date.strftime("%d %b %Y")
            elif isinstance(pay_date, str) and "T" in pay_date:
                try:
                    pay_date = datetime.fromisoformat(pay_date.split(".")[0]).strftime("%d %b %Y")
                except Exception:
                    pass
            pay_rows.append([
                str(pay_date),
                str(p.get("method", "")).replace("_", " ").title(),
                p.get("transaction_ref", "—") or "—",
                f"₹{p.get('amount', 0):,.2f}",
            ])

        pay_col_w = [usable_w * 0.2, usable_w * 0.2, usable_w * 0.35, usable_w * 0.25]
        pay_table = Table(pay_rows, colWidths=pay_col_w, repeatRows=1)
        pay_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("ALIGN", (3, 0), (3, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ]))
        story.append(pay_table)

    # ── Notes ────────────────────────────────────────────────────────────
    notes = invoice.get("notes", "")
    if notes:
        story.append(Spacer(1, 5 * mm))
        story.append(Paragraph("Notes", label_style))
        story.append(Paragraph(notes, sub_style))

    # ── Footer ───────────────────────────────────────────────────────────
    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5,
                             color=colors.HexColor("#e2e8f0"), spaceAfter=3 * mm))
    story.append(Paragraph(
        "Thank you for your business! For queries, contact us at support@rrenterprise.com",
        center_style,
    ))

    doc.build(story)
    buf.seek(0)
    return buf


@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: str,
    token_data: TokenData = Depends(require_admin),
):
    """Download invoice as a professionally formatted PDF."""
    db = db_helper.db
    doc = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")

    doc = _fix_doc(doc)
    doc = await _enrich_items_with_docket(db, doc)
    buf = _build_pdf(doc)
    filename = f"invoice_{doc.get('invoice_number', invoice_id)}.pdf"

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─────────────────────────────────────────────
#  Excel Download
# ─────────────────────────────────────────────

@router.get("/{invoice_id}/excel")
async def download_invoice_excel(
    invoice_id: str,
    token_data: TokenData = Depends(require_admin),
):
    """Download invoice as Excel."""
    db = db_helper.db
    doc = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")

    doc = _fix_doc(doc)
    doc = await _enrich_items_with_docket(db, doc)

    # Sheet 1 – Invoice Summary
    summary = {
        "Invoice Number": [doc.get("invoice_number", "")],
        "Customer": [doc.get("customer_name", "")],
        "Email": [doc.get("customer_email", "")],
        "Billing Address": [doc.get("billing_address", "")],
        "Subtotal (₹)": [doc.get("subtotal", 0)],
        "GST (₹)": [doc.get("gst_amount", 0)],
        "Total (₹)": [doc.get("total_amount", 0)],
        "Amount Paid (₹)": [doc.get("amount_paid", 0)],
        "Balance Due (₹)": [doc.get("balance_due", 0)],
        "Status": [doc.get("payment_status", "").upper()],
        "Due Date": [doc.get("due_date", "")],
        "Notes": [doc.get("notes", "")],
    }
    df_summary = pd.DataFrame(summary).T.reset_index()
    df_summary.columns = ["Field", "Value"]

    # Sheet 2 – Line Items
    items = doc.get("items", [])
    df_items = pd.DataFrame([{
        "Description": i.get("description", ""),
        "Docket No": i.get("docket_no", ""),
        "Tracking Number": i.get("tracking_number", ""),
        "Weight (kg)": i.get("weight_kg", 0),
        "Amount (₹)": i.get("amount", 0),
    } for i in items]) if items else pd.DataFrame(
        columns=["Description", "Docket No", "Tracking Number", "Weight (kg)", "Amount (₹)"]
    )

    # Sheet 3 – Payments
    payments = doc.get("payments", [])
    df_payments = pd.DataFrame([{
        "Date": str(p.get("payment_date", "")),
        "Method": str(p.get("method", "")).replace("_", " ").title(),
        "Reference": p.get("transaction_ref", ""),
        "Amount (₹)": p.get("amount", 0),
        "Notes": p.get("notes", ""),
    } for p in payments]) if payments else pd.DataFrame(
        columns=["Date", "Method", "Reference", "Amount (₹)", "Notes"]
    )

    buf = BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df_summary.to_excel(writer, sheet_name="Invoice", index=False)
        df_items.to_excel(writer, sheet_name="Line Items", index=False)
        df_payments.to_excel(writer, sheet_name="Payments", index=False)
    buf.seek(0)

    filename = f"invoice_{doc.get('invoice_number', invoice_id)}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
