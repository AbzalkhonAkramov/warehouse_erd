import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as cls from "../ui/cls";
import {
  createCurrency,
  deleteCurrency,
  listCurrencies,
  updateCurrency,
} from "../api/endpoints";
import type { Currency } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n";
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorBox,
  Modal,
  Spinner,
} from "../components/ui";

export default function CurrenciesPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const qc = useQueryClient();
  const currencies = useQuery({ queryKey: ["currencies"], queryFn: () => listCurrencies() });

  const [editing, setEditing] = useState<Currency | null>(null);
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<Currency | null>(null);
  const [error, setError] = useState<string | null>(null);

  const del = useMutation({
    mutationFn: (id: number) => deleteCurrency(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["currencies"] });
      setToDelete(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : t("common.somethingWrong")),
  });

  return (
    <div className={cls.page}>
      <div className={cls.pageHead}>
        <div>
          <h1>{t("currencies.title")}</h1>
          <p className={cls.muted}>{t("currencies.subtitle")}</p>
        </div>
        {isAdmin && <Button onClick={() => setAdding(true)}>{t("currencies.add")}</Button>}
      </div>

      <Card>
        {currencies.isLoading ? (
          <Spinner />
        ) : currencies.error ? (
          <ErrorBox error={currencies.error} />
        ) : (currencies.data?.length ?? 0) === 0 ? (
          <div className={cls.muted}>{t("currencies.none")}</div>
        ) : (
          <table className={cls.table}>
            <thead>
              <tr>
                <th>{t("currencies.code")}</th>
                <th>{t("currencies.name")}</th>
                <th>{t("currencies.symbol")}</th>
                <th>{t("currencies.active")}</th>
                {isAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {currencies.data!.map((c) => (
                <tr key={c.id}>
                  <td className={cls.strong}>{c.code}</td>
                  <td>{c.name}</td>
                  <td>{c.symbol}</td>
                  <td>
                    <span className={cls.badge[c.is_active ? "green" : "gray"]}>
                      {c.is_active ? t("currencies.active") : t("currencies.inactive")}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className={cls.actionsCol}>
                      <Button variant="ghost" onClick={() => setEditing(c)}>
                        {t("common.edit")}
                      </Button>
                      <Button variant="ghost" onClick={() => { setError(null); setToDelete(c); }}>
                        {t("common.delete")}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {error && <ErrorBox error={error} />}
      </Card>

      {adding && <CurrencyModal onClose={() => setAdding(false)} />}
      {editing && <CurrencyModal currency={editing} onClose={() => setEditing(null)} />}
      {toDelete && (
        <ConfirmDialog
          rows={[
            { label: t("common.action"), value: t("currencies.deleteConfirm") },
            { label: t("currencies.code"), value: toDelete.code },
          ]}
          busy={del.isPending}
          onCancel={() => setToDelete(null)}
          onConfirm={() => del.mutate(toDelete.id)}
        />
      )}
    </div>
  );
}

function CurrencyModal({ currency, onClose }: { currency?: Currency; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    code: currency?.code ?? "",
    name: currency?.name ?? "",
    symbol: currency?.symbol ?? "",
    is_active: currency?.is_active ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      currency
        ? updateCurrency(currency.id, form)
        : createCurrency(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["currencies"] });
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
    <Modal
      title={currency ? t("currencies.editTitle") : t("currencies.addTitle")}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className={cls.formGrid}>
          <label className={cls.field}>
            <span>{t("currencies.code")}</span>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              maxLength={8}
              required
            />
          </label>
          <label className={cls.field}>
            <span>{t("currencies.symbol")}</span>
            <input
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              maxLength={8}
              required
            />
          </label>
          <label className={cls.cx(cls.field, cls.fieldFull)}>
            <span>{t("currencies.name")}</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label className={cls.cx(cls.checkboxField, cls.fieldFull)}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <span>{t("currencies.active")}</span>
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
