import { useEffect, useRef, useState } from "react";
import * as cls from "../ui/cls";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteCompanyLogo,
  getCompany,
  updateCompany,
  uploadCompanyLogo,
} from "../api/endpoints";
import { Button, Card, ErrorBox, Spinner } from "../components/ui";
import { useI18n } from "../i18n";

type Mode = "text" | "logo" | "both";
const MODES: Mode[] = ["both", "logo", "text"];

export default function BrandingPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const company = useQuery({ queryKey: ["company"], queryFn: getCompany });
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("both");
  const [ok, setOk] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (company.data && !seeded) {
      setName(company.data.name);
      setMode(company.data.display_mode);
      setSeeded(true);
    }
  }, [company.data, seeded]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["company"] });

  const save = useMutation({
    mutationFn: () => updateCompany({ name, display_mode: mode }),
    onSuccess: () => {
      invalidate();
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    },
  });
  const upload = useMutation({
    mutationFn: (file: File) => uploadCompanyLogo(file),
    onSuccess: invalidate,
  });
  const removeLogo = useMutation({ mutationFn: deleteCompanyLogo, onSuccess: invalidate });

  if (company.isLoading) return <Spinner />;
  const logoUrl = company.data?.logo_url ?? null;

  return (
    <div className={cls.page}>
      <h1>{t("branding.title")}</h1>
      <p className={cls.muted} style={{ marginTop: -8, marginBottom: 16 }}>
        {t("branding.subtitle")}
      </p>

      <Card title={t("branding.display")}>
        <div className={cls.refundDest} style={{ marginTop: 0 }}>
          {MODES.map((m) => (
            <label key={m} className={cls.radio}>
              <input type="radio" checked={mode === m} onChange={() => setMode(m)} />
              {t(`branding.mode.${m}`)}
            </label>
          ))}
        </div>

        <label className={cls.field} style={{ maxWidth: 360, marginTop: 16 }}>
          <span>{t("branding.name")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <h3 className={cls.sectionSub}>{t("branding.logo")}</h3>
        <div className={cls.rowGap} style={{ alignItems: "center" }}>
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className={cls.receiptLogo} />
          ) : (
            <span className={cls.cx(cls.muted, cls.small)}>{t("branding.noLogo")}</span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.svg"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          {logoUrl && (
            <Button variant="ghost" disabled={removeLogo.isPending} onClick={() => removeLogo.mutate()}>
              {t("branding.removeLogo")}
            </Button>
          )}
        </div>
        <p className={cls.cx(cls.muted, cls.small)}>{t("branding.logoHint")}</p>

        {(save.error || upload.error || removeLogo.error) && (
          <ErrorBox error={(save.error || upload.error || removeLogo.error) as Error} />
        )}
        {ok && <div className={cls.okBox}>{t("common.saved")}</div>}
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? t("common.saving") : t("common.save")}
        </Button>
      </Card>

      <Card title={t("branding.preview")}>
        <div className={cls.receiptHead} style={{ borderBottom: "none" }}>
          {(mode === "logo" || mode === "both") && logoUrl ? (
            <img src={logoUrl} alt="logo" className={cls.receiptLogo} />
          ) : null}
          {(mode === "text" || mode === "both" || !logoUrl) && <strong>{name}</strong>}
        </div>
      </Card>
    </div>
  );
}
