import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listActivity, listUsers } from "../api/endpoints";
import { useI18n } from "../i18n";
import { Card, Empty, ErrorBox, ExcelButton, Spinner } from "../components/ui";
import { date } from "../lib/format";
import { exportExcel } from "../lib/excel";

export default function ActivityLogPage() {
  const { t } = useI18n();
  const [userId, setUserId] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");

  const users = useQuery({ queryKey: ["users", "all"], queryFn: () => listUsers() });
  const activity = useQuery({
    queryKey: ["activity", userId, from, to, search],
    queryFn: () =>
      listActivity({
        user_id: userId ? Number(userId) : undefined,
        date_from: from || undefined,
        date_to: to || undefined,
        search: search || undefined,
      }),
  });

  const exportLog = () => {
    if (!activity.data) return;
    exportExcel(
      "activity-log",
      [t("col.created"), t("col.user"), t("col.action"), t("activity.details"), "method", "path"],
      activity.data.map((a) => [
        date(a.created_at),
        a.user_name ?? `#${a.user_id ?? ""}`,
        a.action,
        a.detail ?? "",
        a.method,
        a.path,
      ]),
    );
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t("activity.title")}</h1>
        <ExcelButton onClick={exportLog} />
      </div>
      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
        {t("activity.subtitle")}
      </p>

      <div className="filter-row">
        <input
          className="search-input"
          placeholder={t("field.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">{t("activity.allUsers")}</option>
          {users.data?.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name}</option>
          ))}
        </select>
        <label className="inline-field">
          {t("field.dateFrom")}
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="inline-field">
          {t("field.dateTo")}
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      <Card>
        {activity.isLoading ? (
          <Spinner />
        ) : activity.error ? (
          <ErrorBox error={activity.error} />
        ) : activity.data && activity.data.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>{t("col.created")}</th>
                <th>{t("col.user")}</th>
                <th>{t("col.action")}</th>
                <th>{t("activity.details")}</th>
                <th className="muted">path</th>
              </tr>
            </thead>
            <tbody>
              {activity.data.map((a) => (
                <tr key={a.id}>
                  <td className="muted">{date(a.created_at)}</td>
                  <td>{a.user_name ?? `#${a.user_id ?? "—"}`}</td>
                  <td className="strong">{a.action}</td>
                  <td className="small">{a.detail || "—"}</td>
                  <td className="muted small mono">
                    {a.method} {a.path}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>{t("activity.empty")}</Empty>
        )}
      </Card>
    </div>
  );
}
