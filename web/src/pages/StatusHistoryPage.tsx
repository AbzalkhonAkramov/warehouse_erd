import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listStatusHistory } from "../api/endpoints";
import { Card, Empty, ErrorBox, ExcelButton, Spinner } from "../components/ui";
import { useI18n } from "../i18n";
import { date } from "../lib/format";
import { exportExcel } from "../lib/excel";

export default function StatusHistoryPage() {
  const { t } = useI18n();
  const [orderId, setOrderId] = useState("");

  const history = useQuery({
    queryKey: ["status-history", orderId],
    queryFn: () => listStatusHistory(orderId ? Number(orderId) : undefined),
  });

  const label = (s?: string | null) => (s ? t(`status.${s}`) : "—");

  function exportRows() {
    if (!history.data) return;
    exportExcel(
      "status-history",
      [t("col.created"), "#", t("history.from"), t("history.to"), t("history.by")],
      history.data.map((h) => [
        date(h.created_at),
        h.order_no ?? h.sales_order_id,
        label(h.from_status),
        label(h.to_status),
        h.changed_by_name ?? "—",
      ]),
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t("history.title")}</h1>
        <ExcelButton onClick={exportRows} />
      </div>

      <Card>
        <div className="filter-grid">
          <label className="field">
            <span>{t("history.orderFilter")}</span>
            <input
              type="number"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder={t("history.orderPlaceholder")}
            />
          </label>
        </div>
      </Card>

      <Card>
        {history.isLoading ? (
          <Spinner />
        ) : history.error ? (
          <ErrorBox error={history.error} />
        ) : history.data && history.data.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>{t("col.created")}</th>
                <th>#</th>
                <th>{t("history.from")}</th>
                <th>{t("history.to")}</th>
                <th>{t("history.by")}</th>
              </tr>
            </thead>
            <tbody>
              {history.data.map((h) => (
                <tr key={h.id}>
                  <td>{date(h.created_at)}</td>
                  <td className="mono">{h.order_no ?? h.sales_order_id}</td>
                  <td>{label(h.from_status)}</td>
                  <td>
                    <span className="badge badge-blue">{label(h.to_status)}</span>
                  </td>
                  <td>{h.changed_by_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>{t("history.noChanges")}</Empty>
        )}
      </Card>
    </div>
  );
}
