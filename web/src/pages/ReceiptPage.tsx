import { useMemo, useState } from "react";
import * as cls from "../ui/cls";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { downloadReceipt, getCompany, getOrder, listCustomers, listProducts } from "../api/endpoints";
import { Button, Card, ErrorBox, Spinner } from "../components/ui";
import { useI18n } from "../i18n";
import { date, money, qty } from "../lib/format";

export default function ReceiptPage() {
  const { id } = useParams();
  const oid = Number(id);
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const order = useQuery({ queryKey: ["order", oid], queryFn: () => getOrder(oid) });
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  const company = useQuery({ queryKey: ["company"], queryFn: getCompany });

  const companyName = company.data?.name ?? t("brand");
  const logoUrl = company.data?.logo_url ?? null;
  const mode = company.data?.display_mode ?? "both";
  const showLogo = mode !== "text" && !!logoUrl;
  const showName = mode === "text" || mode === "both" || !showLogo;

  const productName = useMemo(() => {
    const m = new Map<number, string>();
    products.data?.forEach((p) => m.set(p.id, p.name));
    return (pid: number, fallback?: string | null) => fallback ?? m.get(pid) ?? `#${pid}`;
  }, [products.data]);

  const customer = customers.data?.find((c) => c.id === order.data?.customer_id);

  async function exportExcel() {
    if (!order.data) return;
    setBusy(true);
    try {
      await downloadReceipt(order.data.id, order.data.order_no ?? undefined);
    } finally {
      setBusy(false);
    }
  }

  if (order.isLoading) return <Spinner />;
  if (order.error) return <div className={cls.page}><ErrorBox error={order.error} /></div>;
  const o = order.data!;

  return (
    <div className={cls.page}>
      <div className={cls.pageHead}>
        <h1>{t("receipt.title")} · #{o.order_no ?? o.id}</h1>
        <div className={cls.rowGap}>
          <Button disabled={busy} onClick={exportExcel}>⬇ {t("receipt.exportExcel")}</Button>
          <Link to="/orders" className={cls.btn.ghost}>← {t("orders.title")}</Link>
        </div>
      </div>

      <Card>
        <div className={cls.receipt}>
          <div className={cls.receiptHead}>
            <div className={cls.rowGap}>
              {showLogo && <img src={logoUrl!} alt={companyName} className={cls.receiptLogo} />}
              {showName && <strong>{companyName}</strong>}
            </div>
            <span className={cls.badge.blue}>{t(`status.${o.status}`)}</span>
          </div>
          <div className={cls.receiptMeta}>
            <div>{t("receipt.order")}: <strong>#{o.order_no ?? o.id}</strong></div>
            <div>{t("col.created")}: {date(o.created_at)}</div>
            <div>{t("receipt.customer")}: <strong>{customer?.name ?? `#${o.customer_id}`}</strong></div>
            {customer?.city && <div>{t("customers.city")}: {customer.city}</div>}
            <div>{t("col.agent")}: {o.agent_name ?? `#${o.agent_id}`}</div>
            <div>{t("receipt.deliverer")}: {o.deliverer ?? "—"}</div>
          </div>
          <table className={cls.tableSub}>
            <thead>
              <tr>
                <th>{t("col.product")}</th>
                <th className={cls.numCell}>{t("col.qty")}</th>
                <th className={cls.numCell}>{t("col.unitPrice")}</th>
                <th className={cls.numCell}>{t("col.lineTotal")}</th>
              </tr>
            </thead>
            <tbody>
              {o.lines.map((l) => (
                <tr key={l.id}>
                  <td>{productName(l.product_id, l.product_name)}</td>
                  <td className={cls.numCell}>{qty(l.quantity)}</td>
                  <td className={cls.numCell}>{money(l.unit_price)}</td>
                  <td className={cls.numCell}>{money(l.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={cls.receiptTotals}>
            <div className={cls.strong}>{t("createOrder.total")}: {money(o.total)}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
