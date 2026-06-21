# Warehouse ERP — Web admin

React + Vite + TypeScript admin console for **managers / admins / accountants**.

## Features
- JWT login (against the FastAPI backend)
- Dashboard: pending approvals, stock value, total debt, low-stock list
- **Order approvals**: approve / reject (with reason) / start picking / mark delivered, with expandable line items
- Products & stock (list + create)
- Customers (list with debt + credit limit, create)
- Invoices & debt (record full/partial payments)
- Reports: sales by agent, debt aging, agent commissions (month picker)

## Stack
- `react-router-dom` for routing, `@tanstack/react-query` for data fetching/caching
- A small `fetch` wrapper (`src/api/client.ts`) that attaches the bearer token and
  redirects to login on 401

## Run

The backend must be running first (see `../backend`). Then:

```bash
cd web
npm install
npm run dev        # http://localhost:5173  (proxies /api → http://localhost:8000)
```

Sign in with a manager account, e.g. `manager@erp.local` / `manager123` after seeding.

For a production build: `npm run build` (output in `dist/`). Set `VITE_API_BASE`
to your API origin if it isn't served behind the same host.
