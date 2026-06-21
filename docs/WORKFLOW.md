# Warehouse ERP — Workflow & Process Guide

How the system is used day to day, who does what, and how an order moves from a shop
visit to a paid invoice. This describes the **business process**, not the code.

---

## 1. The three surfaces

| Surface | Who uses it | What they do |
|---|---|---|
| **Mobile app** (Flutter) | Field **agents** | Visit shops, take orders, register new shops, send before/after photos |
| **Web admin** (React) | **Managers / admins / accountants / warehouse** | Approve orders, manage products & stock, payments, reports, configuration |
| **Telegram bot** (`@kelv1n_bot`) | Managers (group) | Receive order/stock alerts and before/after photos in group **topics** |

All three talk to one **backend API**. The UI is available in **Russian (default),
Uzbek, and English** — switchable from the language selector in both apps.

---

## 2. Roles

| Role | Can do |
|---|---|
| **Admin** | Everything, plus system config (Telegram topics, users) |
| **Manager** | Approve/reject orders, prices, products, stock, payments, agent setup, all reports |
| **Agent** | See only own shops & allowed product categories; take orders; create shops; send photos; collect payments |
| **Warehouse** | Receive stock, manage products, pick/deliver orders |
| **Accountant** | Invoices, payments, debt reports |

> An agent only sees products in the **categories a manager assigned** to them, and only
> the **shops assigned** to them.

---

## 3. One-time / ongoing setup (manager & admin)

```
Admin/Manager (web)
  ├─ Create product categories
  ├─ Create products (SKU) ── add photo ── set TWO prices, min stock
  │        • purchase price (cost)   — internal only
  │        • retail price  (sale)    — what the agent/shop sees
  ├─ Receive initial stock  (Add quantity / purchase orders)
  ├─ Create agents (users)  ── assign visible categories
  ├─ Create shops           (or agents create their own in the field)
  └─ Admin: configure Telegram topics (group chat_id + topic thread_id, set default)
```

**Two prices.** Every product has a **purchase price** (cost) and a **retail price** (sale).
Agents only ever see the **retail price** and the **available stock** — the purchase price
is hidden from them by the API.

**Category visibility.** Until a manager assigns categories to an agent, that agent sees
**all** products. Once ≥1 category is assigned, the agent only sees products in those
categories.

---

## 4. The core flow — order lifecycle

This is the heart of the system: a field order from creation to delivery and payment.

**Auto-approval rule.** When the agent submits, the system checks stock:
- **Enough stock for every line → the order is auto-approved immediately** (no manager
  step): stock is decremented, the invoice is created, and the customer's debt rises.
- **Any line short on stock → the order stays PENDING** for a manager to approve manually
  (e.g. after restocking).

```
 AGENT (mobile)            MANAGER (web)           WAREHOUSE (web)        AGENT / ACCOUNTANT
──────────────────────────────────────────────────────────────────────────────────────────
 Visit shop (sees retail
   price + live stock)
 Pick products + qty
 Submit order
       │
   stock enough? ──yes──▶ AUTO-APPROVED ─────────────┐ (no manager needed)
       │ no                                           │
       ▼                                              │
     PENDING ──────────▶  MANAGER reviews             │
                          🔔 Telegram alert           │
                  ┌───────────┴───────────┐           │
                  ▼                        ▼           │
               APPROVE                   REJECT        │
                  │                        │
   • stock decremented            REJECTED (with reason)
   • invoice created              🔔 agent notified
   • customer debt += total
   • 🔔 agent notified
                  │
                APPROVED ───────────────▶ Start picking ─▶ PICKING
                                                              │
                                                          Mark delivered ─▶ DELIVERED
                                                                                │
                                                              Collect payment (cash/transfer/card)
                                                              • invoice paid/partial
                                                              • customer debt -= amount
```

### Order statuses

| Status | Meaning | Set by |
|---|---|---|
| `draft` | Being built on the device (not submitted) | Agent |
| `pending` | Submitted but stock is short — awaiting manual approval | Agent (on submit, if short) |
| `approved` | Stock decremented, invoice created, debt raised | **Auto** (if in stock) or Manager |
| `rejected` | Declined with a reason | Manager |
| `picking` | Warehouse preparing the goods | Warehouse/Manager |
| `delivered` | Delivered to the shop | Warehouse/Manager |
| `cancelled` | Cancelled (only while still `pending`) | Manager |

**Guards:** approval fails if stock is insufficient; only `pending` orders can be
cancelled here (approved orders need a credit note — a future addition).

---

## 5. Field-agent daily workflow (mobile)

```
1. Open app → sign in (language defaults to Russian)
2. "My customers" tab:
     • see assigned shops, their debt vs credit limit
     • ＋ register a NEW shop (auto-assigned to this agent)
3. "New order" tab:
     • pick a shop
     • add products (each shows a photo, retail price, and current stock) with + / − qty
     • see running total → Submit
        → in stock: instantly auto-approved (the agent is told "approved")
        → short on stock: goes PENDING for a manager
4. "Photo report" tab (merchandising / proof):
     • pick the shop (and optionally a topic)
     • take BEFORE photo, service the shelf, take AFTER photo
     • add a note → Send  → photos go to the Telegram topic
```

---

## 6. Manager workflow (web)

```
Dashboard ──▶ Pending approvals badge
   │
   ▼
Order approvals
   • filter: Pending / Approved / Picking / Delivered / Rejected / All
   • expand an order to see line items
   • Approve  / Reject (reason)  / Start picking  / Mark delivered
Reports
   • Sales by agent, debt aging, agent commissions (by month)
Configuration
   • Products & stock, Customers, Agents (categories), Telegram topics
```

---

## 7. Warehouse / stock workflow

Two ways stock goes **up**:
1. **Purchasing** — create a purchase order to a supplier, then *receive goods*; this adds
   stock and updates the product's reference cost.
2. **Add quantity** page — pick a product, enter a quantity, submit (quick receipt /
   correction).

Stock goes **down** automatically when an order is **approved**. Every change is recorded
as a stock movement (receipt / sale / adjustment / return) for an audit trail. Low-stock
items (below `min_stock`) surface on the dashboard.

---

## 8. Finance & debt workflow

```
Order approved ─▶ Invoice created (status: unpaid) ─▶ Customer debt increases
                                   │
                         Record payment (cash / transfer / card)
                                   │
                    ┌──────────────┴──────────────┐
                 partial                         full
              invoice: partial               invoice: paid
              debt decreases                 debt cleared for it
```

| Invoice status | Meaning |
|---|---|
| `unpaid` | Nothing paid yet |
| `partial` | Some paid, balance remains |
| `paid` | Fully settled |

A shop that would exceed its **credit limit** is flagged to the manager at approval time
(and over-limit shops are highlighted in the debt-aging report).

---

## 9. Photo reporting → Telegram topics

```
Agent takes BEFORE + AFTER ─▶ backend stores them ─▶ bot posts to a group TOPIC
                                                       │
   topic is resolved in this order:                    ▼
   1. the topic the agent picked on the screen     "BEFORE — Shop · Agent" (photo)
   2. the agent's admin-assigned default topic     "AFTER  — Shop · Agent" (photo)
   3. the global default topic
```

Setup (admin, once): create a Telegram **forum group**, add the bot as admin, post in the
target topic, use **Telegram topics → Discover IDs** in the web admin to read the
`chat_id` / `thread_id`, then save the topic and mark a default. If Telegram delivery
fails, the report is stored as `failed` and can be **resent** from the web.

---

## 10. Notifications summary

| Event | Who is notified | Channel |
|---|---|---|
| New order submitted | Managers | Telegram group |
| Order approved | The agent | Telegram (personal, if configured) |
| Order rejected | The agent | Telegram (personal, if configured) |
| Before/after photos | Manager group | Telegram **topic** |
| Low stock | Managers | Dashboard (Telegram optional) |

---

## 11. Permissions at a glance

| Action | Agent | Warehouse | Accountant | Manager | Admin |
|---|:--:|:--:|:--:|:--:|:--:|
| Create order | ✅ | | | ✅ | ✅ |
| Approve / reject order | | | | ✅ | ✅ |
| Pick / deliver order | | ✅ | | ✅ | ✅ |
| Create **product** | | ✅ | | ✅ | ✅ |
| Add stock quantity | | ✅ | | ✅ | ✅ |
| Create **shop** | ✅ | ✅ | ✅ | ✅ | ✅ |
| Record payment | ✅ | | ✅ | ✅ | ✅ |
| Send before/after photo | ✅ | | | ✅ | ✅ |
| Assign categories to agent | | | | ✅ | ✅ |
| Configure Telegram topics | | | | | ✅ |
| Reports | | | ✅ | ✅ | ✅ |

> Admin is implicitly allowed everywhere. Agents are additionally scoped to their own
> shops and assigned product categories.

---

## 12. End-to-end example

1. **Admin** adds category *Drinks*, product *Cola 1.5L* (with photo), receives 100 units,
   assigns *Drinks* to **Agent A**, and configures a *Before/After* Telegram topic.
2. **Agent A** visits *Corner Shop*, opens the app (in Russian), creates an order for 6×
   Cola, and submits it → status **pending**, managers get a Telegram alert.
3. **Manager** sees it on the dashboard, checks the credit limit, and **approves** → stock
   drops to 94, invoice `INV-000001` is created, the shop's debt rises by the total, and
   Agent A is notified.
4. **Warehouse** marks it **picking** then **delivered**.
5. **Agent A** photographs the restocked shelf (before/after) → photos land in the Telegram
   topic; then collects a **partial cash payment** → invoice becomes *partial*, debt drops.
6. **Manager** reviews *Sales by agent* and *Debt aging* at month end; commission is computed
   from Agent A's approved sales.
