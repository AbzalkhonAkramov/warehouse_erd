# Power BI дашборд — Warehouse ERP

Готовая модель данных и инструкция, чтобы собрать в **Power BI Desktop** дашборд
с KPI продавцов и аналитикой продаж.

Power BI Desktop работает только на **Windows**. База ERP крутится в Docker на
вашем Mac, поэтому Power BI нужен на Windows-машине (или Windows-VM), у которой
есть сетевой доступ к Mac, **или** используйте офлайн-вариант через Excel.

## Что уже подготовлено

- **`backend/app/analytics_views.sql`** — SQL-вьюхи (чистая BI-модель):
  - `v_sales_fact` — одна строка на проданную позицию заказа (**основная таблица** — грузите её, остальное считается мерами DAX);
  - `v_agent_kpi` — KPI продавцов (заказы, клиенты, штуки, выручка, прибыль, маржа %, средний чек);
  - `v_sales_by_day`, `v_sales_by_month` — динамика по времени;
  - `v_product_sales`, `v_customer_sales`, `v_category_sales` — разрезы по товарам / клиентам / категориям.
- **`backend/app/export_analytics.py`** — выгрузка всех вьюх в Excel.

«Продажа» = заказ в статусе НЕ (new/refund/cancelled/rejected/draft/pending) —
точно как на странице «Аналитика». Себестоимость = `кол-во × цена закупки товара`.

---

## Вариант A — Power BI напрямую к базе (live-данные)

1. **Откройте порт/доступ.** БД уже проброшена на хост: порт **5433** → Postgres.
   Узнайте IP вашего Mac: `ipconfig getifaddr en0` (например `172.20.10.4`).
   Windows-машина должна быть в той же сети.
2. **Создайте вьюхи** (один раз; и после обновлений схемы):
   ```
   docker compose exec -T db psql -U postgres -d lh_warehouse < backend/app/analytics_views.sql
   ```
3. **В Power BI Desktop:** `Главная → Получить данные → База данных PostgreSQL`.
   - Сервер: `<IP-Mac>:5433` (например `172.20.10.4:5433`)
   - База данных: `lh_warehouse`
   - Режим: **Импорт** (проще) или DirectQuery (живые данные).
   - При первом подключении Power BI попросит установить провайдер **Npgsql** — согласитесь.
   - Логин/пароль: `postgres` / **пароль из `backend/.env`** (`POSTGRES_PASSWORD`).
4. В списке объектов отметьте вьюхи: `v_sales_fact`, `v_agent_kpi`,
   `v_sales_by_day`, `v_sales_by_month`, `v_product_sales`, `v_customer_sales`,
   `v_category_sales` → **Загрузить**.
5. Обновление данных — кнопка **Обновить** в Power BI.

## Вариант B — через Excel (без доступа к БД по сети)

1. Сгенерируйте выгрузку:
   ```
   docker compose exec backend python -m app.export_analytics
   ```
   Файл появится на хосте: **`backend/uploads/analytics_export.xlsx`**
   (7 листов: SalesFact, AgentKPI, SalesByDay, SalesByMonth, ProductSales,
   CustomerSales, CategorySales).
2. Перенесите файл на Windows-машину (AirDrop/облако/флешка).
3. Power BI: `Получить данные → Excel` → выберите файл → отметьте листы → Загрузить.
4. Для свежих цифр: повторите шаг 1 и нажмите **Обновить** в Power BI.

---

## Меры DAX (создайте на таблице `v_sales_fact`)

```DAX
Revenue    = SUM(v_sales_fact[revenue])
Cost       = SUM(v_sales_fact[cost])
Profit     = SUM(v_sales_fact[profit])
Margin %   = DIVIDE([Profit], [Revenue])
Units Sold = SUM(v_sales_fact[quantity])
Orders     = DISTINCTCOUNT(v_sales_fact[order_id])
Customers  = DISTINCTCOUNT(v_sales_fact[customer_id])
Avg Order  = DIVIDE([Revenue], [Orders])
```
`Margin %` отформатируйте как процент.

**Таблица дат (для фильтра по периоду):**
```DAX
Dates = CALENDAR(MIN(v_sales_fact[order_date]), MAX(v_sales_fact[order_date]))
```
Свяжите `Dates[Date]` → `v_sales_fact[order_date]` (отношение один-ко-многим).

---

## Что собрать на страницах

**1. Обзор (Overview)**
- KPI-карточки: Revenue, Profit, Margin %, Orders, Avg Order, Units Sold.
- Линейный график: Revenue и Profit по `order_date` (динамика).
- Столбчатый: Revenue по `agent_name` (кто сколько продал).
- Кольцевой/пирог: Revenue по `category_name`.
- Срезы (slicers): период (`Dates[Date]`), агент, категория.

**2. KPI продавцов (Sellers)**
- Таблица/матрица по `agent_name`: Orders, Customers, Units Sold, Revenue, Profit, Margin %, Avg Order.
- Столбчатый: Profit по агентам (сортировка по убыванию).
- Точечный (scatter): Revenue (X) vs Margin % (Y), размер — Orders — видно «много продаёт, но низкая маржа».

**3. Товары (Products)**
- Топ-N по Revenue (горизонтальные бары) и топ по Profit.
- Таблица `v_product_sales` с Margin %.

**4. Клиенты и регионы (Customers)**
- Топ-клиенты по Revenue, разбивка по `region_name`.
- Матрица регион → клиент.

Совет: карточки и срезы продублируйте на всех страницах + синхронизируйте
срезы (View → Sync slicers), чтобы фильтр периода/агента работал везде.

---

## Обновление и безопасность

- После изменений схемы ERP перезапустите шаг создания вьюх (Вариант A, шаг 2).
- Пароль БД берите из `backend/.env` — **не** вшивайте его в .pbix при публикации
  и не коммитьте. Для DirectQuery Power BI хранит креды в своём хранилище.
- Отдавая .pbix другим, предпочитайте режим Импорт (данные внутри файла) и не
  прикладывайте `.env`.
