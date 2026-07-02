from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import CashRemittanceStatus, InvoiceStatus, PaymentMethod


class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    sales_order_id: Mapped[int] = mapped_column(
        ForeignKey("sales_orders.id"), unique=True, nullable=False
    )
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)

    total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    paid_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus), default=InvoiceStatus.UNPAID, nullable=False
    )

    order: Mapped["SalesOrder"] = relationship(back_populates="invoice")  # noqa: F821
    payments: Mapped[list["Payment"]] = relationship(back_populates="invoice")

    @property
    def balance(self) -> float:
        return float(self.total) - float(self.paid_amount)


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod), default=PaymentMethod.CASH, nullable=False
    )
    # The agent/accountant who collected the payment.
    collected_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    # Optional receipt/bill photo, served at /uploads/<path>.
    image_path: Mapped[str | None] = mapped_column(String(255))

    invoice: Mapped["Invoice"] = relationship(back_populates="payments")


class CashRemittance(Base, TimestampMixin):
    """A handover of collected cash from an agent to a manager.

    The agent's outstanding balance = (all payments they collected) − (remittances
    received from them). In "agent_submits" mode a row starts PENDING (declared by
    the agent) and a manager confirms it; in "manager_records" mode the manager
    creates it already RECEIVED."""

    __tablename__ = "cash_remittances"

    id: Mapped[int] = mapped_column(primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    status: Mapped[CashRemittanceStatus] = mapped_column(
        Enum(CashRemittanceStatus), default=CashRemittanceStatus.PENDING, nullable=False
    )
    note: Mapped[str | None] = mapped_column(Text)
    # Who created the row (agent in agent_submits, manager in manager_records).
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    received_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
