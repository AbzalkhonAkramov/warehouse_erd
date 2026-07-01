import { useMemo, useState } from "react";
import * as cls from "../ui/cls";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import { getCompany, getOrder, listCustomers, listProducts } from "../api/endpoints";
import type { SalesOrder } from "../api/types";
import { Button, Card, ErrorBox, Spinner } from "../components/ui";
import { useI18n } from "../i18n";
import { date, money, qty } from "../lib/format";

interface Logo {
  dataUrl: string;
  w: number;
  h: number;
}

// Rasterize any image URL (svg/png/…) to a PNG data URL so jsPDF can embed it.
function loadLogo(url: string): Promise<Logo | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth || 240;
        const h = img.naturalHeight || 80;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ dataUrl: canvas.toDataURL("image/png"), w, h });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

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
  // Always fall back to the name if there's no usable logo.
  const showName = mode === "text" || mode === "both" || !showLogo;

  const productName = useMemo(() => {
    const m = new Map<number, string>();
    products.data?.forEach((p) => m.set(p.id, p.name));
    return (pid: number, fallback?: string | null) => fallback ?? m.get(pid) ?? `#${pid}`;
  }, [products.data]);

  const customer = customers.data?.find((c) => c.id === order.data?.customer_id);

  async function buildDoc(o: SalesOrder): Promise<jsPDF> {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const left = 40;
    let y = 48;

    // Header honours the configured display mode: logo, text, or both.
    const logo = showLogo ? await loadLogo(logoUrl!) : null;
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(t("receipt.title"), 555, 48, { align: "right" });
    if (logo) {
      const hh = 40;
      doc.addImage(logo.dataUrl, "PNG", left, 28, logo.w * (hh / logo.h), hh);
      y = 28 + hh + 4;
    }
    if (showName) {
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(companyName, left, logo ? y + 14 : 48);
      y = logo ? y + 22 : 60;
    } else {
      y = Math.max(y, 60);
    }
    y += 20;
    doc.setFontSize(10);

    const line = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, left, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, left + 110, y);
      y += 16;
    };
    line(`${t("receipt.order")}:`, `#${o.order_no ?? o.id}`);
    if (o.invoice_number) line(`${t("receipt.invoice")}:`, o.invoice_number);
    line(`${t("col.created")}:`, date(o.created_at));
    line(`${t("common.status")}:`, t(`status.${o.status}`));
    line(`${t("receipt.customer")}:`, customer?.name ?? `#${o.customer_id}`);
    if (customer?.city) line(`${t("customers.city")}:`, customer.city);
    if (customer?.phone) line(`${t("col.phone")}:`, customer.phone);
    line(`${t("col.agent")}:`, o.agent_name ?? `#${o.agent_id}`);
    line(`${t("receipt.deliverer")}:`, o.deliverer ?? "—");

    y += 8;
    const cols = { p: left, q: 320, u: 400, t: 500 };
    doc.setFont("helvetica", "bold");
    doc.text(t("col.product"), cols.p, y);
    doc.text(t("col.qty"), cols.q, y, { align: "right" });
    doc.text(t("col.unitPrice"), cols.u, y, { align: "right" });
    doc.text(t("col.lineTotal"), cols.t, y, { align: "right" });
    y += 6;
    doc.line(left, y, 555, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    o.lines.forEach((l) => {
      doc.text(productName(l.product_id, l.product_name), cols.p, y);
      doc.text(qty(l.quantity), cols.q, y, { align: "right" });
      doc.text(money(l.unit_price), cols.u, y, { align: "right" });
      doc.text(money(l.line_total), cols.t, y, { align: "right" });
      y += 16;
    });
    y += 4;
    doc.line(350, y, 555, y);
    y += 18;
    const total = (label: string, value: string, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.text(label, 400, y, { align: "right" });
      doc.text(value, 555, y, { align: "right" });
      y += 16;
    };
    total(`${t("receipt.subtotal")}:`, money(o.subtotal));
    total(`${t("createOrder.discount")}:`, money(o.discount));
    total(`${t("createOrder.total")}:`, money(o.total), true);
    return doc;
  }

  const filename = (o: SalesOrder) => `receipt-${o.order_no ?? o.id}.pdf`;

  async function exportPdf() {
    if (!order.data) return;
    setBusy(true);
    try {
      (await buildDoc(order.data)).save(filename(order.data));
    } finally {
      setBusy(false);
    }
  }

  async function sharePdf() {
    if (!order.data) return;
    const o = order.data;
    setBusy(true);
    try {
      const blob = (await buildDoc(o)).output("blob");
      const file = new File([blob], filename(o), { type: "application/pdf" });
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        try {
          await nav.share({ files: [file], title: filename(o) });
        } catch {
          /* user cancelled */
        }
      } else {
        (await buildDoc(o)).save(filename(o)); // desktop fallback
      }
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
          <Button disabled={busy} onClick={exportPdf}>⬇ {t("receipt.export")}</Button>
          <Button variant="ghost" disabled={busy} onClick={sharePdf}>🔗 {t("receipt.share")}</Button>
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
            {o.invoice_number && <div>{t("receipt.invoice")}: {o.invoice_number}</div>}
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
            <div>{t("receipt.subtotal")}: {money(o.subtotal)}</div>
            <div>{t("createOrder.discount")}: {money(o.discount)}</div>
            <div className={cls.strong}>{t("createOrder.total")}: {money(o.total)}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
