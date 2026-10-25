import * as cls from "../ui/cls";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listSuppliers } from "../api/endpoints";
import { useI18n } from "../i18n";
import { Button, Card, Empty, ErrorBox, Spinner } from "../components/ui";

export default function SuppliersPage() {
  const { t } = useI18n();
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: listSuppliers });

  return (
    <div className={cls.page}>
      <div className={cls.pageHead}>
        <h1>{t("suppliers.title")}</h1>
        <Link to="/create">
          <Button variant="ghost">{t("create.createSupplier")}</Button>
        </Link>
      </div>

      <Card>
        {suppliers.isLoading ? (
          <Spinner />
        ) : suppliers.error ? (
          <ErrorBox error={suppliers.error} />
        ) : suppliers.data && suppliers.data.length > 0 ? (
          <table className={cls.table}>
            <thead>
              <tr>
                <th>{t("field.supplierCode")}</th>
                <th>{t("col.name")}</th>
                <th>{t("col.phone")}</th>
                <th>{t("suppliers.email")}</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.data.map((s) => (
                <tr key={s.id}>
                  <td className={cls.mono}>{s.code ?? "—"}</td>
                  <td className={cls.strong}>{s.name}</td>
                  <td>{s.phone ?? "—"}</td>
                  <td>{s.email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>{t("suppliers.empty")}</Empty>
        )}
      </Card>
    </div>
  );
}
