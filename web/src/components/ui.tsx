import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { SalesOrderStatus, InvoiceStatus } from "../api/types";
import { useI18n } from "../i18n";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="card">
      {title && <div className="card-title">{title}</div>}
      {children}
    </div>
  );
}

export function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="stat">
      <div className="stat-value" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "success";
};

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  return <button className={`btn btn-${variant} ${className}`} {...rest} />;
}

const ORDER_COLORS: Record<SalesOrderStatus, string> = {
  new: "amber",
  shipped: "blue",
  delivered: "green",
  refund: "violet",
  cancelled: "gray",
};

const INVOICE_COLORS: Record<InvoiceStatus, string> = {
  unpaid: "red",
  partial: "amber",
  paid: "green",
};

export function StatusBadge({ status }: { status: SalesOrderStatus }) {
  const { t } = useI18n();
  return <span className={`badge badge-${ORDER_COLORS[status]}`}>{t(`status.${status}`)}</span>;
}

export function InvoiceBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useI18n();
  return (
    <span className={`badge badge-${INVOICE_COLORS[status]}`}>{t(`invoice.status.${status}`)}</span>
  );
}

export function ExcelButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <Button variant="ghost" onClick={onClick}>
      ⬇ {t("export.excel")}
    </Button>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return <div className="spinner">{label ?? t("common.loading")}</div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  const { t } = useI18n();
  const message = error instanceof Error ? error.message : t("common.somethingWrong");
  return <div className="error-box">{message}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Second-step confirmation that shows a summary of the entered data. */
export function ConfirmDialog({
  rows,
  busy,
  onConfirm,
  onCancel,
}: {
  rows: { label: string; value: ReactNode }[];
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <Modal title={t("confirm.title")} onClose={onCancel}>
      <p className="muted" style={{ marginTop: 0 }}>{t("confirm.question")}</p>
      <table className="table confirm-table">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <th>{r.label}</th>
              <td className="strong">{r.value || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button variant="success" onClick={onConfirm} disabled={busy}>
          {busy ? t("common.saving") : t("confirm.yes")}
        </Button>
      </div>
    </Modal>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
