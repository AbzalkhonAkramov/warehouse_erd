import { useMemo, useState, type FormEvent } from "react";
import * as cls from "../ui/cls";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  addStock,
  getProduct,
  getProductHistory,
  listCategories,
  listCurrencies,
  updateProduct,
  uploadProductImage,
  uploadUrl,
} from "../api/endpoints";
import type { Product } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n";
import {
  Button,
  Card,
  ConfirmDialog,
  Empty,
  ErrorBox,
  ExcelButton,
  Modal,
  Spinner,
  Stat,
} from "../components/ui";
import { date, money, qty } from "../lib/format";
import { exportExcel } from "../lib/excel";

type Kind = "all" | "added" | "sale";
type Sort = "date_desc" | "date_asc" | "qty_desc" | "qty_asc";

export default function ProductDetailPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const productId = Number(id);
  const { user } = useAuth();
  const role = user?.role;
  const canManage = role === "admin" || role === "manager" || role === "warehouse";

  const product = useQuery({
    queryKey: ["product", productId],
    queryFn: () => getProduct(productId),
    enabled: Number.isFinite(productId),
  });

  return (
    <div className={cls.page}>
      <Link to="/products" className={cls.backLink}>
        ← {t("nav.products")}
      </Link>

      {product.isLoading ? (
        <Spinner />
      ) : product.error ? (
        <ErrorBox error={product.error} />
      ) : product.data ? (
        <ProductDetail product={product.data} canManage={canManage} />
      ) : null}
    </div>
  );
}

function ProductDetail({ product, canManage }: { product: Product; canManage: boolean }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const history = useQuery({
    queryKey: ["product-history", product.id],
    queryFn: () => getProductHistory(product.id),
  });

  // add-quantity
  const [qtyInput, setQtyInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [confirm, setConfirm] = useState(false);

  // filters / sorting
  const [kind, setKind] = useState<Kind>("all");
  const [account, setAccount] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<Sort>("date_desc");

  const add = useMutation({
    mutationFn: () => addStock(product.id, qtyInput, noteInput || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-history", product.id] });
      qc.invalidateQueries({ queryKey: ["product", product.id] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setQtyInput("");
      setNoteInput("");
    },
  });

  const accounts = useMemo(() => {
    const set = new Set<string>();
    history.data?.forEach((h) => h.user_name && set.add(h.user_name));
    return [...set].sort();
  }, [history.data]);

  const view = useMemo(() => {
    let list = history.data ?? [];
    if (kind !== "all") list = list.filter((h) => h.kind === kind);
    if (account) list = list.filter((h) => h.user_name === account);
    if (from) list = list.filter((h) => h.date >= from);
    if (to) list = list.filter((h) => h.date <= `${to}T23:59:59`);
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case "date_asc":
          return a.date.localeCompare(b.date);
        case "qty_desc":
          return parseFloat(b.quantity) - parseFloat(a.quantity);
        case "qty_asc":
          return parseFloat(a.quantity) - parseFloat(b.quantity);
        default:
          return b.date.localeCompare(a.date);
      }
    });
    return sorted;
  }, [history.data, kind, account, from, to, sort]);

  const exportHistory = () =>
    exportExcel(
      `${product.sku}-history`,
      [t("col.event"), t("col.qty"), t("col.who"), t("orders.note"), t("col.created")],
      view.map((h) => [
        h.kind === "added" ? t("history.added") : t("history.sale"),
        `${h.kind === "added" ? "+" : "−"}${qty(h.quantity)}`,
        h.user_name ?? "",
        h.detail ?? "",
        date(h.date),
      ]),
    );

  return (
    <>
      <div className={cls.pageHead}>
        <h1>{product.name}</h1>
        <div className={cls.headActions}>
          {canManage && (
            <Button variant="ghost" onClick={() => setEditing(true)}>
              ✎ {t("common.edit")}
            </Button>
          )}
        </div>
      </div>

      {/* product summary */}
      <Card>
        <div className={cls.detailSummary}>
          <div className={cls.detailPhoto}>
            {product.image_path ? (
              <img src={uploadUrl(product.image_path)} alt={product.name} />
            ) : (
              <div className={cls.productPhotoEmpty}>{t("products.noImage")}</div>
            )}
          </div>
          {product.image_back_path && (
            <div className={cls.cx(cls.detailPhoto, cls.detailPhotoBack)}>
              <img src={uploadUrl(product.image_back_path)} alt="back" />
            </div>
          )}
          <div className={cls.cx(cls.statGrid, cls.detailStats)}>
            <Stat label={t("col.sku")} value={<span className={cls.mono}>{product.sku}</span>} />
            <Stat
              label={t("col.sale")}
              value={`${money(product.sale_price)}${product.currency_symbol ? " " + product.currency_symbol : ""}`}
            />
            {product.cost_price != null && (
              <Stat
                label={t("col.cost")}
                value={`${money(product.cost_price)}${product.currency_symbol ? " " + product.currency_symbol : ""}`}
              />
            )}
            <Stat label={t("col.onHand")} value={`${qty(product.on_hand ?? 0)} ${product.unit}`} />
            <Stat label={t("field.currency")} value={product.currency_code ?? "—"} />
            <Stat label={t("field.saleMode")} value={t(`saleMode.${product.sale_mode}`)} />
            <Stat
              label={t("field.qtyType")}
              value={t(product.integer_qty === false ? "qtyType.fractional" : "qtyType.integer")}
            />
            <Stat
              label={t("products.box")}
              value={
                product.box_qty
                  ? [
                      `${product.box_qty} ${product.unit}`,
                      product.box_weight ? `${money(product.box_weight)} kg` : null,
                      product.box_dimensions,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : t("products.noBox")
              }
            />
          </div>
        </div>
      </Card>

      {canManage && (
        <Card title={t("stock.title")}>
          <div className={cls.inlineAdd}>
            <label className={cls.field}>
              <span>{t("field.quantity")}</span>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
              />
            </label>
            <label className={cls.field}>
              <span>{t("field.note")}</span>
              <input value={noteInput} onChange={(e) => setNoteInput(e.target.value)} />
            </label>
            <Button disabled={!qtyInput || add.isPending} onClick={() => setConfirm(true)}>
              {t("stock.add")}
            </Button>
          </div>
        </Card>
      )}

      <Card title={t("products.history")}>
        {/* filters + sorting */}
        <div className={cls.filterRow}>
          {(["all", "added", "sale"] as Kind[]).map((k) => (
            <button
              key={k}
              className={cls.cx(cls.chip, kind === k && cls.chipActive)}
              onClick={() => setKind(k)}
            >
              {k === "all" ? t("common.all") : k === "added" ? t("history.added") : t("history.sale")}
            </button>
          ))}
          <select value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="">{t("history.allAccounts")}</option>
            {accounts.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <label className={cls.inlineField}>
            {t("field.dateFrom")}
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className={cls.inlineField}>
            {t("field.dateTo")}
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className={cls.inlineField}>
            {t("sort.label")}
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="date_desc">{t("sort.dateDesc")}</option>
              <option value="date_asc">{t("sort.dateAsc")}</option>
              <option value="qty_desc">{t("sort.qtyDesc")}</option>
              <option value="qty_asc">{t("sort.qtyAsc")}</option>
            </select>
          </label>
          <ExcelButton onClick={exportHistory} />
        </div>

        {history.isLoading ? (
          <Spinner />
        ) : history.error ? (
          <ErrorBox error={history.error} />
        ) : view.length > 0 ? (
          <table className={cls.table}>
            <thead>
              <tr>
                <th>{t("col.event")}</th>
                <th className={cls.numCell}>{t("col.qty")}</th>
                <th>{t("col.who")}</th>
                <th>{t("col.created")}</th>
              </tr>
            </thead>
            <tbody>
              {view.map((h, i) => {
                const added = h.kind === "added";
                return (
                  <tr key={i}>
                    <td>
                      <span className={cls.badge[added ? "green" : "blue"]}>
                        {added ? t("history.added") : t("history.sale")}
                      </span>
                      {h.detail && <span className={cls.cx(cls.muted, cls.small)}> {h.detail}</span>}
                    </td>
                    <td className={cls.cx(cls.numCell, cls.strong, !added && cls.warn)}>
                      {added ? "+" : "−"}
                      {qty(h.quantity)}
                    </td>
                    <td>{h.user_name ?? "—"}</td>
                    <td className={cls.muted}>{date(h.date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty>{t("history.empty")}</Empty>
        )}
      </Card>

      {confirm && (
        <ConfirmDialog
          rows={[
            { label: t("col.product"), value: product.name },
            { label: t("field.quantity"), value: qtyInput },
            { label: t("field.note"), value: noteInput },
          ]}
          busy={add.isPending}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            add.mutate();
          }}
        />
      )}

      {editing && <ProductEditModal product={product} onClose={() => setEditing(false)} />}
    </>
  );
}

function ProductEditModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const categories = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const currencies = useQuery({ queryKey: ["currencies", "active"], queryFn: () => listCurrencies(true) });
  const [form, setForm] = useState({
    sku: product.sku,
    name: product.name,
    unit: product.unit,
    cost_price: String(product.cost_price ?? "0"),
    sale_price: String(product.sale_price),
    min_stock: String(product.min_stock),
    category_id: product.category_id ? String(product.category_id) : "",
    currency_id: product.currency_id ? String(product.currency_id) : "",
    box_qty: product.box_qty != null ? String(product.box_qty) : "",
    box_weight: product.box_weight != null ? String(product.box_weight) : "",
    box_dimensions: product.box_dimensions ?? "",
    sale_mode: (product.sale_mode ?? "piece") as "box" | "piece" | "both",
    integer_qty: product.integer_qty === false ? "0" : "1",
  });
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      await updateProduct(product.id, {
        sku: form.sku,
        name: form.name,
        unit: form.unit,
        cost_price: form.cost_price,
        sale_price: form.sale_price,
        min_stock: form.min_stock,
        category_id: form.category_id ? Number(form.category_id) : null,
        currency_id: form.currency_id ? Number(form.currency_id) : null,
        box_qty: form.box_qty ? Number(form.box_qty) : null,
        box_weight: form.box_weight ? form.box_weight : null,
        box_dimensions: form.box_dimensions ? form.box_dimensions : null,
        sale_mode: form.sale_mode,
        integer_qty: form.integer_qty === "1",
      });
      if (frontFile) await uploadProductImage(product.id, frontFile, "front");
      if (backFile) await uploadProductImage(product.id, backFile, "back");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product", product.id] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : t("common.somethingWrong")),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    save.mutate();
  }

  return (
    <Modal title={t("products.editTitle")} onClose={onClose}>
      <form onSubmit={submit}>
        <div className={cls.formGrid}>
          <label className={cls.field}>
            <span>{t("field.sku")}</span>
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          </label>
          <label className={cls.field}>
            <span>{t("field.name")}</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className={cls.field}>
            <span>{t("field.unit")}</span>
            <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </label>
          <label className={cls.field}>
            <span>{t("field.costPrice")}</span>
            <input type="number" step="0.01" value={form.cost_price}
              onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
          </label>
          <label className={cls.field}>
            <span>{t("field.salePrice")}</span>
            <input type="number" step="0.01" value={form.sale_price}
              onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
          </label>
          <label className={cls.field}>
            <span>{t("field.minStock")}</span>
            <input type="number" step="0.001" value={form.min_stock}
              onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
          </label>
          <label className={cls.field}>
            <span>{t("field.currency")}</span>
            <select value={form.currency_id}
              onChange={(e) => setForm({ ...form, currency_id: e.target.value })}>
              <option value="">{t("create.noCurrency")}</option>
              {currencies.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.code} ({c.symbol})</option>
              ))}
            </select>
          </label>
          <label className={cls.field}>
            <span>{t("field.saleMode")}</span>
            <select value={form.sale_mode}
              onChange={(e) => setForm({ ...form, sale_mode: e.target.value as typeof form.sale_mode })}>
              {(["piece", "box", "both"] as const).map((m) => (
                <option key={m} value={m}>{t(`saleMode.${m}`)}</option>
              ))}
            </select>
          </label>
          <label className={cls.field}>
            <span>{t("field.qtyType")}</span>
            <select value={form.integer_qty}
              onChange={(e) => setForm({ ...form, integer_qty: e.target.value })}>
              <option value="1">{t("qtyType.integer")}</option>
              <option value="0">{t("qtyType.fractional")}</option>
            </select>
          </label>
          <label className={cls.field}>
            <span>{t("field.boxQty")}</span>
            <input type="number" step="1" min="0" value={form.box_qty}
              onChange={(e) => setForm({ ...form, box_qty: e.target.value })} />
          </label>
          <label className={cls.field}>
            <span>{t("field.boxWeight")}</span>
            <input type="number" step="0.001" min="0" value={form.box_weight}
              onChange={(e) => setForm({ ...form, box_weight: e.target.value })} />
          </label>
          <label className={cls.cx(cls.field, cls.fieldFull)}>
            <span>{t("field.boxDimensions")}</span>
            <input value={form.box_dimensions} placeholder="40x30x25 cm"
              onChange={(e) => setForm({ ...form, box_dimensions: e.target.value })} />
          </label>
          <label className={cls.cx(cls.field, cls.fieldFull)}>
            <span>{t("field.category")}</span>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">{t("create.noCategory")}</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className={cls.cx(cls.field, cls.fieldFull)}>
            <span>{t("create.image")}</span>
            {product.image_path && (
              <img className={cls.receiptThumb} src={uploadUrl(product.image_path)} alt="front" />
            )}
            <input type="file" accept="image/*" onChange={(e) => setFrontFile(e.target.files?.[0] ?? null)} />
          </label>
          <label className={cls.cx(cls.field, cls.fieldFull)}>
            <span>{t("create.imageBack")}</span>
            {product.image_back_path && (
              <img className={cls.receiptThumb} src={uploadUrl(product.image_back_path)} alt="back" />
            )}
            <input type="file" accept="image/*" onChange={(e) => setBackFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        {error && <ErrorBox error={error} />}
        <div className={cls.modalActions}>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
