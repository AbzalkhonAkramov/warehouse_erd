import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listCustomers, listPhotoReports, resendPhotoReport, uploadUrl } from "../api/endpoints";
import type { PhotoImage, PhotoReport } from "../api/types";
import { Button, Card, Empty, ErrorBox, Spinner } from "../components/ui";
import { useI18n } from "../i18n";
import { date } from "../lib/format";

type T = (key: string, vars?: Record<string, string | number>) => string;

function statusBadge(status: PhotoReport["status"], t: T) {
  const cls = status === "sent" ? "green" : status === "failed" ? "red" : "amber";
  return <span className={`badge badge-${cls}`}>{t(`photos.status.${status}`)}</span>;
}

function stageImg(images: PhotoImage[], stage: "before" | "after", t: T) {
  const img = images.find((i) => i.stage === stage);
  if (!img) {
    return (
      <div className="photo-thumb empty-thumb">
        {t(stage === "before" ? "photos.noBefore" : "photos.noAfter")}
      </div>
    );
  }
  return (
    <a href={uploadUrl(img.file_path)} target="_blank" rel="noreferrer" className="photo-thumb">
      <img src={uploadUrl(img.file_path)} alt={stage} />
      <span className="photo-stage">{t(`photos.stage.${stage}`)}</span>
    </a>
  );
}

export default function PhotoReportsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const reports = useQuery({ queryKey: ["photo-reports"], queryFn: listPhotoReports });
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });

  const customerName = useMemo(() => {
    const map = new Map<number, string>();
    customers.data?.forEach((c) => map.set(c.id, c.name));
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [customers.data]);

  const resend = useMutation({
    mutationFn: resendPhotoReport,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photo-reports"] }),
  });

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
              <div className="photo-pair">
                {stageImg(r.images, "before", t)}
                {stageImg(r.images, "after", t)}
              </div>
              {r.note && <p className="note">{r.note}</p>}
              {r.status === "failed" && (
                <div className="report-foot">
                  <span className="muted small">{r.error}</span>
                  <Button onClick={() => resend.mutate(r.id)} disabled={resend.isPending}>
                    {t("photos.resend")}
                  </Button>
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
