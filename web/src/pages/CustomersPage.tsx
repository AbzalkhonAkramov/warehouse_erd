import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listCustomers, listUsers } from "../api/endpoints";
import { useI18n } from "../i18n";
import { Button, Card, ErrorBox, ExcelButton, Spinner } from "../components/ui";
import { money } from "../lib/format";
import { exportExcel } from "../lib/excel";

export default function CustomersPage() {
  const { t } = useI18n();
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  const agents = useQuery({ queryKey: ["users", "agent"], queryFn: () => listUsers("agent") });

  const agentName = useMemo(() => {
    const map = new Map<number, string>();
    agents.data?.forEach((a) => map.set(a.id, a.full_name));
    return (id?: number | null) => (id ? map.get(id) ?? `#${id}` : "—");
  }, [agents.data]);

  function exportCustomers() {
    if (!customers.data) return;
    exportExcel(
      "customers",
      [t("col.name"), t("col.phone"), t("col.agent"), t("col.creditLimit"), t("col.debt")],
      customers.data.map((c) => [
        c.name,
        c.phone ?? "",
        agentName(c.agent_id),
        money(c.credit_limit),
        money(c.debt),
      ]),
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t("customers.title")}</h1>
        <div className="head-actions">
          <ExcelButton onClick={exportCustomers} />
          <Link to="/create">
            <Button>{t("customers.new")}</Button>
          </Link>
        </div>
      </div>

      <Card>
        {customers.isLoading ? (
          <Spinner />
        ) : customers.error ? (
          <ErrorBox error={customers.error} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("col.name")}</th>
                <th>{t("col.phone")}</th>
                <th>{t("col.agent")}</th>
                <th className="num">{t("col.creditLimit")}</th>
                <th className="num">{t("col.debt")}</th>
              </tr>
            </thead>
            <tbody>
              {customers.data!.map((c) => {
                const over =
                  parseFloat(c.debt) > parseFloat(c.credit_limit) && parseFloat(c.credit_limit) > 0;
                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.phone ?? "—"}</td>
                    <td>{agentName(c.agent_id)}</td>
                    <td className="num">{money(c.credit_limit)}</td>
                    <td className={`num${over ? " warn strong" : ""}`}>{money(c.debt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
