import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createOrder,
  listCategories,
  listCustomers,
  listProducts,
  listUsers,
  type OrderLineInput,
} from "../api/endpoints";
import { Button, Card, ErrorBox } from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n";
import { money } from "../lib/format";

interface LineRow {
  product_id: string;
  quantity: string;
}

const EMPTY_LINE: LineRow = { product_id: "", quantity: "1" };

export default function CreateOrderPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  // Only managers/admins can place an order on behalf of an agent; everyone else
  // (agents included) creates orders owned by themselves.
  const canPickAgent = user?.role === "admin" || user?.role === "manager";

  const [agentId, setAgentId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<LineRow[]>([{ ...EMPTY_LINE }]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const agents = useQuery({
    queryKey: ["users", "agent"],
    queryFn: () => listUsers("agent"),
    enabled: canPickAgent,
  });
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const categories = useQuery({ queryKey: ["categories"], queryFn: listCategories });

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products.data ?? []).filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) &&
        (!categoryFilter || String(p.category_id) === categoryFilter),
    );
  }, [products.data, search, categoryFilter]);

  const priceOf = useMemo(() => {
    const map = new Map<number, number>();
    products.data?.forEach((p) => map.set(p.id, parseFloat(String(p.sale_price))));
    return (id: string) => map.get(Number(id)) ?? 0;
  }, [products.data]);

  const total = useMemo(() => {
    const sub = lines.reduce(
      (acc, l) => acc + priceOf(l.product_id) * (parseFloat(l.quantity) || 0),
      0,
    );
    return Math.max(sub - (parseFloat(discount) || 0), 0);
  }, [lines, discount, priceOf]);

  function setLine(i: number, patch: Partial<LineRow>) {
    setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addLine() {
    setLines((rows) => [...rows, { ...EMPTY_LINE }]);
  }
  function removeLine(i: number) {
    setLines((rows) => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows));
  }

  const create = useMutation({
    mutationFn: () => {
      const payload: OrderLineInput[] = lines
        .filter((l) => l.product_id && parseFloat(l.quantity) > 0)
        .map((l) => ({ product_id: Number(l.product_id), quantity: l.quantity }));
      return createOrder({
        customer_id: Number(customerId),
        agent_id: agentId ? Number(agentId) : undefined,
        discount,
        note: note || undefined,
        lines: payload,
      });
    },
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      setOk(t("createOrder.created", { id: order.id }));
      setTimeout(() => navigate("/orders"), 800);
    },
    onError: (e) => setError(e instanceof Error ? e.message : t("common.somethingWrong")),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const valid = lines.filter((l) => l.product_id && parseFloat(l.quantity) > 0);
    if (!customerId || valid.length === 0) {
      setError(t("createOrder.needLine"));
      return;
    }
    create.mutate();
  }

  return (
    <div className="page">
      <h1>{t("createOrder.title")}</h1>
      <Card>
        <form onSubmit={submit}>
          <div className="form-grid">
            {canPickAgent && (
              <label className="field">
                <span>{t("createOrder.agent")}</span>
                <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                  <option value="">{t("createOrder.selectAgent")}</option>
                  {agents.data?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              <span>{t("createOrder.customer")}</span>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                <option value="">{t("createOrder.selectCustomer")}</option>
                {customers.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <h3 className="section-sub">{t("createOrder.lines")}</h3>
          <div className="order-line-row">
            <input
              className="grow"
              placeholder={t("createOrder.searchProduct")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">{t("createOrder.allCategories")}</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {lines.map((l, i) => (
            <div className="order-line-row" key={i}>
              <select
                className="grow"
                value={l.product_id}
                onChange={(e) => setLine(i, { product_id: e.target.value })}
              >
                <option value="">{t("createOrder.selectProduct")}</option>
                {visibleProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {money(p.sale_price)}
                  </option>
                ))}
              </select>
              <input
                className="qty-input"
                type="number"
                min="0"
                step="0.001"
                value={l.quantity}
                onChange={(e) => setLine(i, { quantity: e.target.value })}
              />
              <Button type="button" variant="ghost" onClick={() => removeLine(i)}>
                {t("createOrder.remove")}
              </Button>
            </div>
          ))}
          <Button type="button" variant="ghost" onClick={addLine}>
            {t("createOrder.addLine")}
          </Button>

          <div className="form-grid" style={{ marginTop: "1rem" }}>
            {canPickAgent && (
              <label className="field">
                <span>{t("createOrder.discount")}</span>
                <input
                  type="number"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </label>
            )}
            <label className="field full">
              <span>{t("orders.note")}</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>

          <p className="order-total">
            {t("createOrder.total")}: <strong>{money(total)}</strong>
          </p>

          {error && <ErrorBox error={error} />}
          {ok && <div className="ok-box">{ok}</div>}
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? t("common.saving") : t("createOrder.submit")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
