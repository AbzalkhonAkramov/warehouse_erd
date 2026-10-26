import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import * as cls from "../ui/cls";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPurchaseOrder,
  downloadIncomingTemplate,
  importIncoming,
  listCategories,
  listProducts,
  listPurchaseOrders,
  listSuppliers,
  receivePurchaseOrder,
} from "../api/endpoints";
import type { Product, PurchaseOrder, PurchaseOrderStatus } from "../api/types";
import { useI18n } from "../i18n";
import { Button, Card, Empty, ErrorBox, Spinner } from "../components/ui";
import { date, money, qty } from "../lib/format";

/** Searchable product picker: type part of a name or SKU, pick from the dropdown.
 * Much easier than a long <select> when there are many SKUs. */
function ProductPicker({
  products,
  value,
  onSelect,
}: {
  products: Product[];
  value: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  const selected = products.find((p) => String(p.id) === value) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const label = selected ? `${selected.name} · ${selected.sku}` : "";
  const q = query.trim().toLowerCase();
  const matches = open
    ? products
        .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
        .slice(0, 50)
    : [];

  return (
    <div ref={boxRef} className={cls.grow} style={{ position: "relative" }}>
      <input
        style={{ width: "100%" }}
        value={open ? query : label}
        placeholder={t("createOrder.selectProduct")}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />
      {open && matches.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            right: 0,
            zIndex: 30,
            background: "#fff",
            border: "1px solid var(--line, #e5e7eb)",
            borderRadius: 8,
            maxHeight: 260,
            overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          }}
        >
          {matches.map((p) => (
            <div
              key={p.id}
              onMouseDown={() => {
                onSelect(String(p.id));
                setOpen(false);
              }}
              style={{ padding: "8px 11px", cursor: "pointer", fontSize: 14 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              {p.name} <span className={cls.cx(cls.muted, cls.mono, cls.small)}>· {p.sku}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface LineRow {
  product_id: string;
  quantity: string;
  unit_cost: string;
}
const EMPTY_LINE: LineRow = { product_id: "", quantity: "1", unit_cost: "0" };

const STATUS_COLOR: Record<PurchaseOrderStatus, keyof typeof cls.badge> = {
  draft: "gray",
  ordered: "amber",
  received: "green",
  cancelled: "red",
};

export default function IncomingPage() {
  const { t } = useI18n();
  const qc = useQueryClient();

  const orders = useQuery({ queryKey: ["purchase-orders"], queryFn: () => listPurchaseOrders() });
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: listSuppliers });
  const categories = useQuery({ queryKey: ["categories"], queryFn: listCategories });

  const [tplCategory, setTplCategory] = useState<string>("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const [supplierId, setSupplierId] = useState<string>("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<LineRow[]>([{ ...EMPTY_LINE }]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const productName = useMemo(() => {
    const m = new Map<number, string>();
    products.data?.forEach((p) => m.set(p.id, p.name));
    return (id: number) => m.get(id) ?? `#${id}`;
  }, [products.data]);

  const total = useMemo(
    () =>
      lines.reduce(
        (acc, l) => acc + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_cost) || 0),
        0,
      ),
    [lines],
  );

  const setLine = (i: number, patch: Partial<LineRow>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { ...EMPTY_LINE }]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, j) => j !== i));

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["purchase-orders"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["stock"] });
  };

  const create = useMutation({
    mutationFn: (draft: boolean) =>
      createPurchaseOrder({
        supplier_id: supplierId ? Number(supplierId) : null,
        note: note || null,
        draft,
        lines: lines
          .filter((l) => l.product_id && parseFloat(l.quantity) > 0)
          .map((l) => ({
            product_id: Number(l.product_id),
            quantity: l.quantity,
            unit_cost: l.unit_cost || "0",
          })),
      }),
    onSuccess: () => {
      setSupplierId("");
      setNote("");
      setLines([{ ...EMPTY_LINE }]);
      setError(null);
      refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : t("common.somethingWrong")),
  });

  const receive = useMutation({
    mutationFn: (id: number) => receivePurchaseOrder(id),
    onSuccess: refresh,
    onError: (e) => setError(e instanceof Error ? e.message : t("common.somethingWrong")),
  });

  const doImport = useMutation({
    mutationFn: importIncoming,
    onSuccess: (r) => {
      setError(null);
      setImportMsg(
        t("import.done", { created: r.created, skipped: r.skipped }) +
          (r.errors.length ? ` · ${r.errors.length} ${t("import.errs")}` : ""),
      );
      refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : t("common.somethingWrong")),
  });

  const canCreate = lines.some((l) => l.product_id && parseFloat(l.quantity) > 0);

  return (
    <div className={cls.page}>
      <div className={cls.pageHead}>
        <h1>{t("incoming.title")}</h1>
      </div>

      {/* Excel import — template can be filtered by category */}
      <Card title={t("incoming.excelTitle")}>
        <div className={cls.filterRow}>
          <label className={cls.inlineField}>
            {t("field.category")}
            <select value={tplCategory} onChange={(e) => setTplCategory(e.target.value)}>
              <option value="">{t("filter.allCategories")}</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <Button
            variant="ghost"
            onClick={() => downloadIncomingTemplate(tplCategory ? Number(tplCategory) : undefined)}
          >
            ⬇ {t("import.template")}
          </Button>
          <Button
            variant="ghost"
            disabled={doImport.isPending}
            onClick={() => importRef.current?.click()}
          >
            ⬆ {doImport.isPending ? t("common.saving") : t("import.excel")}
          </Button>
          <input
            ref={importRef}
            type="file"
            accept=".xlsx"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport.mutate(f);
              if (importRef.current) importRef.current.value = "";
            }}
          />
        </div>
        <p className={cls.cx(cls.muted, cls.small)}>{t("incoming.excelHint")}</p>
        {importMsg && <div className={cls.okBox}>{importMsg}</div>}
      </Card>

      {/* Create receipt */}
      <Card title={t("incoming.newTitle")}>
        <div className={cls.filterRow}>
          <label className={cls.inlineField}>
            {t("incoming.supplier")}
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">{t("incoming.noSupplier")}</option>
              {suppliers.data?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className={cls.cx(cls.inlineField, cls.grow)}>
            {t("orders.note")}
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>

        {/* Column headers for the line inputs below. */}
        <div className={cls.cx(cls.orderLineRow, cls.muted, cls.small)} style={{ marginBottom: 4 }}>
          <span className={cls.grow}>{t("incoming.colProduct")}</span>
          <span className={cls.cx(cls.qtyInput, cls.numCell)}>{t("col.qty")}</span>
          <span className={cls.cx(cls.qtyInput, cls.numCell)}>{t("incoming.unitCost")}</span>
          <span className={cls.cx(cls.qtyInput, cls.numCell)}>{t("col.lineTotal")}</span>
          <span style={{ width: 36 }} />
        </div>

        {lines.map((l, i) => {
          const lineSum = (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_cost) || 0);
          return (
          <div className={cls.orderLineRow} key={i}>
            <ProductPicker
              products={products.data ?? []}
              value={l.product_id}
              onSelect={(id) => setLine(i, { product_id: id })}
            />
            <input
              className={cls.qtyInput}
              type="number"
              min="0"
              step="0.001"
              placeholder={t("col.qty")}
              value={l.quantity}
              onChange={(e) => setLine(i, { quantity: e.target.value })}
            />
            <input
              className={cls.qtyInput}
              type="number"
              min="0"
              step="0.01"
              placeholder={t("incoming.unitCost")}
              value={l.unit_cost}
              onChange={(e) => setLine(i, { unit_cost: e.target.value })}
            />
            <span className={cls.cx(cls.qtyInput, cls.numCell, cls.strong)}>{money(lineSum)}</span>
            <Button type="button" variant="ghost" onClick={() => removeLine(i)}>
              ✕
            </Button>
          </div>
          );
        })}
        <Button type="button" variant="ghost" onClick={addLine}>
          + {t("createOrder.addLine")}
        </Button>

        {error && <ErrorBox error={error} />}
        <div className={cls.orderTotal}>
          {t("incoming.totalCost")}: <strong>{money(total)}</strong>
        </div>
        <div className={cls.rowGap}>
          <Button disabled={!canCreate || create.isPending} onClick={() => create.mutate(false)}>
            {create.isPending ? t("common.saving") : t("incoming.create")}
          </Button>
          <Button
            variant="ghost"
            disabled={!canCreate || create.isPending}
            onClick={() => create.mutate(true)}
          >
            {t("incoming.saveDraft")}
          </Button>
        </div>
      </Card>

      {/* Receipts list */}
      <Card title={t("incoming.listTitle")}>
        {orders.isLoading ? (
          <Spinner />
        ) : orders.error ? (
          <ErrorBox error={orders.error} />
        ) : orders.data && orders.data.length > 0 ? (
          <table className={cls.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>{t("col.created")}</th>
                <th>{t("incoming.supplier")}</th>
                <th className={cls.numCell}>{t("incoming.totalCost")}</th>
                <th>{t("common.status")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.data.map((o: PurchaseOrder) => (
                <Fragment key={o.id}>
                  <tr
                    className={cls.clickable}
                    onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                  >
                    <td className={cls.mono}>{o.ref ?? o.id}</td>
                    <td>{date(o.created_at)}</td>
                    <td>{o.supplier_name ?? "—"}</td>
                    <td className={cls.cx(cls.numCell, cls.strong)}>{money(o.total)}</td>
                    <td>
                      <span className={cls.badge[STATUS_COLOR[o.status]]}>
                        {t(`poStatus.${o.status}`)}
                      </span>
                    </td>
                    <td className={cls.actionsCol}>
                      {(o.status === "ordered" || o.status === "draft") && (
                        <Button
                          variant="ghost"
                          disabled={receive.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            receive.mutate(o.id);
                          }}
                        >
                          ✅ {t("incoming.receive")}
                        </Button>
                      )}
                    </td>
                  </tr>
                  {expanded === o.id && (
                    <tr className={cls.detailRowTd}>
                      <td colSpan={6}>
                        <table className={cls.tableSub}>
                          <thead>
                            <tr>
                              <th>{t("col.product")}</th>
                              <th className={cls.numCell}>{t("col.qty")}</th>
                              <th className={cls.numCell}>{t("incoming.unitCost")}</th>
                              <th className={cls.numCell}>{t("incoming.received")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {o.lines.map((l) => (
                              <tr key={l.id}>
                                <td>{l.product_name ?? productName(l.product_id)}</td>
                                <td className={cls.numCell}>{qty(l.quantity)}</td>
                                <td className={cls.numCell}>{money(l.unit_cost)}</td>
                                <td className={cls.numCell}>{qty(l.received_quantity)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {o.note && <p className={cls.note}>{t("orders.note")}: {o.note}</p>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>{t("incoming.empty")}</Empty>
        )}
      </Card>
    </div>
  );
}
