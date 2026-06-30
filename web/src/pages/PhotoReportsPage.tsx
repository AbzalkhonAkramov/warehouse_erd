import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listCustomers, listPhotoReports } from "../api/endpoints";
import type { PhotoImage, PhotoReport } from "../api/types";
import { Card, Empty, ErrorBox, Spinner } from "../components/ui";
import { useI18n } from "../i18n";
import { date } from "../lib/format";

type T = (key: string, vars?: Record<string, string | number>) => string;

function statusBadge(status: PhotoReport["status"], t: T) {
  const cls = status === "sent" ? "green" : status === "failed" ? "red" : "amber";
  return <span className={`badge badge-${cls}`}>{t(`photos.status.${status}`)}</span>;
}

function stageLink(images: PhotoImage[], stage: "before" | "after", t: T) {
  const img = images.find((i) => i.stage === stage);
  if (!img || !img.telegram_link) {
    return (
      <span className="note muted">
        {t(`photos.stage.${stage}`)}: {t("photo.notSent")}
      </span>
    );
  }
  return (
    <a className="btn btn-ghost tg-link" href={img.telegram_link} target="_blank" rel="noreferrer">
      ✈ {t(`photos.stage.${stage}`)} · {t("photo.viewInTelegram")}
    </a>
  );
}

export default function PhotoReportsPage() {
  const { t } = useI18n();
  const reports = useQuery({ queryKey: ["photo-reports"], queryFn: listPhotoReports });
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });

  const customerName = useMemo(() => {
    const map = new Map<number, string>();
    customers.data?.forEach((c) => map.set(c.id, c.name));
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [customers.data]);

  return (
    <div className="page">
      <h1>{t("photos.title")}</h1>
      {reports.isLoading ? (
        <Spinner />
      ) : reports.error ? (
        <ErrorBox error={reports.error} />
      ) : reports.data && reports.data.length > 0 ? (
        <div className="report-grid">
          {reports.data.map((r) => (
            <Card key={r.id}>
              <div className="report-head">
                <div>
                  <strong>{customerName(r.customer_id)}</strong>
                  <div className="muted small">{date(r.created_at)}</div>
                </div>
                {statusBadge(r.status, t)}
              </div>
              {r.sales_order_id ? (
                <p className="note muted small">
                  {t("photos.order")}: #{r.sales_order_id}
                </p>
              ) : (
                <p className="note muted small">{t("photos.noOrder")}</p>
              )}
              <div className="tg-links">
                {stageLink(r.images, "before", t)}
                {stageLink(r.images, "after", t)}
              </div>
              {r.note && <p className="note">{r.note}</p>}
              {r.status === "failed" && (
                <div className="report-foot">
                  <span className="muted small">{r.error}</span>
                  <span className="muted small">{t("photos.resendUnavailable")}</span>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Empty>{t("photos.empty")}</Empty>
      )}
    </div>
  );
}
