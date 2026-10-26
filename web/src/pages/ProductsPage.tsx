import { useEffect, useMemo, useRef, useState } from "react";
import * as cls from "../ui/cls";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  listCategories,
  listProducts,
  listStock,
  uploadUrl,
} from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n";
import { Button, Card, ErrorBox, ExcelButton, Spinner } from "../components/ui";
import { money, moneyTrim, qty } from "../lib/format";
import { exportExcel } from "../lib/excel";

type Sort = "name" | "price_desc" | "price_asc" | "stock_desc";
type Layout = "card" | "list";

function initialLayout(): Layout {
  try {
    const v = localStorage.getItem("productsLayout");
    if (v === "card" || v === "list") return v;
  } catch {
    /* storage may be unavailable */
  }
  return "card";
}

export default function ProductsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role;
  const canManage = role === "admin" || role === "manager" || role === "warehouse";

  const [search, setSearch] = useState("");
  const [categoryIds, setCategoryIds] = useState<Set<number>>(new Set());
  const [sort, setSort] = useState<Sort>("name");
  const [layout, setLayout] = useState<Layout>(initialLayout);

  function changeLayout(v: Layout) {
    setLayout(v);
    try {
      localStorage.setItem("productsLayout", v);
    } catch {
      /* ignore */
    }
  }
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const stock = useQuery({ queryKey: ["stock"], queryFn: () => listStock(false) });
  const categories = useQuery({ queryKey: ["categories"], queryFn: listCategories });

  const onHand = useMemo(() => {
    const map = new Map<number, { quantity: string; low: boolean }>();
    stock.data?.forEach((s) => map.set(s.product_id, { quantity: s.quantity, low: s.low }));
    return map;
  }, [stock.data]);

  const view = useMemo(() => {
    let list = products.data ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
      );
    }
    if (categoryIds.size)
      list = list.filter((p) => p.category_id != null && categoryIds.has(p.category_id));
    const stockOf = (id: number) => parseFloat(onHand.get(id)?.quantity ?? "0");
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case "price_desc":
          return parseFloat(b.sale_price) - parseFloat(a.sale_price);
        case "price_asc":
          return parseFloat(a.sale_price) - parseFloat(b.sale_price);
        case "stock_desc":
          return stockOf(b.id) - stockOf(a.id);
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return sorted;
  }, [products.data, search, categoryIds, sort, onHand]);

  const exportProducts = () =>
    exportExcel(
      "products",
      [t("col.sku"), t("col.name"), t("col.unit"), t("col.cost"), t("col.sale"), t("col.onHand")],
      view.map((p) => [
        p.sku,
        p.name,
        p.unit,
        p.cost_price ?? "",
        money(p.sale_price),
        onHand.get(p.id)?.quantity ?? "0",
      ]),
    );

  return (
    <div className={cls.page}>
      <div className={cls.pageHead}>
        <h1>{t("products.title")}</h1>
        <div className={cls.headActions}>
          <ExcelButton onClick={exportProducts} />
          {canManage && (
            <Link to="/create">
              <Button>{t("products.new")}</Button>
            </Link>
          )}
        </div>
      </div>

      <div className={cls.filterRow}>
        <input
          className={cls.searchInput}
          placeholder={t("products.searchPh")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <CategoryFilter
          categories={categories.data ?? []}
          selected={categoryIds}
          onChange={setCategoryIds}
        />
        <label className={cls.inlineField}>
          {t("sort.label")}
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="name">{t("sort.nameAsc")}</option>
            <option value="price_desc">{t("sort.priceDesc")}</option>
            <option value="price_asc">{t("sort.priceAsc")}</option>
            <option value="stock_desc">{t("sort.stockDesc")}</option>
          </select>
        </label>
        <label className={cls.inlineField}>
          {t("products.view")}
          <select value={layout} onChange={(e) => changeLayout(e.target.value as Layout)}>
            <option value="card">{t("products.viewCard")}</option>
            <option value="list">{t("products.viewList")}</option>
          </select>
        </label>
      </div>

      {products.isLoading ? (
        <Spinner />
      ) : products.error ? (
        <ErrorBox error={products.error} />
      ) : layout === "list" ? (
        <Card>
          <table className={cls.table}>
            <thead>
              <tr>
                <th />
                <th>{t("col.sku")}</th>
                <th>{t("col.name")}</th>
                <th className={cls.numCell}>{t("col.sale")}</th>
                <th className={cls.numCell}>{t("col.onHand")}</th>
              </tr>
            </thead>
            <tbody>
              {view.map((p) => {
                const s = onHand.get(p.id);
                return (
                  <tr
                    key={p.id}
                    className={cls.clickable}
                    onClick={() => navigate(`/products/${p.id}`)}
                  >
                    <td>
                      {p.image_path ? (
                        <img
                          className={cls.listThumb}
                          src={uploadUrl(p.image_path)}
                          alt={p.name}
                        />
                      ) : (
                        <span className={cls.listThumbEmpty}>📦</span>
                      )}
                    </td>
                    <td className={cls.mono}>{p.sku}</td>
                    <td>{p.name}</td>
                    <td className={cls.cx(cls.numCell, cls.strong)}>
                      {moneyTrim(p.sale_price)}{p.currency_symbol ? ` ${p.currency_symbol}` : ""}
                    </td>
                    <td className={cls.cx(cls.numCell, s?.low ? cls.warn : undefined)}>
                      {s ? qty(s.quantity) : "0"} {p.unit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className={cls.productGrid}>
          {view.map((p) => {
            const s = onHand.get(p.id);
            return (
              <Card key={p.id}>
                <Link to={`/products/${p.id}`} className={cls.cx(cls.productClickable, cls.plainLink)}>
                  <div className={cls.productPhoto}>
                    {p.image_path ? (
                      <img src={uploadUrl(p.image_path)} alt={p.name} />
                    ) : (
                      <div className={cls.productPhotoEmpty}>{t("products.noImage")}</div>
                    )}
                  </div>
                  <div className={cls.cx(cls.productSku, cls.mono)}>{p.sku}</div>
                  <div className={cls.productName}>{p.name}</div>
                  <div className={cls.productRow}>
                    <span className={cls.productPrice}>
                      {moneyTrim(p.sale_price)}{p.currency_symbol ? ` ${p.currency_symbol}` : ""}
                    </span>
                    <span className={s?.low ? cls.productStockWarn : cls.productStock}>
                      {t("col.onHand")}: {s ? qty(s.quantity) : "0"} {p.unit}
                    </span>
                  </div>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Searchable multi-select category filter (text field + checkbox dropdown). */
function CategoryFilter({
  categories,
  selected,
  onChange,
}: {
  categories: { id: number; name: string }[];
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const summary =
    selected.size === 0
      ? t("filter.allCategories")
      : t("filter.nCategories", { n: String(selected.size) });

  function toggle(id: number) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange(next);
  }

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 240 }}>
      <input
        className={cls.searchInput}
        style={{ width: "100%" }}
        value={q}
        placeholder={summary}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 4,
            width: "100%",
            maxHeight: 300,
            overflowY: "auto",
            background: "var(--card-bg, #fff)",
            border: "1px solid var(--line, #e7ecf3)",
            borderRadius: 10,
            boxShadow: "0 10px 30px rgba(15,23,42,0.14)",
            padding: 4,
            zIndex: 30,
          }}
        >
          {selected.size > 0 && (
            <button
              type="button"
              className={cls.cx("w-full text-left px-3 py-2 rounded-md text-sm cursor-pointer hover:bg-slate-100 text-brand")}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(new Set());
              }}
            >
              {t("filter.clearCategories")}
            </button>
          )}
          {filtered.map((c) => (
            <label
              key={c.id}
              className={cls.cx("flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer hover:bg-slate-100")}
              onMouseDown={(e) => e.preventDefault()}
            >
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
              />
              {c.name}
            </label>
          ))}
          {filtered.length === 0 && (
            <div className={cls.cx(cls.muted, cls.small)} style={{ padding: "8px 12px" }}>
              {t("common.nothingFound")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
