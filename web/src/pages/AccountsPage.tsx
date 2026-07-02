import { useState, type FormEvent } from "react";
import * as cls from "../ui/cls";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listUsers, resetUserPassword, updateUser } from "../api/endpoints";
import type { Role, User } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n";
import { Button, Card, Empty, ErrorBox, Modal, Spinner } from "../components/ui";

const ROLES: Role[] = ["admin", "manager", "accountant", "warehouse", "agent", "deliverer"];

export default function AccountsPage() {
  const { t } = useI18n();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["users", "all"], queryFn: () => listUsers() });
  const [error, setError] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<User | null>(null);

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<User> }) => updateUser(id, body),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => {
      setError(e instanceof Error ? e.message : t("common.somethingWrong"));
      qc.invalidateQueries({ queryKey: ["users"] }); // revert the control to server state
    },
  });

  // Inactive (pending/disabled) accounts first.
  const sorted = [...(users.data ?? [])].sort(
    (a, b) => Number(a.is_active) - Number(b.is_active),
  );

  return (
    <div className={cls.page}>
      <h1>{t("accounts.title")}</h1>
      <p className={cls.muted} style={{ marginTop: -8, marginBottom: 16 }}>
        {t("accounts.subtitle")}
      </p>

      {error && <div className={cls.errorBox}>{error}</div>}

      <Card>
        {users.isLoading ? (
          <Spinner />
        ) : users.error ? (
          <ErrorBox error={users.error} />
        ) : sorted.length > 0 ? (
          <table className={cls.table}>
            <thead>
              <tr>
                <th>{t("col.name")}</th>
                <th>{t("col.email")}</th>
                <th>{t("col.role")}</th>
                <th>{t("common.status")}</th>
                <th>{t("accounts.photosImportant")}</th>
                <th className={cls.actionsCol} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => {
                const isSelf = u.id === me?.id;
                return (
                  <tr key={u.id}>
                    <td>
                      {u.full_name}
                      {isSelf && <span className={cls.cx(cls.muted, cls.small)}> ({t("accounts.you")})</span>}
                    </td>
                    <td className={cls.muted}>{u.email}</td>
                    <td>
                      <select
                        value={u.role}
                        disabled={isSelf}
                        onChange={(e) =>
                          patch.mutate({ id: u.id, body: { role: e.target.value as Role } })
                        }
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {u.is_active ? (
                        <span className={cls.badge.green}>{t("common.active")}</span>
                      ) : (
                        <span className={cls.badge.amber}>{t("accounts.pending")}</span>
                      )}
                      {u.reset_requested && (
                        <span className={cls.badge.red} style={{ marginLeft: 6 }}>
                          {t("accounts.resetRequested")}
                        </span>
                      )}
                    </td>
                    <td>
                      {u.role === "agent" ? (
                        <label className={cls.inlineCheck} title={t("accounts.photosImportantHint")}>
                          <input
                            type="checkbox"
                            checked={u.photo_required ?? true}
                            onChange={(e) =>
                              patch.mutate({
                                id: u.id,
                                body: { photo_required: e.target.checked },
                              })
                            }
                          />
                        </label>
                      ) : (
                        <span className={cls.muted}>—</span>
                      )}
                    </td>
                    <td className={cls.actionsCol}>
                      <Button variant="ghost" onClick={() => setResetFor(u)}>
                        {t("accounts.resetPassword")}
                      </Button>
                      {isSelf ? null : u.is_active ? (
                        <Button
                          variant="danger"
                          onClick={() => patch.mutate({ id: u.id, body: { is_active: false } })}
                        >
                          {t("accounts.disable")}
                        </Button>
                      ) : (
                        <Button
                          variant="success"
                          onClick={() => patch.mutate({ id: u.id, body: { is_active: true } })}
                        >
                          {t("accounts.activate")}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty>—</Empty>
        )}
      </Card>

      {resetFor && (
        <ResetPasswordModal
          user={resetFor}
          onClose={() => setResetFor(null)}
          onError={(m) => setError(m)}
        />
      )}
    </div>
  );
}

function ResetPasswordModal({
  user,
  onClose,
  onError,
}: {
  user: User;
  onClose: () => void;
  onError: (m: string) => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [pw, setPw] = useState("");

  const reset = useMutation({
    mutationFn: () => resetUserPassword(user.id, pw),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (e) => {
      onError(e instanceof Error ? e.message : t("common.somethingWrong"));
      onClose();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (pw) reset.mutate();
  }

  return (
    <Modal title={`${t("accounts.resetPassword")} — ${user.full_name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <label className={cls.field}>
          <span>{t("changePw.new")}</span>
          <input
            type="text"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <div className={cls.modalActions}>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={reset.isPending || !pw}>
            {reset.isPending ? t("common.saving") : t("accounts.resetPassword")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
