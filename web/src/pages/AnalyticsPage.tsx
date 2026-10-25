import { useMemo, useState } from "react";
import * as cls from "../ui/cls";
import { useQuery } from "@tanstack/react-query";
import { getAnalytics } from "../api/endpoints";
import type { Analytics } from "../api/types";
import { useI18n } from "../i18n";
import { Card, ErrorBox, Spinner } from "../components/ui";
import { money } from "../lib/format";

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "profit" | "cost" }) {
  return (
    <div className={cls.kpiCard}>
      <div className={cls.kpiLabel}>{label}</div>
      <div
        className={cls.cx(
          cls.kpiValue,
          tone === "profit" && cls.kpiProfit,
          tone === "cost" && cls.kpiCost,
        )}
      >
        {value}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { t } = useI18n();
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [group, setGroup] = useState<"day" | "month">("day");

  const q = useQuery({
    queryKey: ["analytics", from, to, group],
    queryFn: () => getAnalytics(from, to, group),
  });

  const a: Analytics | undefined = q.data;
  const maxRev = useMemo(
    () => Math.max(1, ...(a?.over_time ?? []).map((p) => parseFloat(String(p.revenue)) || 0)),
    [a],
  );

  return (
    <div className={cls.page}>
      <div className={cls.pageHead}>
        <h1>{t("analytics.title")}</h1>
      </div>

      <div className={cls.filterRow}>
        <label className={cls.inlineField}>
          {t("field.dateFrom")}
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className={cls.inlineField}>
          {t("field.dateTo")}
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className={cls.inlineField}>
          {t("analytics.group")}
          <select value={group} onChange={(e) => setGroup(e.target.value as "day" | "month")}>
            <option value="day">{t("analytics.byDay")}</option>
            <option value="month">{t("analytics.byMonth")}</option>
          </select>
        </label>
      </div>

      {q.isLoading ? (
        <Spinner />
      ) : q.error ? (
        <ErrorBox error={q.error} />
      ) : a ? (
        <>
          <div className={cls.kpiGrid}>
            <StatCard label={t("analytics.revenue")} value={money(a.revenue)} />
            <StatCard label={t("analytics.cogs")} value={money(a.cost)} tone="cost" />
            <StatCard label={t("analytics.profit")} value={money(a.profit)} tone="profit" />
            <StatCard label={t("analytics.margin")} value={`${a.margin_pct}%`} tone="profit" />
            <StatCard label={t("analytics.orders")} value={String(a.orders)} />
            <StatCard label={t("analytics.stockValue")} value={money(a.stock_value)} />
            <StatCard label={t("analytics.debt")} value={money(a.total_debt)} tone="cost" />
          </div>

          {/* Revenue / profit over time */}
          <Card title={t("analytics.dynamics")}>
            {a.over_time.length === 0 ? (
              <p className={cls.muted}>{t("analytics.noData")}</p>
            ) : (
              <div className={cls.chartScroll}>
                <div className={cls.barChart}>
                  {a.over_time.map((p) => {
                    const rev = parseFloat(String(p.revenue)) || 0;
                    const prof = parseFloat(String(p.profit)) || 0;
                    return (
                      <div className={cls.barCol} key={p.period} title={`${p.period}\n${t("analytics.revenue")}: ${money(rev)}\n${t("analytics.profit")}: ${money(prof)}`}>
                        <div className={cls.barTrack}>
                          <div
                            className={cls.barRevenue}
                            style={{ height: `${(rev / maxRev) * 100}%` }}
                          />
                          <div
                            className={cls.barProfit}
                            style={{ height: `${(Math.max(prof, 0) / maxRev) * 100}%` }}
                          />
                        </div>
                        <div className={cls.barLabel}>{p.period.slice(5)}</div>
                      </div>
                    );
                  })}
                </div>
                <div className={cls.chartLegend}>
                  <span><i className={cls.legendRevenue} /> {t("analytics.revenue")}</span>
                  <span><i className={cls.legendProfit} /> {t("analytics.profit")}</span>
                </div>
              </div>
            )}
          </Card>

          {/* Profit by product */}
          <Card title={t("analytics.byProduct")}>
            {a.by_product.length === 0 ? (
              <p className={cls.muted}>{t("analytics.noData")}</p>
            ) : (
              <table className={cls.table}>
                <thead>
                  <tr>
                    <th>{t("col.product")}</th>
                    <th className={cls.numCell}>{t("analytics.qtySold")}</th>
                    <th className={cls.numCell}>{t("analytics.revenue")}</th>
                    <th className={cls.numCell}>{t("analytics.cogs")}</th>
                    <th className={cls.numCell}>{t("analytics.profit")}</th>
                    <th className={cls.numCell}>{t("analytics.margin")}</th>
                  </tr>
                </thead>
                <tbody>
                  {a.by_product.map((r) => (
                    <tr key={r.product_id}>
                      <td>{r.product_name}</td>
                      <td className={cls.numCell}>{Number(r.qty_sold)}</td>
                      <td className={cls.numCell}>{money(r.revenue)}</td>
                      <td className={cls.numCell}>{money(r.cost)}</td>
                      <td className={cls.cx(cls.numCell, cls.strong)}>{money(r.profit)}</td>
                      <td className={cls.numCell}>{r.margin_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
