import { useEffect, useMemo, useState } from "react";
import * as cls from "../ui/cls";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelStockCount,
  completeStockCount,
  getStockCount,
  listStockCounts,
  saveStockCountLines,
  startStockCount,
  uploadUrl,
  type StockCountLineIn,
} from "../api/endpoints";
import type { StockCountLine } from "../api/types";
import { Button, Card, Empty, ErrorBox, Modal, Spinner } from "../components/ui";
import { useI18n } from "../i18n";
import { qty as fmtQty, date } from "../lib/format";

const STATUS_BADGE: Record<string, string> = {
  draft: cls.badge.gray,
  open: cls.badge.amber,
  completed: cls.badge.green,
  cancelled: cls.badge.gray,
};

export default function InventoryPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);

  const counts = useQuery({ queryKey: ["stock-counts"], queryFn: listStockCounts });

  const start = useMutation({
    mutationFn: (draft: boolean) => startStockCount({ draft }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["stock-counts"] });
      setActiveId(c.id);
    },
  });

  if (activeId !== null) {
    return <CountEditor id={activeId} onBack={() => setActiveId(null)} />;
  }

  return (
    <div className={cls.page}>
      <div className={cls.pageHead}>
        <div>
          <h1>{t("inventory.title")}</h1>
          <p className={cls.muted} style={{ margin: 0 }}>{t("inventory.subtitle")}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="ghost" onClick={() => start.mutate(true)} disabled={start.isPending}>
            {t("inventory.startDraft")}
          </Button>
          <Button onClick={() => start.mutate(false)} disabled={start.isPending}>
            {start.isPending ? t("common.saving") : t("inventory.start")}
          </Button>
        </div>
      </div>

      {start.error && <ErrorBox error={start.error} />}

      <Card>
        {counts.isLoading ? (
          <Spinner />
        ) : counts.error ? (
          <ErrorBox error={counts.error} />
        ) : counts.data && counts.data.length > 0 ? (
          <table className={cls.table}>
            <thead>
              <tr>
                <th>{t("inventory.when")}</th>
                <th>{t("col.author")}</th>
                <th>{t("common.status")}</th>
                <th className={cls.numCell}>{t("inventory.counted")}</th>
                <th className={cls.numCell}>{t("inventory.discrepancies")}</th>
                <th className={cls.actionsCol} />
              </tr>
            </thead>
            <tbody>
              {counts.data.map((c) => (
                <tr key={c.id}>
                  <td>
                    {date(c.created_at)}
                    {c.note ? <div className={cls.cx(cls.muted, cls.small)}>{c.note}</div> : null}
                  </td>
                  <td className={cls.muted}>{c.created_by_name ?? "—"}</td>
                  <td>
                    <span className={STATUS_BADGE[c.status] ?? cls.badge.gray}>
                      {t(`inventory.status.${c.status}`)}
                    </span>
                  </td>
                  <td className={cls.numCell}>
                    {c.counted} / {c.total_products}
                  </td>
                  <td className={cls.numCell}>
                    {c.discrepancies > 0 ? (
                      <span className={cls.badge.red}>{c.discrepancies}</span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className={cls.actionsCol}>
                    <Button variant="ghost" onClick={() => setActiveId(c.id)}>
                      {c.status === "open" || c.status === "draft"
                        ? t("inventory.continue")
                        : t("inventory.view")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>{t("inventory.empty")}</Empty>
        )}
      </Card>
    </div>
  );
}

function CountEditor({ id, onBack }: { id: number; onBack: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const count = useQuery({
    queryKey: ["stock-count", id],
    queryFn: () => getStockCount(id),
  });

  // Local edits: product_id -> counted string ("" = not counted).
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [seeded, setSeeded] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  useEffect(() => {
    if (count.data && !seeded) {
      const seed: Record<number, string> = {};
      count.data.lines.forEach((l) => {
        seed[l.product_id] = l.counted_qty == null ? "" : String(l.counted_qty);
      });
      setCounts(seed);
      setSeeded(true);
    }
  }, [count.data, seeded]);

  const payload = (): StockCountLineIn[] =>
    Object.entries(counts).map(([pid, v]) => ({
      product_id: Number(pid),
      counted_qty: v.trim() === "" ? null : v,
    }));

  const save = useMutation({
    mutationFn: () => saveStockCountLines(id, payload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-counts"] });
      qc.invalidateQueries({ queryKey: ["stock-count", id] });
    },
  });
  const complete = useMutation({
    mutationFn: (opts: { apply: boolean; exclude: number[] }) =>
      completeStockCount(id, {
        lines: payload(),
        apply: opts.apply,
        exclude_product_ids: opts.exclude,
      }),
    onSuccess: () => {
      ["stock-counts", "stock", "products"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      );
      onBack();
    },
  });
  const cancel = useMutation({
    mutationFn: () => cancelStockCount(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-counts"] });
      onBack();
    },
  });

  const status = count.data?.status;
  const editable = status === "open" || status === "draft";
  const completed = status === "completed";
  const countedN = useMemo(
    () => Object.values(counts).filter((v) => v.trim() !== "").length,
    [counts],
  );

  function setQty(pid: number, v: string) {
    setCounts((s) => ({ ...s, [pid]: v }));
  }

  function diff(line: StockCountLine): number | null {
    const v = counts[line.product_id];
    if (v == null || v.trim() === "") return null;
    return parseFloat(v) - parseFloat(String(line.system_qty));
  }

  // On a completed count, SKUs that were excluded from the correction.
  const exceptions = useMemo(
    () =>
      completed && count.data?.apply_stock
        ? count.data.lines.filter((l) => l.applied === false && l.counted_qty != null)
        : [],
    [completed, count.data],
  );

  return (
    <div className={cls.page}>
      <div className={cls.pageHead}>
        <div>
          <h1>{t("inventory.countTitle", { id: String(id) })}</h1>
          <p className={cls.muted} style={{ margin: 0 }}>
            {count.data
              ? `${t(`inventory.status.${count.data.status}`)} · ${t("inventory.counted")}: ${countedN} / ${count.data.lines.length}`
              : ""}
          </p>
        </div>
        <Button variant="ghost" onClick={onBack}>{t("inventory.back")}</Button>
      </div>

      {completed && count.data && !count.data.apply_stock && (
        <div className={cls.cx(cls.badge.gray)} style={{ marginBottom: 12, display: "inline-block" }}>
          {t("inventory.reportOnly")}
        </div>
      )}

      <Card>
        {count.isLoading ? (
          <Spinner />
        ) : count.error ? (
          <ErrorBox error={count.error} />
        ) : count.data ? (
          <table className={cls.table}>
            <thead>
              <tr>
                <th style={{ width: 52 }} />
                <th>{t("col.product")}</th>
                <th className={cls.numCell}>{t("inventory.systemQty")}</th>
                <th className={cls.numCell}>{t("inventory.countedQty")}</th>
                <th className={cls.numCell}>{t("inventory.diff")}</th>
                {completed && <th className={cls.numCell}>{t("inventory.appliedCol")}</th>}
              </tr>
            </thead>
            <tbody>
              {count.data.lines.map((l) => {
                const d = diff(l);
                return (
                  <tr key={l.product_id}>
                    <td>
                      {l.image_path ? (
                        <img
                          src={uploadUrl(l.image_path)}
                          alt={l.product_name}
                          style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }}
                        />
                      ) : (
                        <div
                          style={{ width: 40, height: 40, borderRadius: 6, background: "var(--muted-bg, #f1f5f9)" }}
                        />
                      )}
                    </td>
                    <td>
                      {l.product_name}
                      <div className={cls.cx(cls.muted, cls.small, cls.mono)}>{l.sku}</div>
                    </td>
                    <td className={cls.cx(cls.numCell, cls.mono)}>
                      {fmtQty(l.system_qty)} {l.unit}
                    </td>
                    <td className={cls.numCell}>
                      <input
                        className={cls.qtyInput}
                        type="number"
                        min="0"
                        step="0.001"
                        disabled={!editable}
                        placeholder="—"
                        value={counts[l.product_id] ?? ""}
                        onChange={(e) => setQty(l.product_id, e.target.value)}
                      />
                    </td>
                    <td className={cls.numCell}>
                      {d == null ? (
                        <span className={cls.muted}>—</span>
                      ) : d === 0 ? (
                        <span className={cls.badge.green}>0</span>
                      ) : (
                        <span className={d > 0 ? cls.badge.blue : cls.badge.red}>
                          {d > 0 ? "+" : ""}
                          {fmtQty(d)}
                        </span>
                      )}
                    </td>
                    {completed && (
                      <td className={cls.numCell}>
                        {l.counted_qty == null ? (
                          <span className={cls.muted}>—</span>
                        ) : l.applied ? (
                          <span className={cls.badge.green}>{t("inventory.applied")}</span>
                        ) : (
                          <span className={cls.badge.amber}>{t("inventory.excluded")}</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty>{t("inventory.empty")}</Empty>
        )}
      </Card>

      {exceptions.length > 0 && (
        <Card>
          <h3 style={{ marginTop: 0 }}>{t("inventory.exceptions")}</h3>
          <table className={cls.table}>
            <tbody>
              {exceptions.map((l) => (
                <tr key={l.product_id}>
                  <td>
                    {l.product_name}
                    <div className={cls.cx(cls.muted, cls.small, cls.mono)}>{l.sku}</div>
                  </td>
                  <td className={cls.cx(cls.numCell, cls.mono)}>
                    {fmtQty(l.system_qty)} → {l.counted_qty != null ? fmtQty(l.counted_qty) : "—"} {l.unit}
                  </td>
                  <td className={cls.numCell}>
                    {l.difference != null && Number(l.difference) !== 0 ? (
                      <span className={Number(l.difference) > 0 ? cls.badge.blue : cls.badge.red}>
                        {Number(l.difference) > 0 ? "+" : ""}
                        {fmtQty(l.difference)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {(save.error || complete.error || cancel.error) && (
        <ErrorBox error={save.error || complete.error || cancel.error} />
      )}

      {editable && (
        <div className={cls.cx(cls.pageHead)} style={{ marginTop: 16, justifyContent: "flex-end", gap: 8 }}>
          <Button
            variant="danger"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            {t("inventory.cancel")}
          </Button>
          <Button variant="ghost" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? t("common.saving") : t("inventory.startDraft")}
          </Button>
          <Button
            variant="success"
            disabled={complete.isPending || countedN === 0}
            onClick={() => setShowComplete(true)}
          >
            {t("inventory.complete")}
          </Button>
        </div>
      )}

      {showComplete && count.data && (
        <CompleteModal
          lines={count.data.lines}
          counts={counts}
          pending={complete.isPending}
          onClose={() => setShowComplete(false)}
          onConfirm={(apply, exclude) => complete.mutate({ apply, exclude })}
        />
      )}
    </div>
  );
}

function CompleteModal({
  lines,
  counts,
  pending,
  onClose,
  onConfirm,
}: {
  lines: StockCountLine[];
  counts: Record<number, string>;
  pending: boolean;
  onClose: () => void;
  onConfirm: (apply: boolean, exclude: number[]) => void;
}) {
  const { t } = useI18n();
  const [apply, setApply] = useState(true);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());

  // Counted lines that have a real difference — candidates for an exception.
  const changed = useMemo(
    () =>
      lines
        .map((l) => {
          const v = counts[l.product_id];
          const counted = v == null || v.trim() === "" ? null : parseFloat(v);
          const d = counted == null ? null : counted - parseFloat(String(l.system_qty));
          return { line: l, counted, d };
        })
        .filter((x) => x.d != null && x.d !== 0),
    [lines, counts],
  );

  function toggle(pid: number) {
    setExcluded((s) => {
      const next = new Set(s);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }

  return (
    <Modal title={t("inventory.completeTitle")} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
          <input type="radio" checked={apply} onChange={() => setApply(true)} />
          <span>
            <strong>{t("inventory.applyMode")}</strong>
            <div className={cls.cx(cls.muted, cls.small)}>{t("inventory.applyModeHint")}</div>
          </span>
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
          <input type="radio" checked={!apply} onChange={() => setApply(false)} />
          <span>
            <strong>{t("inventory.reportMode")}</strong>
            <div className={cls.cx(cls.muted, cls.small)}>{t("inventory.reportModeHint")}</div>
          </span>
        </label>

        {apply && changed.length > 0 && (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{t("inventory.exceptions")}</div>
            <div className={cls.cx(cls.muted, cls.small)} style={{ marginBottom: 8 }}>
              {t("inventory.exceptionsHint")}
            </div>
            <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {changed.map(({ line, d }) => (
                <label
                  key={line.product_id}
                  style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={excluded.has(line.product_id)}
                    onChange={() => toggle(line.product_id)}
                  />
                  <span style={{ flex: 1 }}>
                    {line.product_name}
                    <span className={cls.cx(cls.muted, cls.small, cls.mono)} style={{ marginLeft: 6 }}>
                      {line.sku}
                    </span>
                  </span>
                  <span className={d! > 0 ? cls.badge.blue : cls.badge.red}>
                    {d! > 0 ? "+" : ""}
                    {fmtQty(d!)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            variant="success"
            disabled={pending}
            onClick={() => onConfirm(apply, apply ? [...excluded] : [])}
          >
            {pending ? t("common.saving") : t("inventory.confirmComplete")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
