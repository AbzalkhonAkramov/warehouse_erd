import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_roles
from app.core.config import settings
from app.core.database import get_db
from app.models.enums import UserRole
from app.models.finance import Invoice, Payment
from app.models.sales import SalesOrder
from app.models.user import User
from app.schemas.finance import (
    InvoiceDetailOut,
    InvoiceOut,
    PaymentCreate,
    PaymentOut,
)
from app.services import sales_service

router = APIRouter(tags=["finance"])

_RECEIPT_SUBDIR = "receipts"


@router.get("/invoices", response_model=list[InvoiceOut])
async def list_invoices(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Invoice]:
    stmt = select(Invoice).order_by(Invoice.id.desc())
    # Agents see invoices for their own orders; deliverers for orders assigned to
    # them (so they can collect payment on delivery).
    if user.role == UserRole.AGENT:
        stmt = stmt.join(SalesOrder, SalesOrder.id == Invoice.sales_order_id).where(
            SalesOrder.agent_id == user.id
        )
    elif user.role == UserRole.DELIVERER:
        stmt = stmt.join(SalesOrder, SalesOrder.id == Invoice.sales_order_id).where(
            SalesOrder.deliverer_id == user.id
        )
    return list(await db.scalars(stmt))


@router.get("/invoices/{invoice_id}", response_model=InvoiceDetailOut)
async def get_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InvoiceDetailOut:
    """Invoice with its full payment history (how it was paid, by whom, when).

    Managers/accountants/admins see any invoice; an agent sees only invoices for
    their own orders.
    """
    invoice = await db.scalar(
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .options(selectinload(Invoice.payments))
    )
    if invoice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")

    if user.role in (UserRole.AGENT, UserRole.DELIVERER):
        order = await db.get(SalesOrder, invoice.sales_order_id)
        owner = order.agent_id if user.role == UserRole.AGENT else order.deliverer_id
        if order is None or owner != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")

    # Resolve collector names so the UI doesn't need a separate users query.
    collector_ids = {p.collected_by_id for p in invoice.payments if p.collected_by_id}
    names: dict[int, str] = {}
    if collector_ids:
        rows = await db.execute(
            select(User.id, User.full_name).where(User.id.in_(collector_ids))
        )
        names = {uid: name for uid, name in rows.all()}

    detail = InvoiceDetailOut.model_validate(invoice)
    detail.payments = []
    for p in sorted(invoice.payments, key=lambda x: x.collected_at):
        item = PaymentOut.model_validate(p)
        item.collected_by_name = names.get(p.collected_by_id) if p.collected_by_id else None
        detail.payments.append(item)
    return detail


@router.post("/payments", response_model=PaymentOut, status_code=201)
async def create_payment(
    data: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Payment:
    """Record a payment (cash collected by an agent, or a transfer)."""
    return await sales_service.record_payment(
        db, user, data.invoice_id, data.amount, data.method, data.note
    )


@router.post("/payments/{payment_id}/image", response_model=PaymentOut)
async def upload_payment_image(
    payment_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ACCOUNTANT)),
) -> Payment:
    """Attach a receipt/bill photo to a payment history entry."""
    payment = await db.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")

    root = Path(settings.UPLOAD_DIR) / _RECEIPT_SUBDIR
    root.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "").suffix.lower() or ".jpg"
    name = f"{uuid.uuid4().hex}{suffix}"
    (root / name).write_bytes(await file.read())

    payment.image_path = f"{_RECEIPT_SUBDIR}/{name}"
    await db.flush()
    return payment
