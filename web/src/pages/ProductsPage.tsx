import { useMemo, useRef, useState } from "react";
import * as cls from "../ui/cls";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  downloadStockTemplate,
  importStock,
  listCategories,
  listProducts,
  listStock,
  uploadUrl,
} from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n";
import { Button, Card, ErrorBox, ExcelButton, Spinner } from "../components/ui";
import { money, qty } from "../lib/format";
import { exportExcel } from "../lib/excel";

type Sort = "name" | "price_desc" | "price_asc" | "stock_desc";

export default function ProductsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const role = user?.role;
  const canManage = role === "admin" || role === "manager" || role === "warehouse";

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [sort, setSort] = useState<Sort>("name");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const stock = useQuery({ queryKey: ["stock"], queryFn: () => listStock(false) });
  const categories = useQuery({ queryKey: ["categories"], queryFn: listCategories });

  const doImport = useMutation({
    mutationFn: importStock,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setImportErr(null);
      setImportMsg(
        t("stockImport.done", {
          updated: r.updated,
          total: r.added_total,
          skipped: r.skipped,
        }) + (r.errors.length ? ` · ${r.errors.length} ${t("stockImport.errs")}` : ""),
      );
    },
    onError: (e) =>
      setImportErr(e instanceof Error ? e.message : t("common.somethingWrong")),
  });

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
    if (category) list = list.filter((p) => String(p.category_id ?? "") === category);
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
  }, [products.data, search, category, sort, onHand]);

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
            <>
              <Button variant="ghost" onClick={() => downloadStockTemplate()}>
                ⬇ {t("stockImport.template")}
              </Button>
              <Button
                variant="ghost"
                disabled={doImport.isPending}
                onClick={() => fileRef.current?.click()}
              >
                ⬆ {doImport.isPending ? t("common.saving") : t("stockImport.import")}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) doImport.mutate(f);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
              <Link to="/create">
                <Button>{t("products.new")}</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {importMsg && <div className={cls.okBox}>{importMsg}</div>}
      {importErr && <div className={cls.errorBox}>{importErr}</div>}

      <div className={cls.filterRow}>
        <input
          className={cls.searchInput}
          placeholder={t("products.searchPh")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t("filter.allCategories")}</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className={cls.inlineField}>
          {t("sort.label")}
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="name">{t("sort.nameAsc")}</option>
            <option value="price_desc">{t("sort.priceDesc")}</option>
            <option value="price_asc">{t("sort.priceAsc")}</option>
            <option value="stock_desc">{t("sort.stockDesc")}</option>
          </select>
        </label>
      </div>

      {products.isLoading ? (
        <Spinner />
      ) : products.error ? (
        <ErrorBox error={products.error} />
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
                      {money(p.sale_price)}{p.currency_symbol ? ` ${p.currency_symbol}` : ""}
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
