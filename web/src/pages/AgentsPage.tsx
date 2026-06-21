import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAgentCategories,
  listCategories,
  listCustomers,
  listUsers,
  setAgentCategories,
  setAgentShops,
} from "../api/endpoints";
import type { User } from "../api/types";
import { Button, Card, Empty, ErrorBox, Modal, Spinner } from "../components/ui";
import { useI18n } from "../i18n";

export default function AgentsPage() {
  const { t } = useI18n();
  const [editing, setEditing] = useState<User | null>(null);
  const [editingShops, setEditingShops] = useState<User | null>(null);
  const agents = useQuery({ queryKey: ["users", "agent"], queryFn: () => listUsers("agent") });

  return (
    <div className="page">
      <h1>{t("agents.title")}</h1>
      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
        {t("agents.subtitle")}
      </p>

      <Card>
        {agents.isLoading ? (
          <Spinner />
        ) : agents.error ? (
          <ErrorBox error={agents.error} />
        ) : agents.data && agents.data.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>{t("col.name")}</th>
                <th>{t("col.email")}</th>
                <th>{t("common.status")}</th>
                <th className="actions-col" />
              </tr>
            </thead>
            <tbody>
              {agents.data.map((a) => (
                <tr key={a.id}>
                  <td>{a.full_name}</td>
                  <td className="muted">{a.email}</td>
                  <td>
                    {a.is_active ? (
                      <span className="badge badge-green">{t("common.active")}</span>
                    ) : (
                      <span className="badge badge-gray">{t("common.inactive")}</span>
                    )}
                  </td>
                  <td className="actions-col">
                    <Button variant="ghost" onClick={() => setEditing(a)}>
                      {t("agents.manage")}
                    </Button>
                    <Button variant="ghost" onClick={() => setEditingShops(a)}>
                      {t("agents.manageShops")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>{t("agents.noAgents")}</Empty>
        )}
      </Card>

      {editing && (
        <CategoryModal agent={editing} onClose={() => setEditing(null)} />
      )}
      {editingShops && (
        <ShopsModal agent={editingShops} onClose={() => setEditingShops(null)} />
      )}
    </div>
  );
}

function ShopsModal({ agent, onClose }: { agent: User; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  // Managers see all shops; pre-check the ones already on this agent.
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (customers.data && !seeded) {
      setSelected(
        new Set(customers.data.filter((c) => (c.agent_ids ?? []).includes(agent.id)).map((c) => c.id)),
      );
      setSeeded(true);
    }
  }, [customers.data, seeded, agent.id]);

  const save = useMutation({
    mutationFn: () => setAgentShops(agent.id, [...selected]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      onClose();
    },
  });

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <Modal title={t("agents.shopsTitle", { name: agent.full_name })} onClose={onClose}>
      {customers.isLoading ? (
        <Spinner />
      ) : customers.error ? (
        <ErrorBox error={customers.error} />
      ) : customers.data && customers.data.length > 0 ? (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>
            {t("agents.shopsHint", { n: selected.size })}
          </p>
          <div className="check-list">
            {customers.data.map((c) => (
              <label key={c.id} className="checkbox-field">
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                {c.name}
                {(c.agent_ids ?? []).some((a) => a !== agent.id) && (
                  <span className="muted small"> · {t("agents.otherAgent")}</span>
                )}
              </label>
            ))}
          </div>
          {save.error && <ErrorBox error={save.error} />}
          <div className="modal-actions">
            <Button variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </>
      ) : (
        <Empty>{t("agents.noShops")}</Empty>
      )}
    </Modal>
  );
}

function CategoryModal({ agent, onClose }: { agent: User; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const categories = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const assigned = useQuery({
    queryKey: ["agent-categories", agent.id],
    queryFn: () => getAgentCategories(agent.id),
  });

  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (assigned.data) setSelected(new Set(assigned.data.map((c) => c.id)));
  }, [assigned.data]);

  const save = useMutation({
    mutationFn: () => setAgentCategories(agent.id, [...selected]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-categories", agent.id] });
      onClose();
    },
  });

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const loading = categories.isLoading || assigned.isLoading;

  return (
    <Modal title={t("agents.modalTitle", { name: agent.full_name })} onClose={onClose}>
      {loading ? (
        <Spinner />
      ) : categories.error ? (
        <ErrorBox error={categories.error} />
      ) : categories.data && categories.data.length > 0 ? (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>
            {selected.size === 0
              ? t("agents.seesAll")
              : t("agents.seesN", { n: selected.size })}
          </p>
          <div className="check-list">
            {categories.data.map((c) => (
              <label key={c.id} className="checkbox-field">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                />
                {c.name}
              </label>
            ))}
          </div>
          {save.error && <ErrorBox error={save.error} />}
          <div className="modal-actions">
            <Button variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </>
      ) : (
        <Empty>{t("agents.noCategories")}</Empty>
      )}
    </Modal>
  );
}
