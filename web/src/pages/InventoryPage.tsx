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
import { Button, Card, Empty, ErrorBox, Spinner } from "../components/ui";
import { useI18n } from "../i18n";
import { qty as fmtQty, date } from "../lib/format";

export default function InventoryPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);

  const counts = useQuery({ queryKey: ["stock-counts"], queryFn: listStockCounts });

  const start = useMutation({
    mutationFn: () => startStockCount(),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["stock-counts"] });
      setActiveId(c.id);
    },
  });

  if (activeId !== null) {
    return <CountEditor id={activeId} onBack={() => setActiveId(null)} />;
  }

  const STATUS_BADGE: Record<string, string> = {
    open: cls.badge.amber,
    completed: cls.badge.green,
    cancelled: cls.badge.gray,
  };

  return (
    <div className={cls.page}>
      <div className={cls.pageHead}>
        <div>
          <h1>{t("inventory.title")}</h1>
          <p className={cls.muted} style={{ margin: 0 }}>{t("inventory.subtitle")}</p>
        </div>
        <Button onClick={() => start.mutate()} disabled={start.isPending}>
          {start.isPending ? t("common.saving") : t("inventory.start")}
        </Button>
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
                      {c.status === "open" ? t("inventory.continue") : t("inventory.view")}
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
    mutationFn: () => completeStockCount(id, payload()),
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

  const open = count.data?.status === "open";
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
                        disabled={!open}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty>{t("inventory.empty")}</Empty>
        )}
      </Card>

      {(save.error || complete.error || cancel.error) && (
        <ErrorBox error={save.error || complete.error || cancel.error} />
      )}

      {open && (
        <div className={cls.cx(cls.pageHead)} style={{ marginTop: 16, justifyContent: "flex-end", gap: 8 }}>
          <Button
            variant="danger"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            {t("inventory.cancel")}
          </Button>
          <Button variant="ghost" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? t("common.saving") : t("common.save")}
          </Button>
          <Button
            variant="success"
            disabled={complete.isPending || countedN === 0}
            onClick={() => complete.mutate()}
          >
            {complete.isPending ? t("common.saving") : t("inventory.complete")}
          </Button>
        </div>
      )}
    </div>
  );
}
