import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { register } from "../api/endpoints";
import { useI18n } from "../i18n";
import { Button } from "../components/ui";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function RegisterPage() {
  const { t } = useI18n();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
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
        <p className="login-sub">{t("register.title")}</p>

        {done ? (
          <>
            <div className="ok-box">{t("register.done")}</div>
            <Link to="/login">
              <Button>{t("register.backToLogin")}</Button>
            </Link>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <p className="muted small" style={{ marginTop: -8 }}>
              {t("register.subtitle")}
            </p>
            <label className="field">
              <span>{t("register.fullName")}</span>
              <input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>{t("login.email")}</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>{t("col.phone")}</span>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label className="field">
              <span>{t("login.password")}</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </label>
            {error && <div className="error-box">{error}</div>}
            <Button type="submit" disabled={busy}>
              {busy ? t("common.saving") : t("register.submit")}
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
