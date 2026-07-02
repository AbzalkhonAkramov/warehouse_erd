import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    AGENT = "agent"
    WAREHOUSE = "warehouse"
    ACCOUNTANT = "accountant"
    DELIVERER = "deliverer"


class SalesOrderStatus(str, enum.Enum):
    # Current workflow (manager-driven):
    NEW = "new"               # just created; only a manager may change it
    SHIPPED = "shipped"       # manager dispatched it -> stock + invoice + debt
    DELIVERED = "delivered"   # goods received by the shop (confirmation)
    REFUND = "refund"         # returned (label only; no stock/debt change)
    CANCELLED = "cancelled"   # called off
    # Legacy values kept so pre-existing rows still load (not used anymore):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    PICKING = "picking"


class PurchaseOrderStatus(str, enum.Enum):
    DRAFT = "draft"
    ORDERED = "ordered"
    RECEIVED = "received"
    CANCELLED = "cancelled"


class StockMovementType(str, enum.Enum):
    RECEIPT = "receipt"        # goods in from supplier
    SALE = "sale"             # goods out to customer
    ADJUSTMENT = "adjustment"  # manual correction / stock count
    RETURN_IN = "return_in"    # customer return back to stock
    RETURN_OUT = "return_out"  # return to supplier


class InvoiceStatus(str, enum.Enum):
    UNPAID = "unpaid"
    PARTIAL = "partial"
    PAID = "paid"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    TRANSFER = "transfer"
    CARD = "card"


class PhotoStage(str, enum.Enum):
    BEFORE = "before"
    AFTER = "after"


class PhotoReportStatus(str, enum.Enum):
    PENDING = "pending"   # saved, not yet sent to Telegram
    SENT = "sent"         # all images delivered to the topic
    FAILED = "failed"     # Telegram send failed; can be retried


class CashRemittanceStatus(str, enum.Enum):
    PENDING = "pending"    # agent declared a handover, awaiting manager confirmation
    RECEIVED = "received"  # manager confirmed receipt (money now with manager)
