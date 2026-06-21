import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    AGENT = "agent"
    WAREHOUSE = "warehouse"
    ACCOUNTANT = "accountant"


class SalesOrderStatus(str, enum.Enum):
    DRAFT = "draft"           # being built on the agent's device
    PENDING = "pending"       # submitted, awaiting manager approval
    APPROVED = "approved"     # approved; stock reserved, invoice created
    REJECTED = "rejected"
    PICKING = "picking"       # warehouse preparing
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


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
