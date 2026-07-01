import { useState } from "react";
import * as cls from "../ui/cls";
import { useQuery } from "@tanstack/react-query";
import {
  listCustomers,
  listProducts,
  listRefunds,
  listUsers,
  type RefundFilters,
} from "../api/endpoints";
import { Card, Empty, ErrorBox, ExcelButton, Spinner } from "../components/ui";
import { useI18n } from "../i18n";
import { date, money, qty } from "../lib/format";
import { exportExcel } from "../lib/excel";

export default function RefundedGoodsPage() {
  const { t } = useI18n();
  const [filters, setFilters] = useState<RefundFilters>({});

  const refunds = useQuery({
    queryKey: ["refunds", filters],
    queryFn: () => listRefunds(filters),
  });
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  const agents = useQuery({ queryKey: ["users", "agent"], queryFn: () => listUsers("agent") });
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });

  function set<K extends keyof RefundFilters>(key: K, value: RefundFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value === "" ? undefined : value }));
  }

  function exportRows() {
    if (!refunds.data) return;
    exportExcel(
      "refunded-goods",
      [
        t("col.created"),
        "#",
        t("col.product"),
        t("refunds.customer"),
        t("col.agent"),
        t("orders.deliverer"),
        t("col.qty"),
        t("col.unitPrice"),
        t("refunds.value"),
        t("refunds.dest"),
      ],
      refunds.data.map((r) => [
        date(r.created_at),
        r.sales_order_id,
        r.product_name ?? `#${r.product_id}`,
        r.customer_name ?? `#${r.customer_id}`,
        r.agent_name ?? "—",
        r.deliverer ?? "—",
        qty(r.quantity),
        money(r.unit_price),
        money(r.value),
        r.restocked ? t("refunds.restocked") : t("refunds.held"),
      ]),
    );
  }

  return (
    <div className={cls.page}>
      <div className={cls.pageHead}>
        <h1>{t("refunds.title")}</h1>
        <ExcelButton onClick={exportRows} />
      </div>

      <Card>
        <div className={cls.filterGrid}>
          <label className={cls.field}>
            <span>{t("refunds.customer")}</span>
            <select
              value={filters.customer_id ?? ""}
              onChange={(e) => set("customer_id", e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">{t("common.all")}</option>
              {customers.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={cls.field}>
            <span>{t("col.agent")}</span>
            <select
              value={filters.agent_id ?? ""}
              onChange={(e) => set("agent_id", e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">{t("common.all")}</option>
              {agents.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className={cls.field}>
            <span>{t("col.product")}</span>
            <select
              value={filters.product_id ?? ""}
              onChange={(e) => set("product_id", e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">{t("common.all")}</option>
              {products.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className={cls.field}>
            <span>{t("refunds.dest")}</span>
            <select
              value={filters.restocked === undefined ? "" : filters.restocked ? "1" : "0"}
              onChange={(e) =>
                set("restocked", e.target.value === "" ? undefined : e.target.value === "1")
              }
            >
              <option value="">{t("common.all")}</option>
              <option value="1">{t("refunds.restocked")}</option>
              <option value="0">{t("refunds.held")}</option>
            </select>
          </label>
          <label className={cls.field}>
            <span>{t("col.dateFrom")}</span>
            <input
              type="date"
              value={filters.date_from ?? ""}
              onChange={(e) => set("date_from", e.target.value || undefined)}
            />
          </label>
          <label className={cls.field}>
            <span>{t("col.dateTo")}</span>
            <input
              type="date"
              value={filters.date_to ?? ""}
              onChange={(e) => set("date_to", e.target.value || undefined)}
            />
          </label>
        </div>
      </Card>

      <Card>
        {refunds.isLoading ? (
          <Spinner />
        ) : refunds.error ? (
          <ErrorBox error={refunds.error} />
        ) : refunds.data && refunds.data.length > 0 ? (
          <table className={cls.table}>
            <thead>
              <tr>
                <th>{t("col.created")}</th>
                <th>#</th>
                <th>{t("col.product")}</th>
                <th>{t("refunds.customer")}</th>
                <th>{t("col.agent")}</th>
                <th>{t("orders.deliverer")}</th>
                <th className={cls.numCell}>{t("col.qty")}</th>
                <th className={cls.numCell}>{t("refunds.value")}</th>
                <th>{t("refunds.dest")}</th>
              </tr>
            </thead>
            <tbody>
              {refunds.data.map((r) => (
                <tr key={r.id}>
                  <td>{date(r.created_at)}</td>
                  <td className={cls.mono}>{r.sales_order_id}</td>
                  <td>{r.product_name ?? `#${r.product_id}`}</td>
                  <td>{r.customer_name ?? `#${r.customer_id}`}</td>
                  <td>{r.agent_name ?? "—"}</td>
                  <td>{r.deliverer ?? "—"}</td>
                  <td className={cls.numCell}>{qty(r.quantity)}</td>
                  <td className={cls.cx(cls.numCell, cls.strong)}>{money(r.value)}</td>
                  <td>
                    <span className={cls.badge[r.restocked ? "green" : "amber"]}>
                      {r.restocked ? t("refunds.restocked") : t("refunds.held")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>{t("refunds.empty")}</Empty>
        )}
      </Card>
    </div>
  );
}
