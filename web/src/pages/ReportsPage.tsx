import { useState } from "react";
import * as cls from "../ui/cls";
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
    <div className={cls.page}>
      <h1>{t("reports.title")}</h1>

      <Card title={t("reports.salesByAgent")}>
        {sales.data && sales.data.length > 0 && (
          <div className={cls.modalToolbar}>
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
          <table className={cls.table}>
            <thead>
              <tr>
                <th>{t("col.agent")}</th>
                <th className={cls.numCell}>{t("col.orders")}</th>
                <th className={cls.numCell}>{t("col.totalSales")}</th>
              </tr>
            </thead>
            <tbody>
              {sales.data!.map((r) => (
                <tr key={r.agent_id}>
                  <td>{r.agent_name}</td>
                  <td className={cls.numCell}>{r.orders}</td>
                  <td className={cls.cx(cls.numCell, cls.strong)}>{money(r.total)}</td>
                </tr>
              ))}
              {sales.data!.length === 0 && (
                <tr>
                  <td colSpan={3} className={cls.empty}>
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
          <div className={cls.modalToolbar}>
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
          <table className={cls.table}>
            <thead>
              <tr>
                <th>{t("col.customer")}</th>
                <th className={cls.numCell}>{t("col.debt")}</th>
                <th className={cls.numCell}>{t("col.creditLimit")}</th>
                <th>{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {debt.data!.map((r) => (
                <tr key={r.customer_id}>
                  <td>{r.name}</td>
                  <td className={cls.cx(cls.numCell, cls.strong)}>{money(r.debt)}</td>
                  <td className={cls.numCell}>{money(r.credit_limit)}</td>
                  <td>
                    {r.over_limit ? (
                      <span className={cls.badge.red}>{t("col.overLimit")}</span>
                    ) : (
                      <span className={cls.badge.green}>{t("col.ok")}</span>
                    )}
                  </td>
                </tr>
              ))}
              {debt.data!.length === 0 && (
                <tr>
                  <td colSpan={4} className={cls.empty}>
                    {t("reports.noDebt")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={t("reports.commissions")}>
        <div className={cls.filterRow}>
          <label className={cls.inlineField}>
            {t("field.year")}
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={{ width: 90 }}
            />
          </label>
          <label className={cls.inlineField}>
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
          <div className={cls.modalToolbar}>
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
          <table className={cls.table}>
            <thead>
              <tr>
                <th>{t("col.agent")}</th>
                <th className={cls.numCell}>{t("col.rate")}</th>
                <th className={cls.numCell}>{t("col.sales")}</th>
                <th className={cls.numCell}>{t("col.commission")}</th>
                <th className={cls.numCell}>{t("col.target")}</th>
                <th className={cls.numCell}>{t("col.achieved")}</th>
              </tr>
            </thead>
            <tbody>
              {comm.data!.map((r) => (
                <tr key={r.agent_id}>
                  <td>{r.agent_name}</td>
                  <td className={cls.numCell}>{money(r.commission_rate)}</td>
                  <td className={cls.numCell}>{money(r.sales_total)}</td>
                  <td className={cls.cx(cls.numCell, cls.strong)}>{money(r.commission)}</td>
                  <td className={cls.numCell}>{r.target ? money(r.target) : "—"}</td>
                  <td className={cls.numCell}>
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
