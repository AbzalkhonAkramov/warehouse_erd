-- Analytics model for Power BI (and any BI tool).
--
-- These views turn the normalised ERP schema into a BI-friendly star:
--   v_sales_fact      one row per sold order line (the grain) — load THIS and
--                     build every KPI/visual from it with DAX measures.
--   v_agent_kpi       pre-aggregated seller KPIs (revenue/profit/margin/…).
--   v_sales_by_day    daily revenue/profit/orders (time-series).
--   v_sales_by_month  monthly revenue/profit/orders.
--   v_product_sales   per-product revenue/profit/units.
--   v_customer_sales  per-customer revenue/profit/orders.
--   v_category_sales  per-category revenue/profit/units.
--
-- "Sales" = orders whose status is NOT one of the non-sale states, matching the
-- app's Analytics page exactly. COGS uses each product's current reference cost.
--
-- Idempotent: safe to run repeatedly (CREATE OR REPLACE). Apply with:
--   docker compose exec -T db psql -U postgres -d lh_warehouse < backend/app/analytics_views.sql

-- One row per sold order line — the single fact table to load into Power BI.
CREATE OR REPLACE VIEW v_sales_fact AS
SELECT
    sol.id                              AS line_id,
    so.id                               AS order_id,
    so.created_at                       AS order_at,
    (so.created_at AT TIME ZONE 'Asia/Tashkent')::date AS order_date,
    so.status                           AS order_status,
    so.agent_id,
    COALESCE(u.full_name, '—')          AS agent_name,
    so.customer_id,
    COALESCE(cu.name, '—')              AS customer_name,
    cu.region_id,
    COALESCE(r.name, '—')               AS region_name,
    sol.product_id,
    COALESCE(p.name, '—')               AS product_name,
    COALESCE(p.sku, '')                 AS sku,
    p.category_id,
    COALESCE(c.name, '—')               AS category_name,
    sol.quantity                        AS quantity,
    sol.unit_price                      AS unit_price,
    sol.line_total                      AS revenue,
    COALESCE(p.cost_price, 0)           AS unit_cost,
    ROUND(sol.quantity * COALESCE(p.cost_price, 0), 2)              AS cost,
    ROUND(sol.line_total - sol.quantity * COALESCE(p.cost_price, 0), 2) AS profit
FROM sales_order_lines sol
JOIN sales_orders so ON so.id = sol.sales_order_id
JOIN products     p  ON p.id  = sol.product_id
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN customers cu ON cu.id = so.customer_id
LEFT JOIN regions   r  ON r.id  = cu.region_id
LEFT JOIN users     u  ON u.id  = so.agent_id
WHERE so.status NOT IN ('NEW', 'REFUND', 'CANCELLED', 'REJECTED', 'DRAFT', 'PENDING');

-- Seller KPIs — the core of the dashboard.
CREATE OR REPLACE VIEW v_agent_kpi AS
SELECT
    agent_id,
    agent_name,
    COUNT(DISTINCT order_id)                           AS orders,
    COUNT(DISTINCT customer_id)                         AS customers,
    SUM(quantity)                                       AS units_sold,
    SUM(revenue)                                        AS revenue,
    SUM(cost)                                           AS cost,
    SUM(profit)                                         AS profit,
    ROUND(100 * SUM(profit) / NULLIF(SUM(revenue), 0), 1) AS margin_pct,
    ROUND(SUM(revenue) / NULLIF(COUNT(DISTINCT order_id), 0), 2) AS avg_order
FROM v_sales_fact
GROUP BY agent_id, agent_name
ORDER BY revenue DESC;

-- Daily time-series.
CREATE OR REPLACE VIEW v_sales_by_day AS
SELECT
    order_date,
    COUNT(DISTINCT order_id) AS orders,
    SUM(quantity)            AS units_sold,
    SUM(revenue)             AS revenue,
    SUM(profit)              AS profit
FROM v_sales_fact
GROUP BY order_date
ORDER BY order_date;

-- Monthly time-series.
CREATE OR REPLACE VIEW v_sales_by_month AS
SELECT
    to_char(order_date, 'YYYY-MM') AS month,
    COUNT(DISTINCT order_id)       AS orders,
    SUM(quantity)                  AS units_sold,
    SUM(revenue)                   AS revenue,
    SUM(profit)                    AS profit
FROM v_sales_fact
GROUP BY to_char(order_date, 'YYYY-MM')
ORDER BY month;

-- Per-product performance.
CREATE OR REPLACE VIEW v_product_sales AS
SELECT
    product_id,
    product_name,
    sku,
    category_name,
    SUM(quantity)                                       AS units_sold,
    SUM(revenue)                                        AS revenue,
    SUM(profit)                                         AS profit,
    ROUND(100 * SUM(profit) / NULLIF(SUM(revenue), 0), 1) AS margin_pct
FROM v_sales_fact
GROUP BY product_id, product_name, sku, category_name
ORDER BY revenue DESC;

-- Per-customer performance.
CREATE OR REPLACE VIEW v_customer_sales AS
SELECT
    customer_id,
    customer_name,
    region_name,
    COUNT(DISTINCT order_id)                            AS orders,
    SUM(quantity)                                       AS units_sold,
    SUM(revenue)                                        AS revenue,
    SUM(profit)                                         AS profit,
    ROUND(100 * SUM(profit) / NULLIF(SUM(revenue), 0), 1) AS margin_pct
FROM v_sales_fact
GROUP BY customer_id, customer_name, region_name
ORDER BY revenue DESC;

-- Per-category performance.
CREATE OR REPLACE VIEW v_category_sales AS
SELECT
    category_name,
    SUM(quantity)                                       AS units_sold,
    SUM(revenue)                                        AS revenue,
    SUM(profit)                                         AS profit,
    ROUND(100 * SUM(profit) / NULLIF(SUM(revenue), 0), 1) AS margin_pct
FROM v_sales_fact
GROUP BY category_name
ORDER BY revenue DESC;
