import { useState, type FormEvent } from "react";
import * as cls from "../ui/cls";
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
    <div className={cls.centeredScreen}>
      <form className={cls.loginCard} onSubmit={onSubmit}>
        <div className={cls.loginLang}>
          <LanguageSwitcher />
        </div>
        <div className={cls.loginBrand}>📦 {t("brand")}</div>
        <p className={cls.loginSub}>{t("login.subtitle")}</p>
        <label className={cls.field}>
          <span>{t("login.email")}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className={cls.field}>
          <span>{t("login.password")}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <div className={cls.errorBox}>{error}</div>}
        <Button type="submit" disabled={busy}>
          {busy ? t("login.signingIn") : t("login.signIn")}
        </Button>
        <div style={{ marginTop: 12, textAlign: "center", display: "flex", justifyContent: "space-between" }}>
          <Link to="/register" className={cls.plainLink} style={{ color: "var(--primary)" }}>
            {t("login.register")}
          </Link>
          <Link to="/forgot" className={cls.plainLink} style={{ color: "var(--muted)" }}>
            {t("login.forgot")}
          </Link>
        </div>
      </form>
    </div>
  );
}
