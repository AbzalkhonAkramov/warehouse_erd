import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRegion,
  getCustomer,
  listRegions,
  listUsers,
  updateCustomer,
} from "../api/endpoints";
import { Button, Card, ErrorBox, Spinner } from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n";
import { money } from "../lib/format";

export default function CustomerDetailPage() {
  const { id } = useParams();
  const cid = Number(id);
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = user?.role === "admin" || user?.role === "manager";

  const customer = useQuery({ queryKey: ["customer", cid], queryFn: () => getCustomer(cid) });
  const regions = useQuery({ queryKey: ["regions"], queryFn: listRegions });
  const agents = useQuery({ queryKey: ["users", "agent"], queryFn: () => listUsers("agent") });

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    credit_limit: "0",
    region_id: "",
  });
  const [agentIds, setAgentIds] = useState<Set<number>>(new Set());
  const [newRegion, setNewRegion] = useState("");
  const [ok, setOk] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    const c = customer.data;
    if (c && !seeded) {
      setForm({
        name: c.name,
        phone: c.phone ?? "",
        address: c.address ?? "",
        city: c.city ?? "",
        credit_limit: String(c.credit_limit ?? "0"),
        region_id: c.region_id ? String(c.region_id) : "",
      });
      setAgentIds(new Set(c.agent_ids ?? []));
      setSeeded(true);
    }
  }, [customer.data, seeded]);

  const addRegion = useMutation({
    mutationFn: () => createRegion(newRegion.trim()),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["regions"] });
      setForm((f) => ({ ...f, region_id: String(r.id) }));
      setNewRegion("");
    },
  });

  const save = useMutation({
    mutationFn: () =>
      updateCustomer(cid, {
        name: form.name,
        phone: form.phone || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        credit_limit: form.credit_limit,
        region_id: form.region_id ? Number(form.region_id) : null,
        agent_ids: [...agentIds],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", cid] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    },
  });

  function toggleAgent(aid: number) {
    setAgentIds((prev) => {
      const next = new Set(prev);
      next.has(aid) ? next.delete(aid) : next.add(aid);
      return next;
    });
  }

  if (customer.isLoading) return <Spinner />;
  if (customer.error) return <div className="page"><ErrorBox error={customer.error} /></div>;
  const c = customer.data!;

  return (
    <div className="page">
      <div className="page-head">
        <h1>{c.name}</h1>
        <Link to="/customers" className="btn btn-ghost">
          ← {t("customers.title")}
        </Link>
      </div>
      <p className="muted" style={{ marginTop: -8 }}>
        {t("col.debt")}: <strong>{money(c.debt)}</strong>
      </p>

      <Card title={t("customers.details")}>
        <div className="form-grid">
          <label className="field">
            <span>{t("col.name")}</span>
            <input value={form.name} disabled={!canEdit}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="field">
            <span>{t("col.phone")}</span>
            <input value={form.phone} disabled={!canEdit}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className="field">
            <span>{t("customers.city")}</span>
            <input value={form.city} disabled={!canEdit}
              onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
          <label className="field">
            <span>{t("col.creditLimit")}</span>
            <input type="number" step="0.01" value={form.credit_limit} disabled={!canEdit}
              onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} />
          </label>
          <label className="field full">
            <span>{t("field.address")}</span>
            <input value={form.address} disabled={!canEdit}
              onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          <label className="field">
            <span>{t("customers.region")}</span>
            <select value={form.region_id} disabled={!canEdit}
              onChange={(e) => setForm({ ...form, region_id: e.target.value })}>
              <option value="">{t("common.none")}</option>
              {regions.data?.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
          {canEdit && (
            <label className="field">
              <span>{t("customers.newRegion")}</span>
              <div className="row-gap">
                <input value={newRegion} onChange={(e) => setNewRegion(e.target.value)} />
                <Button variant="ghost" disabled={!newRegion.trim() || addRegion.isPending}
                  onClick={() => addRegion.mutate()}>
                  {t("common.add")}
                </Button>
              </div>
            </label>
          )}
        </div>

        <h3 className="section-sub">{t("customers.agents")}</h3>
        <div className="check-list">
          {agents.data?.map((a) => (
            <label key={a.id} className="checkbox-field">
              <input type="checkbox" checked={agentIds.has(a.id)} disabled={!canEdit}
                onChange={() => toggleAgent(a.id)} />
              {a.full_name}
            </label>
          ))}
        </div>

        {addRegion.error && <ErrorBox error={addRegion.error} />}
        {save.error && <ErrorBox error={save.error} />}
        {ok && <div className="ok-box">{t("common.saved")}</div>}
        {canEdit && (
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? t("common.saving") : t("common.save")}
          </Button>
        )}
      </Card>
    </div>
  );
}
