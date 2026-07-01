import { useQuery } from "@tanstack/react-query";
import * as cls from "../ui/cls";
import { Link } from "react-router-dom";
import { getDashboard, listStock } from "../api/endpoints";
import { Card, ErrorBox, Spinner, Stat } from "../components/ui";
import { useI18n } from "../i18n";
import { money, qty } from "../lib/format";

export default function DashboardPage() {
  const { t } = useI18n();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });
  const lowStock = useQuery({ queryKey: ["stock", "low"], queryFn: () => listStock(true) });

  if (dash.isLoading) return <Spinner />;
  if (dash.error) return <ErrorBox error={dash.error} />;
  const d = dash.data!;

  return (
    <div className={cls.page}>
      <h1>{t("dashboard.title")}</h1>
      <div className={cls.statGrid}>
        <Card>
          <Link to="/orders" className={cls.plainLink}>
            <Stat label={t("dashboard.pendingApprovals")} value={d.pending_orders} accent="#b45309" />
          </Link>
        </Card>
        <Card>
          <Stat label={t("dashboard.stockValue")} value={money(d.stock_value)} />
        </Card>
        <Card>
          <Link to="/invoices" className={cls.plainLink}>
            <Stat label={t("dashboard.totalDebt")} value={money(d.total_debt)} accent="#b91c1c" />
          </Link>
        </Card>
        <Card>
          <Stat label={t("dashboard.lowStockItems")} value={d.low_stock_items} accent="#7c3aed" />
        </Card>
      </div>

      <Card title={t("dashboard.lowStockTitle")}>
        {lowStock.isLoading ? (
          <Spinner />
        ) : lowStock.data && lowStock.data.length > 0 ? (
          <table className={cls.table}>
            <thead>
              <tr>
                <th>{t("col.sku")}</th>
                <th>{t("col.product")}</th>
                <th className={cls.numCell}>{t("col.onHand")}</th>
                <th className={cls.numCell}>{t("col.min")}</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.data.map((s) => (
                <tr key={s.product_id}>
                  <td className={cls.mono}>{s.sku}</td>
                  <td>{s.product_name}</td>
                  <td className={cls.cx(cls.numCell, cls.warn)}>{qty(s.quantity)}</td>
                  <td className={cls.numCell}>{qty(s.min_stock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={cls.empty}>{t("dashboard.allAbove")}</div>
        )}
      </Card>
    </div>
  );
}
