import { useRef, useState, type FormEvent } from "react";
import * as cls from "../ui/cls";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCategory,
  createCustomer,
  createProduct,
  listCategories,
  listRegions,
  listUsers,
  uploadProductImage,
} from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n";
import { Button, Card, ConfirmDialog, ErrorBox } from "../components/ui";

const EMPTY_PRODUCT = {
  sku: "",
  name: "",
  unit: "pcs",
  cost_price: "0",
  sale_price: "0",
  min_stock: "0",
  category_id: "",
};
const EMPTY_SHOP = {
  name: "",
  phone: "",
  address: "",
  city: "",
  region_id: "",
  credit_limit: "0",
  agent_id: "",
};

export default function CreatePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const role = user?.role;
  const canProduct = role === "admin" || role === "manager" || role === "warehouse";
  const isManager = role === "admin" || role === "manager";

  return (
    <div className={cls.page}>
      <h1>{t("create.title")}</h1>
      <div className={cls.createGrid}>
        {canProduct && <ProductForm />}
        {canProduct && <CategoryForm />}
        <ShopForm showAgentPicker={isManager} />
      </div>
    </div>
  );
}

function ProductForm() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY_PRODUCT });
  const [file, setFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  const categories = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const categoryName = categories.data?.find((c) => String(c.id) === form.category_id)?.name;

  const create = useMutation({
    mutationFn: async () => {
      const product = await createProduct({
        sku: form.sku,
        name: form.name,
        unit: form.unit,
        cost_price: form.cost_price,
        sale_price: form.sale_price,
        min_stock: form.min_stock,
        category_id: form.category_id ? Number(form.category_id) : undefined,
      });
      if (file) await uploadProductImage(product.id, file, "front");
      if (backFile) await uploadProductImage(product.id, backFile, "back");
      return product;
    },
    onSuccess: (product) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setOk(t("create.productCreated", { name: product.name }));
      setForm({ ...EMPTY_PRODUCT });
      setFile(null);
      setBackFile(null);
      if (fileRef.current) fileRef.current.value = "";
      if (backRef.current) backRef.current.value = "";
    },
    onError: (e) => setError(e instanceof Error ? e.message : t("common.somethingWrong")),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setConfirm(true); // verify before saving
  }

  return (
    <Card title={t("create.productSection")}>
      {confirm && (
        <ConfirmDialog
          rows={[
            { label: t("field.sku"), value: form.sku },
            { label: t("field.name"), value: form.name },
            { label: t("field.unit"), value: form.unit },
            { label: t("field.costPrice"), value: form.cost_price },
            { label: t("field.salePrice"), value: form.sale_price },
            { label: t("field.minStock"), value: form.min_stock },
            { label: t("field.category"), value: categoryName ?? t("create.noCategory") },
            { label: t("create.image"), value: file?.name ?? "—" },
            { label: t("create.imageBack"), value: backFile?.name ?? "—" },
          ]}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            create.mutate();
          }}
        />
      )}
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
          <label className={cls.cx(cls.field, cls.fieldFull)}>
            <span>{t("field.category")}</span>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            >
              <option value="">{t("create.noCategory")}</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className={cls.cx(cls.field, cls.fieldFull)}>
            <span>{t("create.image")}</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className={cls.cx(cls.field, cls.fieldFull)}>
            <span>{t("create.imageBack")}</span>
            <input
              ref={backRef}
              type="file"
              accept="image/*"
              onChange={(e) => setBackFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        {error && <ErrorBox error={error} />}
        {ok && <div className={cls.okBox}>{ok}</div>}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? t("common.saving") : t("products.create")}
        </Button>
      </form>
    </Card>
  );
}

function CategoryForm() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const create = useMutation({
    mutationFn: () => createCategory(name.trim()),
    onSuccess: (cat) => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setOk(t("create.categoryCreated", { name: cat.name }));
      setName("");
    },
    onError: (e) => setError(e instanceof Error ? e.message : t("common.somethingWrong")),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (name.trim()) setConfirm(true);
  }

  return (
    <Card title={t("create.categorySection")}>
      {confirm && (
        <ConfirmDialog
          rows={[{ label: t("field.category"), value: name }]}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            create.mutate();
          }}
        />
      )}
      <form onSubmit={submit}>
        <label className={cls.field}>
          <span>{t("field.category")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        {error && <ErrorBox error={error} />}
        {ok && <div className={cls.okBox}>{ok}</div>}
        <Button type="submit" disabled={create.isPending || !name.trim()}>
          {create.isPending ? t("common.saving") : t("create.createCategory")}
        </Button>
      </form>
    </Card>
  );
}

function ShopForm({ showAgentPicker }: { showAgentPicker: boolean }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY_SHOP });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const agents = useQuery({
    queryKey: ["users", "agent"],
    queryFn: () => listUsers("agent"),
    enabled: showAgentPicker,
  });
  const regions = useQuery({ queryKey: ["regions"], queryFn: listRegions });

  const create = useMutation({
    mutationFn: () =>
      createCustomer({
        name: form.name,
        phone: form.phone || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        region_id: form.region_id ? Number(form.region_id) : null,
        credit_limit: form.credit_limit,
        agent_ids: form.agent_id ? [Number(form.agent_id)] : undefined,
      }),
    onSuccess: (shop) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setOk(t("create.shopCreated", { name: shop.name }));
      setForm({ ...EMPTY_SHOP });
    },
    onError: (e) => setError(e instanceof Error ? e.message : t("common.somethingWrong")),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setConfirm(true);
  }

  const agentName = agents.data?.find((a) => String(a.id) === form.agent_id)?.full_name;
  const regionName = regions.data?.find((r) => String(r.id) === form.region_id)?.name;

  return (
    <Card title={t("create.shopSection")}>
      {confirm && (
        <ConfirmDialog
          rows={[
            { label: t("col.name"), value: form.name },
            { label: t("col.phone"), value: form.phone },
            { label: t("customers.city"), value: form.city },
            { label: t("customers.region"), value: regionName ?? t("common.none") },
            { label: t("field.address"), value: form.address },
            { label: t("col.creditLimit"), value: form.credit_limit },
            ...(showAgentPicker
              ? [{ label: t("field.assignedAgent"), value: agentName ?? t("common.none") }]
              : []),
          ]}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            create.mutate();
          }}
        />
      )}
      <form onSubmit={submit}>
        <div className={cls.formGrid}>
          <label className={cls.field}>
            <span>{t("col.name")}</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className={cls.field}>
            <span>{t("col.phone")}</span>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className={cls.field}>
            <span>{t("customers.city")}</span>
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
          <label className={cls.field}>
            <span>{t("customers.region")}</span>
            <select value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })}>
              <option value="">{t("common.none")}</option>
              {regions.data?.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
          <label className={cls.cx(cls.field, cls.fieldFull)}>
            <span>{t("field.address")}</span>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          <label className={cls.field}>
            <span>{t("col.creditLimit")}</span>
            <input type="number" step="0.01" value={form.credit_limit}
              onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} />
          </label>
          {showAgentPicker && (
            <label className={cls.field}>
              <span>{t("field.assignedAgent")}</span>
              <select value={form.agent_id} onChange={(e) => setForm({ ...form, agent_id: e.target.value })}>
                <option value="">{t("common.none")}</option>
                {agents.data?.map((a) => (
                  <option key={a.id} value={a.id}>{a.full_name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {error && <ErrorBox error={error} />}
        {ok && <div className={cls.okBox}>{ok}</div>}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? t("common.saving") : t("customers.create")}
        </Button>
      </form>
    </Card>
  );
}
