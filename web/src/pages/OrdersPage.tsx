import { Fragment, useMemo, useState } from "react";
import * as cls from "../ui/cls";
import { Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const isManager = user?.role === "admin" || user?.role === "manager";

  const [filter, setFilter] = useState("new");
  const [agentFilter, setAgentFilter] = useState<number | "">("");
  const [customerFilter, setCustomerFilter] = useState<number | "">("");
  const [idFilter, setIdFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editDelivererId, setEditDelivererId] = useState<number | "">("");
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
  const deliverers = useQuery({
    queryKey: ["users", "deliverer"],
    queryFn: () => listUsers("deliverer"),
  });
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

  // Client-side filters over the loaded list: agent, customer, order id, date.
  const shownOrders = useMemo(() => {
    const idq = idFilter.trim();
    return (orders.data ?? []).filter((o) => {
      if (agentFilter !== "" && o.agent_id !== agentFilter) return false;
      if (customerFilter !== "" && o.customer_id !== customerFilter) return false;
      if (idq && !String(o.order_no ?? o.id).includes(idq)) return false;
      const day = (o.created_at ?? "").slice(0, 10); // YYYY-MM-DD
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      return true;
    });
  }, [orders.data, agentFilter, customerFilter, idFilter, dateFrom, dateTo]);

  function openRow(o: SalesOrder) {
    if (expanded === o.id) return setExpanded(null);
    setExpanded(o.id);
    setEditDelivererId(o.deliverer_id ?? "");
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
    mutationFn: (o: SalesOrder) =>
      updateOrder(o.id, { deliverer_id: editDelivererId === "" ? undefined : editDelivererId }),
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
    if (!shownOrders.length) return;
    exportExcel(
      "orders",
      ["#", t("col.customer"), t("col.agent"), t("col.created"), t("col.total"), t("common.status"), t("orders.deliverer")],
      shownOrders.map((o) => [
        o.order_no ?? o.id,
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
    <div className={cls.page}>
      <div className={cls.pageHead}>
        <h1>{t("orders.title")}</h1>
        <div className={cls.rowGap}>
          <Link className={cls.btn.primary} to="/orders/new">
            {t("orders.new")}
          </Link>
          <ExcelButton onClick={exportOrders} />
        </div>
      </div>

      <div className={cls.filterRow}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={cls.cx(cls.chip, filter === f.value && cls.chipActive)}
            onClick={() => setFilter(f.value)}
          >
            {t(f.labelKey)}
          </button>
        ))}
        <label className={cls.inlineField}>
          {t("col.agent")}
          <select
            value={agentFilter}
            onChange={(e) =>
              setAgentFilter(e.target.value === "" ? "" : Number(e.target.value))
            }
          >
            <option value="">{t("orders.allAgents")}</option>
            {agents.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className={cls.inlineField}>
          {t("col.customer")}
          <select
            value={customerFilter}
            onChange={(e) =>
              setCustomerFilter(e.target.value === "" ? "" : Number(e.target.value))
            }
          >
            <option value="">{t("orders.allCustomers")}</option>
            {customers.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={cls.inlineField}>
          #
          <input
            className={cls.qtyInput}
            value={idFilter}
            onChange={(e) => setIdFilter(e.target.value)}
            placeholder={t("orders.idPlaceholder")}
          />
        </label>
        <label className={cls.inlineField}>
          {t("field.dateFrom")}
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label className={cls.inlineField}>
          {t("field.dateTo")}
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
      </div>

      {actionError && <div className={cls.errorBox}>{actionError}</div>}

      <Card>
        {orders.isLoading ? (
          <Spinner />
        ) : orders.error ? (
          <ErrorBox error={orders.error} />
        ) : shownOrders.length > 0 ? (
          <table className={cls.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>{t("col.customer")}</th>
                <th>{t("col.agent")}</th>
                <th>{t("col.created")}</th>
                <th className={cls.numCell}>{t("col.total")}</th>
                <th>{t("common.status")}</th>
                <th>{t("orders.deliverer")}</th>
              </tr>
            </thead>
            <tbody>
              {shownOrders.map((o) => (
                <Fragment key={o.id}>
                  <tr className={cls.clickable} onClick={() => openRow(o)}>
                    <td className={cls.mono}>{o.order_no ?? o.id}</td>
                    <td>{customerName(o.customer_id)}</td>
                    <td>{o.agent_name ?? agentName(o.agent_id)}</td>
                    <td>{date(o.created_at)}</td>
                    <td className={cls.cx(cls.numCell, cls.strong)}>{money(o.total)}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td>{o.deliverer || "—"}</td>
                  </tr>
                  {expanded === o.id && (
                    <tr className={cls.detailRowTd}>
                      <td colSpan={7}>
                        <div className={cls.orderDetail}>
                          {o.parent_order_id && (
                            <p className={cls.note}>
                              ↩ {t("orders.refundOf", { id: o.parent_order_id })}
                            </p>
                          )}
                          <table className={cls.tableSub}>
                            <thead>
                              <tr>
                                <th>{t("col.product")}</th>
                                <th className={cls.numCell}>{t("col.qty")}</th>
                                <th className={cls.numCell}>{t("col.unitPrice")}</th>
                                <th className={cls.numCell}>{t("col.lineTotal")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {o.lines.map((l) => (
                                <tr key={l.id}>
                                  <td>{productName(l.product_id)}</td>
                                  <td className={cls.numCell}>{qty(l.quantity)}</td>
                                  <td className={cls.numCell}>{money(l.unit_price)}</td>
                                  <td className={cls.numCell}>{money(l.line_total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {o.note && (
                            <p className={cls.note}>
                              {t("orders.note")}: {o.note}
                            </p>
                          )}
                          {o.created_by_name && o.created_by_id !== o.agent_id && (
                            <p className={cls.note}>
                              {t("orders.createdBy")}: {o.created_by_name}
                            </p>
                          )}

                          {(o.status === "shipped" || o.status === "delivered") && (
                            <Button
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/orders/${o.id}/receipt`);
                              }}
                            >
                              🧾 {t("orders.receipt")}
                            </Button>
                          )}
                          {isManager && (
                            <Button
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/orders/${o.id}/history`);
                              }}
                            >
                              🕓 {t("orders.fullHistory")}
                            </Button>
                          )}

                          {isManager ? (
                            <div className={cls.orderEditor} onClick={(e) => e.stopPropagation()}>
                              <label className={cls.field}>
                                <span>{t("orders.deliWho")}</span>
                                <select
                                  value={editDelivererId}
                                  disabled={o.status !== "new"}
                                  onChange={(e) =>
                                    setEditDelivererId(
                                      e.target.value === "" ? "" : Number(e.target.value),
                                    )
                                  }
                                >
                                  <option value="">{t("orders.deliPlaceholder")}</option>
                                  {deliverers.data?.map((d) => (
                                    <option key={d.id} value={d.id}>
                                      {d.full_name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <Button
                                variant="ghost"
                                disabled={saveDeliverer.isPending || o.status !== "new"}
                                onClick={() => saveDeliverer.mutate(o)}
                              >
                                {t("orders.save")}
                              </Button>
                              <label className={cls.field}>
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
                            <p className={cls.note}>{t("orders.managerOnly")}</p>
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
          title={t("orders.moveTitle", { id: moving.order_no ?? moving.id, status: t(`status.${moveTarget}`) })}
          onClose={() => setMoving(null)}
        >
          <p className={cls.cx(cls.muted, cls.small)} style={{ marginTop: 0 }}>
            {t("orders.moveHint")}
          </p>
          <table className={cls.tableSub}>
            <thead>
              <tr>
                <th></th>
                <th>{t("col.product")}</th>
                <th className={cls.numCell}>{t("orders.available")}</th>
                <th className={cls.numCell}>{t("orders.moveQty")}</th>
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
                    <td className={cls.numCell}>{qty(r.max)}</td>
                    <td className={cls.numCell}>
                      <input
                        className={cls.qtyInput}
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
            <div className={cls.refundDest}>
              <label className={cls.radio}>
                <input type="radio" checked={restock} onChange={() => setRestock(true)} />
                {t("orders.restock")}
              </label>
              <label className={cls.radio}>
                <input type="radio" checked={!restock} onChange={() => setRestock(false)} />
                {t("orders.holdRefunded")}
              </label>
            </div>
          )}

          <div className={cls.modalActions}>
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
