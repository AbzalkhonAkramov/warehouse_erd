import { useState, type FormEvent } from "react";
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
    <div className="centered-screen">
      <div className="login-card">
        <div className="login-lang">
          <LanguageSwitcher />
        </div>
        <div className="brand login-brand">📦 {t("brand")}</div>
        <p className="login-sub">{t("forgot.title")}</p>

        {done ? (
          <>
            <div className="ok-box">{t("forgot.done")}</div>
            <Link to="/login">
              <Button>{t("register.backToLogin")}</Button>
            </Link>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <p className="muted small" style={{ marginTop: -8 }}>
              {t("forgot.subtitle")}
            </p>
            <label className="field">
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
              <Link to="/login" className="plain-link" style={{ color: "var(--primary)" }}>
                {t("register.backToLogin")}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
