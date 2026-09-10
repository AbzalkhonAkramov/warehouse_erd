import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { SalesOrderStatus, InvoiceStatus } from "../api/types";
import { useI18n } from "../i18n";
import * as cls from "../ui/cls";

export function Card({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cls.cx(cls.card, "mb-5", className)}>
      {title && <div className={cls.cardTitle}>{title}</div>}
      {children}
    </div>
  );
}

export function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div>
      <div className={cls.statValue} style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className={cls.statLabel}>{label}</div>
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "success";
};

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  return <button className={cls.cx(cls.btn[variant], className)} {...rest} />;
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
  return <span className={cls.badge[ORDER_COLORS[status]]}>{t(`status.${status}`)}</span>;
}

export function InvoiceBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useI18n();
  return <span className={cls.badge[INVOICE_COLORS[status]]}>{t(`invoice.status.${status}`)}</span>;
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
  return (
    <div className={cls.spinner}>
      <span
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand align-[-3px] mr-2"
        aria-hidden
      />
      {label ?? t("common.loading")}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  const { t } = useI18n();
  const message = error instanceof Error ? error.message : t("common.somethingWrong");
  return <div className={cls.errorBox}>{message}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className={cls.empty}>{children}</div>;
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
      <p className={cls.cx(cls.muted, "mt-0")}>{t("confirm.question")}</p>
      <table className={cls.confirmTable}>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <th>{r.label}</th>
              <td className={cls.strong}>{r.value || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={cls.modalActions}>
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
    <div className={cls.modalOverlay} onClick={onClose}>
      <div className={cls.modal} onClick={(e) => e.stopPropagation()}>
        <div className={cls.modalHeader}>
          <h3 className="m-0 text-base">{title}</h3>
          <button className={cls.modalClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className={cls.modalBody}>{children}</div>
      </div>
    </div>
  );
}
