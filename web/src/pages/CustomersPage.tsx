import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listCustomers } from "../api/endpoints";
import type { Customer } from "../api/types";
import { useI18n } from "../i18n";
import { Button, Card, ErrorBox, ExcelButton, Spinner } from "../components/ui";
import { money } from "../lib/format";
import { exportExcel } from "../lib/excel";

const agentNames = (c: Customer) => (c.agents ?? []).map((a) => a.full_name).join(", ") || "—";

export default function CustomersPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });

  function exportCustomers() {
    if (!customers.data) return;
    exportExcel(
      "customers",
      [t("col.name"), t("col.phone"), t("customers.city"), t("customers.region"), t("col.agent"), t("col.creditLimit"), t("col.debt")],
      customers.data.map((c) => [
        c.name,
        c.phone ?? "",
        c.city ?? "",
        c.region_name ?? "",
        agentNames(c),
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
                <th>{t("customers.city")}</th>
                <th>{t("customers.region")}</th>
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
                  <tr key={c.id} className="clickable" onClick={() => navigate(`/customers/${c.id}`)}>
                    <td className="strong">{c.name}</td>
                    <td>{c.city ?? "—"}</td>
                    <td>{c.region_name ?? "—"}</td>
                    <td>{agentNames(c)}</td>
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
