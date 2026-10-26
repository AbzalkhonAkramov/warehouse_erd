from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import StockCountStatus, StockMovementType


class Stock(Base, TimestampMixin):
    """On-hand quantity of a product in a warehouse."""

    __tablename__ = "stock"
    __table_args__ = (UniqueConstraint("product_id", "warehouse_id", name="uq_stock_product_wh"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"), nullable=False)

    quantity: Mapped[float] = mapped_column(Numeric(14, 3), default=0, nullable=False)
    batch: Mapped[str | None] = mapped_column(String(64))
    expiry_date: Mapped[date | None] = mapped_column(Date)

    product: Mapped["Product"] = relationship(back_populates="stock")  # noqa: F821


class StockMovement(Base, TimestampMixin):
    """Audit trail: every change to stock is recorded here."""

    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"), nullable=False)
    type: Mapped[StockMovementType] = mapped_column(Enum(StockMovementType), nullable=False)

    # Positive = into stock, negative = out of stock.
    quantity: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)
    unit_cost: Mapped[float] = mapped_column(Numeric(14, 2), default=0)

    # Free-form link to the source document, e.g. "sales_order:42" / "purchase_order:7".
    reference: Mapped[str | None] = mapped_column(String(64), index=True)
    note: Mapped[str | None] = mapped_column(Text)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))


class StockCount(Base, TimestampMixin):
    """A stocktake (инвентаризация): snapshot of system quantities that a
    manager counts against, then applies as adjustments when completed."""

    __tablename__ = "stock_counts"

    id: Mapped[int] = mapped_column(primary_key=True)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"), nullable=False)
    status: Mapped[StockCountStatus] = mapped_column(
        Enum(StockCountStatus), default=StockCountStatus.OPEN, nullable=False
    )
    note: Mapped[str | None] = mapped_column(Text)
    # True = completion corrected stock by the counted amounts;
    # False = the count was recorded as a report only (stock left untouched).
    apply_stock: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    completed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    lines: Mapped[list["StockCountLine"]] = relationship(
        back_populates="stock_count",
        cascade="all, delete-orphan",
    )


class StockCountLine(Base):
    """One product in a stocktake: the system quantity snapshotted at the start
    and the quantity physically counted (null until entered)."""

    __tablename__ = "stock_count_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    stock_count_id: Mapped[int] = mapped_column(
        ForeignKey("stock_counts.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)

    # Snapshot of Stock.quantity when the count started (for reference/display).
    system_qty: Mapped[float] = mapped_column(Numeric(14, 3), default=0, nullable=False)
    # What was physically counted; null = this product has not been counted yet.
    counted_qty: Mapped[float | None] = mapped_column(Numeric(14, 3))
    # After completion: True = the difference was applied to stock, False = this
    # SKU was excluded (an exception) or the count was report-only; null = open.
    applied: Mapped[bool | None] = mapped_column()

    stock_count: Mapped["StockCount"] = relationship(back_populates="lines")
