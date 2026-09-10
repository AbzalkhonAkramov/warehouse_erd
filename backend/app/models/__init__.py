"""Import all models here so Alembic autogenerate and relationships resolve."""

from app.models.base import Base
from app.models.user import User
from app.models.catalog import Category, Currency, Product, Supplier, Warehouse
from app.models.inventory import Stock, StockMovement
from app.models.purchasing import PurchaseOrder, PurchaseOrderLine
from app.models.sales import (
    Customer,
    OrderStatusHistory,
    RefundEntry,
    Region,
    SalesOrder,
    SalesOrderLine,
    Visit,
)
from app.models.finance import Invoice, Payment
from app.models.agent import AgentTarget
from app.models.telegram import TelegramTopic
from app.models.photo import PhotoReport, PhotoReportImage
from app.models.associations import agent_categories
from app.models.activity import ActivityLog
from app.models.setting import CompanySettings

__all__ = [
    "Base",
    "User",
    "AgentTarget",
    "TelegramTopic",
    "PhotoReport",
    "PhotoReportImage",
    "agent_categories",
    "ActivityLog",
    "CompanySettings",
    "Category",
    "Currency",
    "Product",
    "Supplier",
    "Warehouse",
    "Stock",
    "StockMovement",
    "PurchaseOrder",
    "PurchaseOrderLine",
    "Customer",
    "Region",
    "SalesOrder",
    "SalesOrderLine",
    "RefundEntry",
    "OrderStatusHistory",
    "Visit",
    "Invoice",
    "Payment",
]
