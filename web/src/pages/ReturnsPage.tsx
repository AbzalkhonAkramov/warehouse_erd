import { useState } from "react";
import * as cls from "../ui/cls";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { approveReturn, listReturns, rejectReturn } from "../api/endpoints";
import type { ReturnRequest } from "../api/types";
import { Button, Card, Empty, ErrorBox, Modal, Spinner } from "../components/ui";
import { useI18n } from "../i18n";
import { qty as fmtQty, date } from "../lib/format";

export default function ReturnsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("pending");
  const [approving, setApproving] = useState<ReturnRequest | null>(null);

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
      <h1>{t("returns.title")}</h1>
      <p className={cls.muted} style={{ marginTop: -8, marginBottom: 16 }}>
        {t("returns.subtitle")}
      </p>

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
    </div>
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
