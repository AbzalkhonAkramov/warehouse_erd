# Warehouse Distribution ERP

An ERP for a **single-warehouse distribution business** where **field sales agents**
visit shops, take orders on a mobile app, and **managers** approve them. The system
tracks inventory, sales orders, customer debt, and reports — with Telegram notifications.

> 📖 **[docs/WORKFLOW.md](docs/WORKFLOW.md)** — how the whole process works end to end
> (roles, the order lifecycle, agent/manager/warehouse/finance flows, photo reporting,
> permissions matrix).

## Components

| Component   | Tech                                            | Audience              |
|-------------|-------------------------------------------------|-----------------------|
| `backend/`  | Python, FastAPI, SQLAlchemy 2.0 (async), Postgres | API for all clients |
| `web/`      | React + Vite + TypeScript                       | Managers, admin, accountants |
| `mobile/`   | Flutter (Clean Architecture + BLoC)             | Field sales agents    |
| Telegram bot| Backend service                                 | Order/stock/debt alerts |

## Roles

- **Admin** — full system configuration, user management.
- **Manager** — approves orders, sets prices/discounts, sees all reports.
- **Agent** — visits shops, creates orders, collects cash; sees only own customers.
- **Warehouse** — receives stock, picks/packs orders.
- **Accountant** — invoices, payments, debt.

## Core business processes

### 1. Sales (the agent → manager flow)
```
Agent visits shop ─▶ creates order (mobile, may be offline)
        │
        ▼
Order = PENDING ──▶ Telegram alert to manager
        │
        ▼
Manager reviews credit limit / discount ──▶ APPROVED or REJECTED
        │ (approved)
        ▼
Stock decremented ─▶ Invoice generated ─▶ Customer debt increased
        │
        ▼
Warehouse picks & packs ─▶ DELIVERED
        │
        ▼
Agent collects payment (full/partial) ─▶ debt reduced
```

### 2. Inventory
- Receive goods from suppliers (purchase order → goods receipt → stock up).
- Track stock per product (quantity, cost price, optional batch/expiry).
- Every stock change is an auditable `StockMovement` (receipt/sale/adjustment/return).
- Low-stock alerts via Telegram.

### 3. Finance & debt
- Invoice per approved/delivered order.
- Payments (cash collected by agent, or bank transfer).
- Per-customer **credit limit** and **running debt**; orders that would exceed the
  limit are flagged for manager approval.
- Debt-aging report.

### 4. Reports & dashboards
- Sales by agent / product / period.
- Stock value & low-stock / dead-stock.
- Customer debt aging.
- Agent targets vs. actuals, commissions.

## Domain model (key entities)

```
User(role) ──< (agent) Customer >── Visit
Category ──< Product ──< Stock(Warehouse)
                  │         └──< StockMovement
Supplier ──< PurchaseOrder ──< PurchaseOrderLine
Customer ──< SalesOrder(agent, status) ──< SalesOrderLine >── Product
SalesOrder ──1 Invoice ──< Payment
```

## Getting started (backend)

```bash
cd warehouse-erp
docker compose up -d db          # start Postgres
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e .
cp .env.example .env             # edit secrets / DB url / telegram token
alembic upgrade head             # create tables
python -m app.seed               # create admin + demo data
uvicorn app.main:app --reload    # http://localhost:8000/docs
```

Default admin after seeding: `admin@erp.local` / `admin123` (change it).

## Roadmap

- [x] Backend foundation: config, async DB, JWT auth, domain models
- [x] Sales-order flow (create → approve → pick → deliver → invoice → payment) with stock & debt
- [x] Telegram notification service
- [x] Purchasing / goods-receipt endpoints (PO → receive → stock + cost sync)
- [x] Suppliers & categories CRUD
- [x] Reports: dashboard, sales-by-agent, debt aging, product sales, stock ledger, low stock
- [x] Commissions & agent targets
- [x] React web admin (login, dashboard, order approvals, products, customers, invoices, reports)
- [x] Super-admin panel: Telegram topics config + photo-report gallery
- [x] Telegram photo reports: before/after → group **topic** (forum thread) via bot
- [x] Flutter agent app (clean architecture + BLoC): login, customers, orders, photo reports
- [ ] Telegram bot webhook (inline approve/reject buttons)
- [ ] Offline order capture + background sync (mobile)

## Deployment

🚀 **[DEPLOYMENT.md](DEPLOYMENT.md)** (English) · **[DEPLOYMENT.ru.md](DEPLOYMENT.ru.md)**
(Русский) — deploy the whole stack (PostgreSQL, FastAPI backend, React web admin,
Flutter mobile app) with Docker Compose: secrets/`.env`, database + volumes, HTTPS
reverse proxy, mobile builds (`--dart-define`), Telegram setup, backups, and a
production checklist.

## Правила (Rules)

📖 **[RULES.md](RULES.md)** — полный набор правил системы на русском: жизненный цикл
заказа, требование фото и «шлюз» доставки, когда агент может отправить фотоотчёт
(только пока заказ отгружен), хранение фото только в Telegram (альбом + хештеги),
видимость/доступ, и что именно блокируется.
