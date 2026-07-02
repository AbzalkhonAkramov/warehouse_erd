import { useState } from "react";
import * as cls from "../ui/cls";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  confirmRemittance,
  getCompany,
  listAgentsCash,
  listRemittances,
  receiveCash,
  rejectRemittance,
  updateCompany,
} from "../api/endpoints";
import type { AgentCash } from "../api/types";
import { Button, Card, Empty, ErrorBox, Modal, Spinner } from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n";
import { money } from "../lib/format";

export default function CashPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const qc = useQueryClient();

  const agents = useQuery({ queryKey: ["cash-agents"], queryFn: listAgentsCash });
  const company = useQuery({ queryKey: ["company"], queryFn: getCompany });
  const pending = useQuery({ queryKey: ["remittances", "pending"], queryFn: () => listRemittances() });

  const [receiveFor, setReceiveFor] = useState<AgentCash | null>(null);

  const mode = company.data?.cash_handover_mode ?? "manager_records";

  const setMode = useMutation({
    mutationFn: (m: string) => updateCompany({ cash_handover_mode: m }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company"] }),
  });

  const confirm = useMutation({
    mutationFn: confirmRemittance,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-agents"] });
      qc.invalidateQueries({ queryKey: ["remittances"] });
    },
  });
  const reject = useMutation({
    mutationFn: rejectRemittance,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-agents"] });
      qc.invalidateQueries({ queryKey: ["remittances"] });
    },
  });

  const pendingRows = (pending.data ?? []).filter((r) => r.status === "pending");

  return (
    <div className={cls.page}>
      <div className={cls.pageHead}>
        <h1>{t("cash.title")}</h1>
        {isAdmin && (
          <label className={cls.inlineField}>
            {t("cash.mode")}
            <select
              value={mode}
              onChange={(e) => setMode.mutate(e.target.value)}
              disabled={setMode.isPending}
            >
              <option value="manager_records">{t("cash.modeManager")}</option>
              <option value="agent_submits">{t("cash.modeAgent")}</option>
            </select>
          </label>
        )}
      </div>

      {/* Pending handovers awaiting confirmation (agent_submits mode) */}
      {pendingRows.length > 0 && (
        <Card title={t("cash.pendingTitle")}>
          <table className={cls.table}>
            <thead>
              <tr>
                <th>{t("col.agent")}</th>
                <th className={cls.numCell}>{t("cash.amount")}</th>
                <th>{t("orders.note")}</th>
                <th className={cls.actionsCol} />
              </tr>
            </thead>
            <tbody>
              {pendingRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.agent_name ?? `#${r.agent_id}`}</td>
                  <td className={cls.cx(cls.numCell, cls.strong)}>{money(r.amount)}</td>
                  <td className={cls.muted}>{r.note ?? "—"}</td>
                  <td className={cls.actionsCol}>
                    <Button
                      variant="success"
                      onClick={() => confirm.mutate(r.id)}
                      disabled={confirm.isPending}
                    >
                      {t("cash.confirm")}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => reject.mutate(r.id)}
                      disabled={reject.isPending}
                    >
                      {t("cash.reject")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card>
        {agents.isLoading ? (
          <Spinner />
        ) : agents.error ? (
          <ErrorBox error={agents.error} />
        ) : agents.data && agents.data.length > 0 ? (
          <table className={cls.table}>
            <thead>
              <tr>
                <th>{t("col.agent")}</th>
                <th className={cls.numCell}>{t("cash.collected")}</th>
                <th className={cls.numCell}>{t("cash.withManager")}</th>
                <th className={cls.numCell}>{t("cash.withAgent")}</th>
                <th className={cls.actionsCol} />
              </tr>
            </thead>
            <tbody>
              {agents.data.map((a) => (
                <tr key={a.agent_id}>
                  <td>{a.agent_name}</td>
                  <td className={cls.numCell}>{money(a.collected)}</td>
                  <td className={cls.numCell}>{money(a.received)}</td>
                  <td className={cls.cx(cls.numCell, cls.strong)}>
                    {money(a.outstanding)}
                    {parseFloat(String(a.pending)) > 0 && (
                      <span className={cls.cx(cls.muted, cls.small)}>
                        {" "}
                        ({t("cash.pendingN", { n: money(a.pending) })})
                      </span>
                    )}
                  </td>
                  <td className={cls.actionsCol}>
                    <Button
                      onClick={() => setReceiveFor(a)}
                      disabled={parseFloat(String(a.outstanding)) <= 0}
                    >
                      {t("cash.receive")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>{t("cash.noAgents")}</Empty>
        )}
      </Card>

      {receiveFor && (
        <ReceiveModal agent={receiveFor} onClose={() => setReceiveFor(null)} />
      )}
    </div>
  );
}

function ReceiveModal({ agent, onClose }: { agent: AgentCash; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const outstanding = parseFloat(String(agent.outstanding));
  const [amount, setAmount] = useState(String(agent.outstanding));
  const [note, setNote] = useState("");

  const save = useMutation({
    mutationFn: () => receiveCash(agent.agent_id, amount, note || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-agents"] });
      qc.invalidateQueries({ queryKey: ["remittances"] });
      onClose();
    },
  });

  const value = parseFloat(amount.replace(",", "."));
  const invalid = !(value > 0) || value > outstanding + 0.001;

  return (
    <Modal title={t("cash.receiveTitle", { name: agent.agent_name })} onClose={onClose}>
      <p className={cls.cx(cls.muted, cls.small)} style={{ marginTop: 0 }}>
        {t("cash.withAgent")}: {money(agent.outstanding)}
      </p>
      <label className={cls.field}>
        <span>{t("cash.amount")}</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <label className={cls.field}>
        <span>{t("orders.note")}</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {save.error && <ErrorBox error={save.error} />}
      <div className={cls.modalActions}>
        <Button variant="ghost" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button variant="success" onClick={() => save.mutate()} disabled={invalid || save.isPending}>
          {save.isPending ? t("common.saving") : t("cash.receive")}
        </Button>
      </div>
    </Modal>
  );
}
