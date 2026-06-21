import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n";
import { Button } from "../components/ui";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("manager@erp.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="centered-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-lang">
          <LanguageSwitcher />
        </div>
        <div className="brand login-brand">📦 {t("brand")}</div>
        <p className="login-sub">{t("login.subtitle")}</p>
        <label className="field">
          <span>{t("login.email")}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="field">
          <span>{t("login.password")}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <div className="error-box">{error}</div>}
        <Button type="submit" disabled={busy}>
          {busy ? t("login.signingIn") : t("login.signIn")}
        </Button>
        <div style={{ marginTop: 12, textAlign: "center", display: "flex", justifyContent: "space-between" }}>
          <Link to="/register" className="plain-link" style={{ color: "var(--primary)" }}>
            {t("login.register")}
          </Link>
          <Link to="/forgot" className="plain-link" style={{ color: "var(--muted)" }}>
            {t("login.forgot")}
          </Link>
        </div>
      </form>
    </div>
  );
}
