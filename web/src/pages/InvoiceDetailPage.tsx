import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { getInvoice, listCustomers, uploadPaymentImage, uploadUrl } from "../api/endpoints";
import type { Payment } from "../api/types";
import { Card, ErrorBox, ExcelButton, InvoiceBadge, Spinner, Stat } from "../components/ui";
import { useI18n } from "../i18n";
import { date, money } from "../lib/format";
import { exportExcel } from "../lib/excel";

export default function InvoiceDetailPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const invoiceId = Number(id);

  const invoice = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => getInvoice(invoiceId),
    enabled: Number.isFinite(invoiceId),
  });
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  const customerName = (cid: number) =>
    customers.data?.find((c) => c.id === cid)?.name ?? `#${cid}`;

  return (
    <div className="page">
      <Link to="/invoices" className="back-link">
        ← {t("common.back")}
      </Link>

      {invoice.isLoading ? (
        <Spinner />
      ) : invoice.error ? (
        <ErrorBox error={invoice.error} />
      ) : invoice.data ? (
        (() => {
          const inv = invoice.data!;
          const balance = parseFloat(inv.total) - parseFloat(inv.paid_amount);
          return (
            <>
              <div className="page-head">
                <h1>
                  {inv.number} · {customerName(inv.customer_id)}
                </h1>
                <InvoiceBadge status={inv.status} />
              </div>

              <div className="stat-grid">
                <Card>
                  <Stat label={t("col.total")} value={money(inv.total)} />
                </Card>
                <Card>
                  <Stat label={t("col.paid")} value={money(inv.paid_amount)} accent="#16a34a" />
                </Card>
                <Card>
                  <Stat
                    label={t("col.balance")}
                    value={money(balance)}
                    accent={balance > 0 ? "#b91c1c" : undefined}
                  />
                </Card>
              </div>

              <Card title={t("invoiceDetail.payments")}>
                {inv.payments.length > 0 && (
                  <div className="modal-toolbar">
                    <span />
                    <ExcelButton
                      onClick={() =>
                        exportExcel(
                          `${inv.number}-payments`,
                          [
                            t("col.date"),
                            t("field.amount"),
                            t("field.method"),
                            t("col.collectedBy"),
                            t("orders.note"),
                          ],
                          inv.payments.map((p) => [
                            date(p.collected_at),
                            money(p.amount),
                            t(`method.${p.method}`),
                            p.collected_by_name ?? "",
                            p.note ?? "",
                          ]),
                        )
                      }
                    />
                  </div>
                )}
                {inv.payments.length === 0 ? (
                  <div className="empty">{t("invoiceDetail.noPayments")}</div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t("col.date")}</th>
                        <th className="num">{t("field.amount")}</th>
                        <th>{t("field.method")}</th>
                        <th>{t("col.collectedBy")}</th>
                        <th>{t("orders.note")}</th>
                        <th>{t("col.receipt")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inv.payments.map((p) => (
                        <tr key={p.id}>
                          <td>{date(p.collected_at)}</td>
                          <td className="num strong">{money(p.amount)}</td>
                          <td>{t(`method.${p.method}`)}</td>
                          <td>{p.collected_by_name ?? "—"}</td>
                          <td className="muted">{p.note ?? "—"}</td>
                          <td>
                            <ReceiptCell payment={p} invoiceId={invoiceId} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </>
          );
        })()
      ) : null}
    </div>
  );
}

function ReceiptCell({ payment, invoiceId }: { payment: Payment; invoiceId: number }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: (file: File) => uploadPaymentImage(payment.id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice", invoiceId] }),
  });

  return (
    <div className="receipt-cell">
      {payment.image_path && (
        <a href={uploadUrl(payment.image_path)} target="_blank" rel="noreferrer">
          <img className="receipt-thumb" src={uploadUrl(payment.image_path)} alt="receipt" />
        </a>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload.mutate(f);
        }}
      />
      <button className="chip" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
        {upload.isPending ? "…" : payment.image_path ? "↺" : `📎 ${t("payment.attachReceipt")}`}
      </button>
    </div>
  );
}
