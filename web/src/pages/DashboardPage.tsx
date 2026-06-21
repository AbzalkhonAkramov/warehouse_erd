import { useQuery } from "@tanstack/react-query";
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
    <div className="page">
      <h1>{t("dashboard.title")}</h1>
      <div className="stat-grid">
        <Card>
          <Link to="/orders" className="plain-link">
            <Stat label={t("dashboard.pendingApprovals")} value={d.pending_orders} accent="#b45309" />
          </Link>
        </Card>
        <Card>
          <Stat label={t("dashboard.stockValue")} value={money(d.stock_value)} />
        </Card>
        <Card>
          <Link to="/invoices" className="plain-link">
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
          <table className="table">
            <thead>
              <tr>
                <th>{t("col.sku")}</th>
                <th>{t("col.product")}</th>
                <th className="num">{t("col.onHand")}</th>
                <th className="num">{t("col.min")}</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.data.map((s) => (
                <tr key={s.product_id}>
                  <td className="mono">{s.sku}</td>
                  <td>{s.product_name}</td>
                  <td className="num warn">{qty(s.quantity)}</td>
                  <td className="num">{qty(s.min_stock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">{t("dashboard.allAbove")}</div>
        )}
      </Card>
    </div>
  );
}
