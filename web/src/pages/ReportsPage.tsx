import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { commissions, debtAging, salesByAgent } from "../api/endpoints";
import { Card, ErrorBox, ExcelButton, Spinner } from "../components/ui";
import { useI18n } from "../i18n";
import { money } from "../lib/format";
import { exportExcel } from "../lib/excel";

const now = new Date();

export default function ReportsPage() {
  const { t } = useI18n();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const sales = useQuery({ queryKey: ["report", "sales-by-agent"], queryFn: salesByAgent });
  const debt = useQuery({ queryKey: ["report", "debt-aging"], queryFn: debtAging });
  const comm = useQuery({
    queryKey: ["report", "commissions", year, month],
    queryFn: () => commissions(year, month),
  });

  return (
    <div className="page">
      <h1>{t("reports.title")}</h1>

      <Card title={t("reports.salesByAgent")}>
        {sales.data && sales.data.length > 0 && (
          <div className="modal-toolbar">
            <span />
            <ExcelButton
              onClick={() =>
                exportExcel(
                  "sales-by-agent",
                  [t("col.agent"), t("col.orders"), t("col.totalSales")],
                  sales.data!.map((r) => [r.agent_name, r.orders, money(r.total)]),
                )
              }
            />
          </div>
        )}
        {sales.isLoading ? (
          <Spinner />
        ) : sales.error ? (
          <ErrorBox error={sales.error} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("col.agent")}</th>
                <th className="num">{t("col.orders")}</th>
                <th className="num">{t("col.totalSales")}</th>
              </tr>
            </thead>
            <tbody>
              {sales.data!.map((r) => (
                <tr key={r.agent_id}>
                  <td>{r.agent_name}</td>
                  <td className="num">{r.orders}</td>
                  <td className="num strong">{money(r.total)}</td>
                </tr>
              ))}
              {sales.data!.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty">
                    {t("reports.noSales")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={t("reports.debtAging")}>
        {debt.data && debt.data.length > 0 && (
          <div className="modal-toolbar">
            <span />
            <ExcelButton
              onClick={() =>
                exportExcel(
                  "debt-aging",
                  [t("col.customer"), t("col.debt"), t("col.creditLimit"), t("common.status")],
                  debt.data!.map((r) => [
                    r.name,
                    money(r.debt),
                    money(r.credit_limit),
                    r.over_limit ? t("col.overLimit") : t("col.ok"),
                  ]),
                )
              }
            />
          </div>
        )}
        {debt.isLoading ? (
          <Spinner />
        ) : debt.error ? (
          <ErrorBox error={debt.error} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("col.customer")}</th>
                <th className="num">{t("col.debt")}</th>
                <th className="num">{t("col.creditLimit")}</th>
                <th>{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {debt.data!.map((r) => (
                <tr key={r.customer_id}>
                  <td>{r.name}</td>
                  <td className="num strong">{money(r.debt)}</td>
                  <td className="num">{money(r.credit_limit)}</td>
                  <td>
                    {r.over_limit ? (
                      <span className="badge badge-red">{t("col.overLimit")}</span>
                    ) : (
                      <span className="badge badge-green">{t("col.ok")}</span>
                    )}
                  </td>
                </tr>
              ))}
              {debt.data!.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    {t("reports.noDebt")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={t("reports.commissions")}>
        <div className="filter-row">
          <label className="inline-field">
            {t("field.year")}
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={{ width: 90 }}
            />
          </label>
          <label className="inline-field">
            {t("field.month")}
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
        {comm.data && comm.data.length > 0 && (
          <div className="modal-toolbar">
            <span />
            <ExcelButton
              onClick={() =>
                exportExcel(
                  `commissions-${year}-${month}`,
                  [
                    t("col.agent"),
                    t("col.rate"),
                    t("col.sales"),
                    t("col.commission"),
                    t("col.target"),
                    t("col.achieved"),
                  ],
                  comm.data!.map((r) => [
                    r.agent_name,
                    money(r.commission_rate),
                    money(r.sales_total),
                    money(r.commission),
                    r.target ? money(r.target) : "",
                    r.achievement_pct != null ? `${r.achievement_pct}%` : "",
                  ]),
                )
              }
            />
          </div>
        )}
        {comm.isLoading ? (
          <Spinner />
        ) : comm.error ? (
          <ErrorBox error={comm.error} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("col.agent")}</th>
                <th className="num">{t("col.rate")}</th>
                <th className="num">{t("col.sales")}</th>
                <th className="num">{t("col.commission")}</th>
                <th className="num">{t("col.target")}</th>
                <th className="num">{t("col.achieved")}</th>
              </tr>
            </thead>
            <tbody>
              {comm.data!.map((r) => (
                <tr key={r.agent_id}>
                  <td>{r.agent_name}</td>
                  <td className="num">{money(r.commission_rate)}</td>
                  <td className="num">{money(r.sales_total)}</td>
                  <td className="num strong">{money(r.commission)}</td>
                  <td className="num">{r.target ? money(r.target) : "—"}</td>
                  <td className="num">
                    {r.achievement_pct != null ? `${r.achievement_pct}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
