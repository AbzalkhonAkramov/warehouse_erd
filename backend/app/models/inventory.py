from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import StockMovementType


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
