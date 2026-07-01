import { useMemo, useState, type FormEvent } from "react";
import * as cls from "../ui/cls";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listCustomers, listInvoices, recordPayment } from "../api/endpoints";
import type { Invoice, PaymentMethod } from "../api/types";
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorBox,
  ExcelButton,
  InvoiceBadge,
  Modal,
  Spinner,
} from "../components/ui";
import { useI18n } from "../i18n";
import { date, money } from "../lib/format";
import { exportExcel } from "../lib/excel";

function balance(inv: Invoice): number {
  return parseFloat(inv.total) - parseFloat(inv.paid_amount);
}

export default function InvoicesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [payError, setPayError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const invoices = useQuery({ queryKey: ["invoices"], queryFn: listInvoices });
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });

  const customerName = useMemo(() => {
    const map = new Map<number, string>();
    customers.data?.forEach((c) => map.set(c.id, c.name));
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [customers.data]);

  const pay = useMutation({
    mutationFn: () => recordPayment(paying!.id, amount, method),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setPaying(null);
      setAmount("");
    },
    onError: (e) => setPayError(e instanceof Error ? e.message : t("common.somethingWrong")),
  });

  function openPay(inv: Invoice) {
    setPaying(inv);
    setAmount(balance(inv).toFixed(2));
    setMethod("cash");
    setPayError(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setPayError(null);
    setConfirm(true);
  }

  function exportInvoices() {
    if (!invoices.data) return;
    exportExcel(
      "invoices",
      [
        t("col.invoice"),
        t("col.customer"),
        t("col.created"),
        t("col.total"),
        t("col.paid"),
        t("col.balance"),
        t("common.status"),
      ],
      invoices.data.map((inv) => [
        inv.number,
        customerName(inv.customer_id),
        date(inv.created_at),
        money(inv.total),
        money(inv.paid_amount),
        money(balance(inv)),
        t(`invoice.status.${inv.status}`),
      ]),
    );
  }

  return (
    <div className={cls.page}>
      <div className={cls.pageHead}>
        <h1>{t("invoices.title")}</h1>
        <ExcelButton onClick={exportInvoices} />
      </div>
      <Card>
        {invoices.isLoading ? (
          <Spinner />
        ) : invoices.error ? (
          <ErrorBox error={invoices.error} />
        ) : (
          <table className={cls.table}>
            <thead>
              <tr>
                <th>{t("col.invoice")}</th>
                <th>{t("col.customer")}</th>
                <th>{t("col.created")}</th>
                <th className={cls.numCell}>{t("col.total")}</th>
                <th className={cls.numCell}>{t("col.paid")}</th>
                <th className={cls.numCell}>{t("col.balance")}</th>
                <th>{t("common.status")}</th>
                <th className={cls.actionsCol} />
              </tr>
            </thead>
            <tbody>
              {invoices.data!.map((inv) => (
                <tr key={inv.id}>
                  <td className={cls.mono}>{inv.number}</td>
                  <td>{customerName(inv.customer_id)}</td>
                  <td>{date(inv.created_at)}</td>
                  <td className={cls.numCell}>{money(inv.total)}</td>
                  <td className={cls.numCell}>{money(inv.paid_amount)}</td>
                  <td className={cls.cx(cls.numCell, cls.strong)}>{money(balance(inv))}</td>
                  <td>
                    <InvoiceBadge status={inv.status} />
                  </td>
                  <td className={cls.actionsCol}>
                    <Link to={`/invoices/${inv.id}`}>
                      <Button variant="ghost">{t("invoices.history")}</Button>
                    </Link>
                    {inv.status !== "paid" && (
                      <Button onClick={() => openPay(inv)}>{t("invoices.recordPayment")}</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {paying && (
        <Modal title={t("payment.title", { number: paying.number })} onClose={() => setPaying(null)}>
          <form onSubmit={submit}>
            <p className={cls.muted}>
              {t("payment.balanceDue")} <strong>{money(balance(paying))}</strong>
            </p>
            <div className={cls.formGrid}>
              <label className={cls.field}>
                <span>{t("field.amount")}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={balance(paying)}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </label>
              <label className={cls.field}>
                <span>{t("field.method")}</span>
                <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  <option value="cash">{t("method.cash")}</option>
                  <option value="transfer">{t("method.transfer")}</option>
                  <option value="card">{t("method.card")}</option>
                </select>
              </label>
            </div>
            {payError && <div className={cls.errorBox}>{payError}</div>}
            <div className={cls.modalActions}>
              <Button type="button" variant="ghost" onClick={() => setPaying(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="success" disabled={pay.isPending}>
                {pay.isPending ? t("common.saving") : t("invoices.recordPayment")}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {confirm && paying && (
        <ConfirmDialog
          rows={[
            { label: t("col.invoice"), value: paying.number },
            { label: t("field.amount"), value: money(amount) },
            { label: t("field.method"), value: t(`method.${method}`) },
          ]}
          busy={pay.isPending}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            pay.mutate();
          }}
        />
      )}
    </div>
  );
}
