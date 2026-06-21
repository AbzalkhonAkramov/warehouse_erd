import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listCustomers,
  listOrders,
  listProducts,
  listUsers,
  moveOrder,
  updateOrder,
  type MoveLineInput,
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
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n";
import { date, money, qty } from "../lib/format";
import { exportExcel } from "../lib/excel";

const FILTERS: { value: string; labelKey: string }[] = [
  { value: "new", labelKey: "orders.filter.new" },
  { value: "shipped", labelKey: "orders.filter.shipped" },
  { value: "delivered", labelKey: "orders.filter.delivered" },
  { value: "refund", labelKey: "orders.filter.refund" },
  { value: "cancelled", labelKey: "orders.filter.cancelled" },
  { value: "all", labelKey: "orders.filter.all" },
  { value: "archived", labelKey: "orders.filter.archived" },
];

const MOVE_TARGETS: SalesOrderStatus[] = ["shipped", "delivered", "refund", "cancelled"];

interface MoveRow {
  checked: boolean;
  qty: string;
  max: number;
}

export default function OrdersPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isManager = user?.role === "admin" || user?.role === "manager";

  const [filter, setFilter] = useState("new");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editDeliverer, setEditDeliverer] = useState("");
  const [moveSel, setMoveSel] = useState<SalesOrderStatus>("shipped");
  const [actionError, setActionError] = useState<string | null>(null);

  const [moving, setMoving] = useState<SalesOrder | null>(null);
  const [moveTarget, setMoveTarget] = useState<SalesOrderStatus>("shipped");
  const [moveRows, setMoveRows] = useState<Record<number, MoveRow>>({});
  const [restock, setRestock] = useState(true);

  const isArchived = filter === "archived";
  const orders = useQuery({
    queryKey: ["orders", filter],
    queryFn: () =>
      isArchived
        ? listOrders(undefined, true)
        : listOrders(filter === "all" ? undefined : (filter as SalesOrderStatus), false),
  });
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  const agents = useQuery({ queryKey: ["users", "agent"], queryFn: () => listUsers("agent") });
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });

  const customerName = useMemo(() => {
    const m = new Map<number, string>();
    customers.data?.forEach((c) => m.set(c.id, c.name));
    return (id: number) => m.get(id) ?? `#${id}`;
  }, [customers.data]);
  const agentName = useMemo(() => {
    const m = new Map<number, string>();
    agents.data?.forEach((a) => m.set(a.id, a.full_name));
    return (id: number) => m.get(id) ?? `#${id}`;
  }, [agents.data]);
  const productName = useMemo(() => {
    const m = new Map<number, string>();
    products.data?.forEach((p) => m.set(p.id, p.name));
    return (id: number) => m.get(id) ?? `#${id}`;
  }, [products.data]);

  function openRow(o: SalesOrder) {
    if (expanded === o.id) return setExpanded(null);
    setExpanded(o.id);
    setEditDeliverer(o.deliverer ?? "");
    setMoveSel("shipped");
    setActionError(null);
  }

  function refresh() {
    ["orders", "dashboard", "invoices", "refunds"].forEach((k) =>
      qc.invalidateQueries({ queryKey: [k] }),
    );
  }
  const onError = (e: unknown) =>
    setActionError(e instanceof Error ? e.message : t("common.somethingWrong"));

  const saveDeliverer = useMutation({
    mutationFn: (o: SalesOrder) => updateOrder(o.id, { deliverer: editDeliverer }),
    onSuccess: refresh,
    onError,
  });

  function openMove(o: SalesOrder, target: SalesOrderStatus) {
    const rows: Record<number, MoveRow> = {};
    o.lines.forEach((l) => {
      const max = parseFloat(String(l.quantity));
      if (max > 0) rows[l.product_id] = { checked: true, qty: String(max), max };
    });
    setMoveRows(rows);
    setRestock(true);
    setMoveTarget(target);
    setMoving(o);
  }

  const move = useMutation({
    mutationFn: (o: SalesOrder) => {
      const entries = Object.entries(moveRows);
      const allFull = entries.every(([, r]) => r.checked && parseFloat(r.qty) >= r.max);
      const lines: MoveLineInput[] | undefined = allFull
        ? undefined
        : entries
            .filter(([, r]) => r.checked && parseFloat(r.qty) > 0)
            .map(([pid, r]) => ({ product_id: Number(pid), quantity: r.qty }));
      return moveOrder(o.id, {
        status: moveTarget,
        lines,
        restock: moveTarget === "refund" ? restock : undefined,
      });
    },
    onSuccess: () => {
      setMoving(null);
      refresh();
    },
    onError,
  });

  function exportOrders() {
    if (!orders.data) return;
    exportExcel(
      "orders",
      ["#", t("col.customer"), t("col.agent"), t("col.created"), t("col.total"), t("common.status"), t("orders.deliverer")],
      orders.data.map((o) => [
        o.id,
        customerName(o.customer_id),
        o.agent_name ?? agentName(o.agent_id),
        date(o.created_at),
        money(o.total),
        t(`status.${o.status}`),
        o.deliverer ?? "",
      ]),
    );
  }

  const moveLines = moving?.lines.filter((l) => moveRows[l.product_id]) ?? [];

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t("orders.title")}</h1>
        <div className="row-gap">
          <Link className="btn btn-primary" to="/orders/new">
            {t("orders.new")}
          </Link>
          <ExcelButton onClick={exportOrders} />
        </div>
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
                <th>{t("orders.deliverer")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.data.map((o) => (
                <Fragment key={o.id}>
                  <tr className="clickable" onClick={() => openRow(o)}>
                    <td className="mono">{o.id}</td>
                    <td>{customerName(o.customer_id)}</td>
                    <td>{o.agent_name ?? agentName(o.agent_id)}</td>
                    <td>{date(o.created_at)}</td>
                    <td className="num strong">{money(o.total)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td>{o.deliverer || "—"}</td>
                  </tr>
                  {expanded === o.id && (
                    <tr className="detail-row">
                      <td colSpan={7}>
                        <div className="order-detail">
                          {o.parent_order_id && (
                            <p className="note muted">
                              ↩ {t("orders.refundOf", { id: o.parent_order_id })}
                            </p>
                          )}
                          <table className="table sub">
                            <thead>
                              <tr>
                                <th>{t("col.product")}</th>
                                <th className="num">{t("col.qty")}</th>
                                <th className="num">{t("col.unitPrice")}</th>
                                <th className="num">{t("col.lineTotal")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {o.lines.map((l) => (
                                <tr key={l.id}>
                                  <td>{productName(l.product_id)}</td>
                                  <td className="num">{qty(l.quantity)}</td>
                                  <td className="num">{money(l.unit_price)}</td>
                                  <td className="num">{money(l.line_total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {o.note && (
                            <p className="note">
                              {t("orders.note")}: {o.note}
                            </p>
                          )}
                          {o.created_by_name && o.created_by_id !== o.agent_id && (
                            <p className="note muted">
                              {t("orders.createdBy")}: {o.created_by_name}
                            </p>
                          )}

                          {isManager ? (
                            <div className="order-editor" onClick={(e) => e.stopPropagation()}>
                              <label className="field">
                                <span>{t("orders.deliWho")}</span>
                                <input
                                  value={editDeliverer}
                                  disabled={o.status !== "new"}
                                  onChange={(e) => setEditDeliverer(e.target.value)}
                                  placeholder={
                                    o.status === "new"
                                      ? t("orders.deliPlaceholder")
                                      : t("orders.deliLocked")
                                  }
                                />
                              </label>
                              <Button
                                variant="ghost"
                                disabled={saveDeliverer.isPending || o.status !== "new"}
                                onClick={() => saveDeliverer.mutate(o)}
                              >
                                {t("orders.save")}
                              </Button>
                              <label className="field">
                                <span>{t("orders.moveTo")}</span>
                                <select
                                  value={moveSel}
                                  onChange={(e) => setMoveSel(e.target.value as SalesOrderStatus)}
                                >
                                  {MOVE_TARGETS.map((s) => (
                                    <option key={s} value={s}>
                                      {t(`status.${s}`)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <Button onClick={() => openMove(o, moveSel)}>
                                {t("orders.move")}
                              </Button>
                            </div>
                          ) : (
                            <p className="note muted">{t("orders.managerOnly")}</p>
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

      {moving && (
        <Modal
          title={t("orders.moveTitle", { id: moving.id, status: t(`status.${moveTarget}`) })}
          onClose={() => setMoving(null)}
        >
          <p className="muted small" style={{ marginTop: 0 }}>
            {t("orders.moveHint")}
          </p>
          <table className="table sub">
            <thead>
              <tr>
                <th></th>
                <th>{t("col.product")}</th>
                <th className="num">{t("orders.available")}</th>
                <th className="num">{t("orders.moveQty")}</th>
              </tr>
            </thead>
            <tbody>
              {moveLines.map((l) => {
                const r = moveRows[l.product_id];
                return (
                  <tr key={l.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={r.checked}
                        onChange={(e) =>
                          setMoveRows((s) => ({
                            ...s,
                            [l.product_id]: { ...r, checked: e.target.checked },
                          }))
                        }
                      />
                    </td>
                    <td>{productName(l.product_id)}</td>
                    <td className="num">{qty(r.max)}</td>
                    <td className="num">
                      <input
                        className="qty-input"
                        type="number"
                        min="0"
                        max={r.max}
                        step="0.001"
                        value={r.qty}
                        disabled={!r.checked}
                        onChange={(e) =>
                          setMoveRows((s) => ({
                            ...s,
                            [l.product_id]: { ...r, qty: e.target.value },
                          }))
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {moveTarget === "refund" && (
            <div className="refund-dest">
              <label className="radio">
                <input type="radio" checked={restock} onChange={() => setRestock(true)} />
                {t("orders.restock")}
              </label>
              <label className="radio">
                <input type="radio" checked={!restock} onChange={() => setRestock(false)} />
                {t("orders.holdRefunded")}
              </label>
            </div>
          )}

          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setMoving(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant={moveTarget === "cancelled" || moveTarget === "refund" ? "danger" : "primary"}
              disabled={
                move.isPending ||
                !Object.values(moveRows).some((r) => r.checked && parseFloat(r.qty) > 0)
              }
              onClick={() => moving && move.mutate(moving)}
            >
              {move.isPending ? t("common.saving") : t("orders.confirmMove")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
