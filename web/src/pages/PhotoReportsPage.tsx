import { useMemo, useState } from "react";
import * as cls from "../ui/cls";
import { useQuery } from "@tanstack/react-query";
import {
  listCustomers,
  listPhotoReports,
  listPhotoTopics,
  listUsers,
  type PhotoFilters,
} from "../api/endpoints";
import type { PhotoImage, PhotoReport } from "../api/types";
import { Card, Empty, ErrorBox, Spinner } from "../components/ui";
import { useI18n } from "../i18n";
import { date } from "../lib/format";

type T = (key: string, vars?: Record<string, string | number>) => string;

const STATUSES = ["pending", "sent", "failed"] as const;

function statusBadge(status: PhotoReport["status"], t: T) {
  const color = status === "sent" ? "green" : status === "failed" ? "red" : "amber";
  return <span className={cls.badge[color]}>{t(`photos.status.${status}`)}</span>;
}

function stageLink(images: PhotoImage[], stage: "before" | "after", t: T) {
  const img = images.find((i) => i.stage === stage);
  if (!img || !img.telegram_link) {
    return (
      <span className={cls.note}>
        {t(`photos.stage.${stage}`)}: {t("photo.notSent")}
      </span>
    );
  }
  return (
    <a className={cls.cx(cls.btn.ghost, cls.tgLink)} href={img.telegram_link} target="_blank" rel="noreferrer">
      ✈ {t(`photos.stage.${stage}`)} · {t("photo.viewInTelegram")}
    </a>
  );
}

export default function PhotoReportsPage() {
  const { t } = useI18n();
  const [filters, setFilters] = useState<PhotoFilters>({});

  const reports = useQuery({
    queryKey: ["photo-reports", filters],
    queryFn: () => listPhotoReports(filters),
  });
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  const agents = useQuery({ queryKey: ["users", "agent"], queryFn: () => listUsers("agent") });
  const topics = useQuery({ queryKey: ["photo-topics"], queryFn: listPhotoTopics });

  function set<K extends keyof PhotoFilters>(key: K, value: PhotoFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value === "" ? undefined : value }));
  }

  const customerName = useMemo(() => {
    const map = new Map<number, string>();
    customers.data?.forEach((c) => map.set(c.id, c.name));
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [customers.data]);

  const agentName = useMemo(() => {
    const map = new Map<number, string>();
    agents.data?.forEach((a) => map.set(a.id, a.full_name));
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [agents.data]);

  return (
    <div className={cls.page}>
      <h1>{t("photos.title")}</h1>

      <Card>
        <div className={cls.filterGrid}>
          <label className={cls.field}>
            <span>{t("photos.market")}</span>
            <select
              value={filters.customer_id ?? ""}
              onChange={(e) => set("customer_id", e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">{t("common.all")}</option>
              {customers.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className={cls.field}>
            <span>{t("col.agent")}</span>
            <select
              value={filters.agent_id ?? ""}
              onChange={(e) => set("agent_id", e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">{t("common.all")}</option>
              {agents.data?.map((a) => (
                <option key={a.id} value={a.id}>{a.full_name}</option>
              ))}
            </select>
          </label>
          <label className={cls.field}>
            <span>{t("common.status")}</span>
            <select
              value={filters.status ?? ""}
              onChange={(e) => set("status", e.target.value || undefined)}
            >
              <option value="">{t("common.all")}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{t(`photos.status.${s}`)}</option>
              ))}
            </select>
          </label>
          <label className={cls.field}>
            <span>{t("photos.topic")}</span>
            <select
              value={filters.topic_id ?? ""}
              onChange={(e) => set("topic_id", e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">{t("common.all")}</option>
              {topics.data?.map((tp) => (
                <option key={tp.id} value={tp.id}>{tp.name}</option>
              ))}
            </select>
          </label>
          <label className={cls.field}>
            <span>{t("col.dateFrom")}</span>
            <input
              type="date"
              value={filters.date_from ?? ""}
              onChange={(e) => set("date_from", e.target.value || undefined)}
            />
          </label>
          <label className={cls.field}>
            <span>{t("col.dateTo")}</span>
            <input
              type="date"
              value={filters.date_to ?? ""}
              onChange={(e) => set("date_to", e.target.value || undefined)}
            />
          </label>
        </div>
      </Card>

      {reports.isLoading ? (
        <Spinner />
      ) : reports.error ? (
        <ErrorBox error={reports.error} />
      ) : reports.data && reports.data.length > 0 ? (
        <div className={cls.reportGrid}>
          {reports.data.map((r) => (
            <Card key={r.id}>
              <div className={cls.reportHead}>
                <div>
                  <strong>{customerName(r.customer_id)}</strong>
                  <div className={cls.cx(cls.muted, cls.small)}>
                    {agentName(r.agent_id)} · {date(r.created_at)}
                  </div>
                </div>
                {statusBadge(r.status, t)}
              </div>
              {r.sales_order_id ? (
                <p className={cls.cx(cls.note, cls.small)}>
                  {t("photos.order")}: #{r.sales_order_id}
                </p>
              ) : (
                <p className={cls.cx(cls.note, cls.small)}>{t("photos.noOrder")}</p>
              )}
              <div className={cls.tgLinks}>
                {stageLink(r.images, "before", t)}
                {stageLink(r.images, "after", t)}
              </div>
              {r.note && <p className={cls.note}>{r.note}</p>}
              {r.status === "failed" && (
                <div className={cls.reportFoot}>
                  <span className={cls.cx(cls.muted, cls.small)}>{r.error}</span>
                  <span className={cls.cx(cls.muted, cls.small)}>{t("photos.resendUnavailable")}</span>
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
