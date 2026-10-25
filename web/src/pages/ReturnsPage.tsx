import { useMemo, useState } from "react";
import * as cls from "../ui/cls";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveReturn,
  createReturn,
  listOrders,
  listReturns,
  rejectReturn,
} from "../api/endpoints";
import type { ReturnRequest, SalesOrder } from "../api/types";
import { Button, Card, Empty, ErrorBox, Modal, Spinner } from "../components/ui";
import { useI18n } from "../i18n";
import { qty as fmtQty, money, date } from "../lib/format";

export default function ReturnsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [approving, setApproving] = useState<ReturnRequest | null>(null);
  const [creating, setCreating] = useState(false);

  const returns = useQuery({
    queryKey: ["returns", filter],
    queryFn: () => listReturns(filter === "all" ? undefined : filter),
  });

  const reject = useMutation({
    mutationFn: rejectReturn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["returns"] }),
  });

  const FILTERS = ["pending", "approved", "rejected", "all"];

  return (
    <div className={cls.page}>
      <div className={cls.pageHead}>
        <div>
          <h1>{t("returns.title")}</h1>
          <p className={cls.muted} style={{ margin: 0 }}>{t("returns.subtitle")}</p>
        </div>
        <Button onClick={() => setCreating(true)}>{t("returns.create")}</Button>
      </div>

      <div className={cls.filterRow}>
        {FILTERS.map((f) => (
          <button
            key={f}
            className={cls.cx(cls.chip, filter === f && cls.chipActive)}
            onClick={() => setFilter(f)}
          >
            {t(`returns.filter.${f}`)}
          </button>
        ))}
      </div>

      <Card>
        {returns.isLoading ? (
          <Spinner />
        ) : returns.error ? (
          <ErrorBox error={returns.error} />
        ) : returns.data && returns.data.length > 0 ? (
          <table className={cls.table}>
            <thead>
              <tr>
                <th>{t("col.customer")}</th>
                <th>{t("col.agent")}</th>
                <th>{t("returns.order")}</th>
                <th>{t("returns.goods")}</th>
                <th>{t("common.status")}</th>
                <th className={cls.actionsCol} />
              </tr>
            </thead>
            <tbody>
              {returns.data.map((r) => (
                <tr key={r.id}>
                  <td>{r.customer_name ?? `#${r.customer_id}`}</td>
                  <td className={cls.muted}>{r.agent_name ?? "—"}</td>
                  <td className={cls.mono}>#{r.order_no ?? r.sales_order_id}</td>
                  <td>
                    {r.lines
                      .map((l) => `${fmtQty(l.quantity)}× ${l.product_name ?? l.product_id}`)
                      .join(", ")}
                    {r.note ? <div className={cls.cx(cls.muted, cls.small)}>{r.note}</div> : null}
                    <div className={cls.cx(cls.muted, cls.small)}>{date(r.created_at)}</div>
                  </td>
                  <td>
                    <span
                      className={
                        r.status === "approved"
                          ? cls.badge.green
                          : r.status === "rejected"
                            ? cls.badge.gray
                            : cls.badge.amber
                      }
                    >
                      {t(`returns.status.${r.status}`)}
                    </span>
                  </td>
                  <td className={cls.actionsCol}>
                    {r.status === "pending" && (
                      <>
                        <Button variant="success" onClick={() => setApproving(r)}>
                          {t("returns.approve")}
                        </Button>
                        <Button
                          variant="danger"
                          disabled={reject.isPending}
                          onClick={() => reject.mutate(r.id)}
                        >
                          {t("returns.reject")}
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>{t("returns.empty")}</Empty>
        )}
      </Card>

      {approving && (
        <ApproveModal request={approving} onClose={() => setApproving(null)} />
      )}
      {creating && <CreateReturnModal onClose={() => setCreating(false)} />}
    </div>
  );
}

interface LineSel {
  checked: boolean;
  qty: string;
  max: number;
}

/** Manager records a return: pick a delivered/shipped order, choose which goods
 * came back and how many, and whether to restock. Applied immediately. */
function CreateReturnModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [orderId, setOrderId] = useState<number | "">("");
  const [rows, setRows] = useState<Record<number, LineSel>>({});
  const [restock, setRestock] = useState(true);
  const [note, setNote] = useState("");

  // Only delivered/shipped orders have goods that can be returned.
  const orders = useQuery({ queryKey: ["orders", "returnable"], queryFn: () => listOrders() });
  const returnable = useMemo(
    () => (orders.data ?? []).filter((o) => o.status === "shipped" || o.status === "delivered"),
    [orders.data],
  );
  const order = returnable.find((o) => o.id === orderId);

  function selectOrder(id: number | "") {
    setOrderId(id);
    const o = returnable.find((x) => x.id === id);
    const next: Record<number, LineSel> = {};
    o?.lines.forEach((l) => {
      const max = parseFloat(String(l.quantity));
      if (max > 0) next[l.product_id] = { checked: false, qty: String(max), max };
    });
    setRows(next);
  }

  const create = useMutation({
    mutationFn: () =>
      createReturn({
        sales_order_id: order!.id,
        restock,
        note: note || null,
        lines: Object.entries(rows)
          .filter(([, r]) => r.checked && parseFloat(r.qty) > 0)
          .map(([pid, r]) => ({ product_id: Number(pid), quantity: r.qty })),
      }),
    onSuccess: () => {
      ["returns", "orders", "customers", "invoices", "refunds"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      );
      onClose();
    },
  });

  const anySelected = Object.values(rows).some((r) => r.checked && parseFloat(r.qty) > 0);

  return (
    <Modal title={t("returns.create")} onClose={onClose}>
      <label className={cls.field}>
        <span>{t("returns.order")}</span>
        <select
          value={orderId}
          onChange={(e) => selectOrder(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">{t("returns.pickOrder")}</option>
          {returnable.map((o: SalesOrder) => (
            <option key={o.id} value={o.id}>
              #{o.order_no ?? o.id} · {o.customer_name ?? `#${o.customer_id}`} · {money(o.total)}
            </option>
          ))}
        </select>
      </label>

      {order && (
        <table className={cls.tableSub} style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th />
              <th>{t("col.product")}</th>
              <th className={cls.numCell}>{t("orders.available")}</th>
              <th className={cls.numCell}>{t("returns.qty")}</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l) => {
              const r = rows[l.product_id];
              if (!r) return null;
              return (
                <tr key={l.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={r.checked}
                      onChange={(e) =>
                        setRows((s) => ({ ...s, [l.product_id]: { ...r, checked: e.target.checked } }))
                      }
                    />
                  </td>
                  <td>{l.product_name ?? `#${l.product_id}`}</td>
                  <td className={cls.numCell}>{fmtQty(r.max)}</td>
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
                        setRows((s) => ({ ...s, [l.product_id]: { ...r, qty: e.target.value } }))
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {order && (
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

      <label className={cls.cx(cls.field, cls.fieldFull)} style={{ marginTop: 10 }}>
        <span>{t("orders.note")}</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      {create.error && <ErrorBox error={create.error} />}
      <div className={cls.modalActions}>
        <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
        <Button
          disabled={!order || !anySelected || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? t("common.saving") : t("returns.create")}
        </Button>
      </div>
    </Modal>
  );
}

function ApproveModal({ request, onClose }: { request: ReturnRequest; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [restock, setRestock] = useState(false);

  const approve = useMutation({
    mutationFn: () => approveReturn(request.id, restock),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["returns"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      onClose();
    },
  });

  return (
    <Modal title={t("returns.approveTitle")} onClose={onClose}>
      <p className={cls.muted} style={{ marginTop: 0 }}>
        {t("returns.approveHint")}
      </p>
      <div className={cls.refundDest}>
        <label className={cls.radio}>
          <input type="radio" checked={!restock} onChange={() => setRestock(false)} />
          {t("orders.holdRefunded")}
        </label>
        <label className={cls.radio}>
          <input type="radio" checked={restock} onChange={() => setRestock(true)} />
          {t("orders.restock")}
        </label>
      </div>
      {approve.error && <ErrorBox error={approve.error} />}
      <div className={cls.modalActions}>
        <Button variant="ghost" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button variant="success" disabled={approve.isPending} onClick={() => approve.mutate()}>
          {approve.isPending ? t("common.saving") : t("returns.approve")}
        </Button>
      </div>
    </Modal>
  );
}
