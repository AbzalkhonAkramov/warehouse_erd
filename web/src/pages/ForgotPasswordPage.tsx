import { useState, type FormEvent } from "react";
import * as cls from "../ui/cls";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/endpoints";
import { useI18n } from "../i18n";
import { Button } from "../components/ui";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await forgotPassword(email);
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cls.centeredScreen}>
      <div className={cls.loginCard}>
        <div className={cls.loginLang}>
          <LanguageSwitcher />
        </div>
        <div className={cls.loginBrand}>📦 {t("brand")}</div>
        <p className={cls.loginSub}>{t("forgot.title")}</p>

        {done ? (
          <>
            <div className={cls.okBox}>{t("forgot.done")}</div>
            <Link to="/login">
              <Button>{t("register.backToLogin")}</Button>
            </Link>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <p className={cls.cx(cls.muted, cls.small)} style={{ marginTop: -8 }}>
              {t("forgot.subtitle")}
            </p>
            <label className={cls.field}>
              <span>{t("login.email")}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? t("common.saving") : t("forgot.submit")}
            </Button>
            <div style={{ marginTop: 12, textAlign: "center" }}>
              <Link to="/login" className={cls.plainLink} style={{ color: "var(--primary)" }}>
                {t("register.backToLogin")}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
