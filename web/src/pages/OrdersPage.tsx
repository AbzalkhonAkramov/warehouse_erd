import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveOrder,
  deliverOrder,
  listCustomers,
  listOrders,
  listUsers,
  pickOrder,
  rejectOrder,
} from "../api/endpoints";
import type { SalesOrder, SalesOrderStatus } from "../api/types";
import {
  Button,
  Card,
  Empty,
  ErrorBox,
  ExcelButton,
  Modal,
  Spinner,
  StatusBadge,
} from "../components/ui";
import { useI18n } from "../i18n";
import { date, money, qty } from "../lib/format";
import { exportExcel } from "../lib/excel";

const FILTERS: { value: SalesOrderStatus | "all"; labelKey: string }[] = [
  { value: "pending", labelKey: "orders.filter.pending" },
  { value: "approved", labelKey: "orders.filter.approved" },
  { value: "picking", labelKey: "orders.filter.picking" },
  { value: "delivered", labelKey: "orders.filter.delivered" },
  { value: "rejected", labelKey: "orders.filter.rejected" },
  { value: "all", labelKey: "orders.filter.all" },
];

export default function OrdersPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<SalesOrderStatus | "all">("pending");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<SalesOrder | null>(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const orders = useQuery({
    queryKey: ["orders", filter],
    queryFn: () => listOrders(filter === "all" ? undefined : filter),
  });
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  const agents = useQuery({ queryKey: ["users", "agent"], queryFn: () => listUsers("agent") });

  const customerName = useMemo(() => {
    const map = new Map<number, string>();
    customers.data?.forEach((c) => map.set(c.id, c.name));
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [customers.data]);

  const agentName = useMemo(() => {
    const map = new Map<number, string>();
    agents.data?.forEach((a) => map.set(a.id, a.full_name));
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [agents.data]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const onError = (e: unknown) =>
    setActionError(e instanceof Error ? e.message : t("common.somethingWrong"));

  const approve = useMutation({
    mutationFn: approveOrder,
    onSuccess: refresh,
    onError,
  });
  const pick = useMutation({ mutationFn: pickOrder, onSuccess: refresh, onError });
  const deliver = useMutation({ mutationFn: deliverOrder, onSuccess: refresh, onError });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => rejectOrder(id, reason),
    onSuccess: () => {
      setRejecting(null);
      setReason("");
      refresh();
    },
    onError,
  });

  function exportOrders() {
    if (!orders.data) return;
    exportExcel(
      "orders",
      ["#", t("col.customer"), t("col.agent"), t("col.created"), t("col.total"), t("common.status")],
      orders.data.map((o) => [
        o.id,
        customerName(o.customer_id),
        agentName(o.agent_id),
        date(o.created_at),
        money(o.total),
        t(`status.${o.status}`),
      ]),
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t("orders.title")}</h1>
        <ExcelButton onClick={exportOrders} />
      </div>

      <div className="filter-row">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={`chip${filter === f.value ? " active" : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {actionError && <div className="error-box">{actionError}</div>}

      <Card>
        {orders.isLoading ? (
          <Spinner />
        ) : orders.error ? (
          <ErrorBox error={orders.error} />
        ) : orders.data && orders.data.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("col.customer")}</th>
                <th>{t("col.agent")}</th>
                <th>{t("col.created")}</th>
                <th className="num">{t("col.total")}</th>
                <th>{t("common.status")}</th>
                <th className="actions-col">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.data.map((o) => (
                <Fragment key={o.id}>
                  <tr className="clickable" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                    <td className="mono">{o.id}</td>
                    <td>{customerName(o.customer_id)}</td>
                    <td>{agentName(o.agent_id)}</td>
                    <td>{date(o.created_at)}</td>
                    <td className="num strong">{money(o.total)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="actions-col" onClick={(e) => e.stopPropagation()}>
                      {o.status === "pending" && (
                        <>
                          <Button
                            variant="success"
                            disabled={approve.isPending}
                            onClick={() => approve.mutate(o.id)}
                          >
                            {t("orders.approve")}
                          </Button>
                          <Button variant="danger" onClick={() => setRejecting(o)}>
                            {t("orders.reject")}
                          </Button>
                        </>
                      )}
                      {o.status === "approved" && (
                        <Button variant="ghost" onClick={() => pick.mutate(o.id)}>
                          {t("orders.startPicking")}
                        </Button>
                      )}
                      {o.status === "picking" && (
                        <Button variant="ghost" onClick={() => deliver.mutate(o.id)}>
                          {t("orders.markDelivered")}
                        </Button>
                      )}
                    </td>
                  </tr>
                  {expanded === o.id && (
                    <tr className="detail-row">
                      <td colSpan={7}>
                        <div className="order-detail">
                          <table className="table sub">
                            <thead>
                              <tr>
                                <th>{t("col.productNum")}</th>
                                <th className="num">{t("col.qty")}</th>
                                <th className="num">{t("col.unitPrice")}</th>
                                <th className="num">{t("col.lineTotal")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {o.lines.map((l) => (
                                <tr key={l.id}>
                                  <td className="mono">{l.product_id}</td>
                                  <td className="num">{qty(l.quantity)}</td>
                                  <td className="num">{money(l.unit_price)}</td>
                                  <td className="num">{money(l.line_total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {o.note && <p className="note">{t("orders.note")}: {o.note}</p>}
                          {o.rejection_reason && (
                            <p className="note warn">
                              {t("orders.rejectedLabel")}: {o.rejection_reason}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>{t("orders.empty")}</Empty>
        )}
      </Card>

      {rejecting && (
        <Modal title={t("orders.rejectTitle", { id: rejecting.id })} onClose={() => setRejecting(null)}>
          <label className="field">
            <span>{t("field.reason")}</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={t("orders.reasonPlaceholder")}
            />
          </label>
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim() || reject.isPending}
              onClick={() => reject.mutate({ id: rejecting.id, reason: reason.trim() })}
            >
              {t("orders.confirmReject")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
