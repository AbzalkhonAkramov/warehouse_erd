import { useMemo } from "react";
import * as cls from "../ui/cls";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listStatusHistory } from "../api/endpoints";
import type { OrderStatusHistory } from "../api/types";
import { Card, Empty, ErrorBox, ExcelButton, Spinner } from "../components/ui";
import { useI18n } from "../i18n";
import { date } from "../lib/format";
import { exportExcel } from "../lib/excel";

export default function OrderHistoryPage() {
  const { id } = useParams();
  const oid = Number(id);
  const { t } = useI18n();

  const history = useQuery({
    queryKey: ["order-history", oid],
    queryFn: () => listStatusHistory(oid, true),
  });

  // Chronological: from creation (oldest) to the latest event.
  const rows = useMemo(
    () => [...(history.data ?? [])].sort((a, b) => a.id - b.id),
    [history.data],
  );
  const rootNo =
    rows.find((r) => r.order_no && !r.order_no.includes("."))?.order_no ?? String(oid);

  const label = (s?: string | null) => (s ? t(`status.${s}`) : "—");

  // A localized one-line description of an event — every event shows its status.
  function describe(h: OrderStatusHistory): string {
    const items = h.detail ? ` · ${h.detail}` : "";
    const no = h.related_order_no ?? "";
    switch (h.kind) {
      case "create":
        return `${t("ohist.created")} → ${label(h.to_status)}${items}`;
      case "fork_out":
        return `${t("ohist.forkedOut", { no })} (${label(h.to_status)})${items}`;
      case "fork_in":
        return `${t("ohist.forkedFrom", { no })} → ${label(h.to_status)}${items}`;
      default:
        return `${label(h.from_status)} → ${label(h.to_status)}${items}`;
    }
  }

  function exportRows() {
    exportExcel(
      `order-${rootNo}-history`,
      [t("col.created"), "#", t("ohist.event"), t("history.by")],
      rows.map((h) => [date(h.created_at), h.order_no ?? h.sales_order_id, describe(h), h.changed_by_name ?? "—"]),
    );
  }

  return (
    <div className={cls.page}>
      <div className={cls.pageHead}>
        <h1>{t("ohist.title", { no: rootNo })}</h1>
        <div className={cls.rowGap}>
          <ExcelButton onClick={exportRows} />
          <Link to="/orders" className={cls.btn.ghost}>
            ← {t("orders.title")}
          </Link>
        </div>
      </div>
      <p className={cls.muted} style={{ marginTop: -8 }}>
        {t("orders.historyTreeHint")}
      </p>

      <Card>
        {history.isLoading ? (
          <Spinner />
        ) : history.error ? (
          <ErrorBox error={history.error} />
        ) : rows.length > 0 ? (
          <table className={cls.table}>
            <thead>
              <tr>
                <th>{t("col.created")}</th>
                <th>#</th>
                <th>{t("ohist.event")}</th>
                <th>{t("history.by")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.id}>
                  <td className={cls.cx(cls.muted, cls.small)}>{date(h.created_at)}</td>
                  <td className={cls.cx(cls.mono, cls.strong)}>{h.order_no ?? h.sales_order_id}</td>
                  <td>{describe(h)}</td>
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
