import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n";
import LanguageSwitcher from "./LanguageSwitcher";
import ChangePasswordModal from "./ChangePasswordModal";
import type { Role } from "../api/types";

interface NavItem {
  to: string;
  labelKey: string;
  end?: boolean;
  roles?: Role[]; // if set, only these roles (admin always sees everything)
  exclude?: Role[]; // these roles never see it
}

const NAV: NavItem[] = [
  { to: "/", labelKey: "nav.dashboard", end: true, exclude: ["agent"] },
  { to: "/orders", labelKey: "nav.orders" },
  { to: "/create", labelKey: "nav.create" },
  { to: "/products", labelKey: "nav.products" },
  { to: "/customers", labelKey: "nav.customers" },
  { to: "/agents", labelKey: "nav.agents", roles: ["manager"] },
  { to: "/invoices", labelKey: "nav.invoices" },
  { to: "/photos", labelKey: "nav.photos", roles: ["manager"] },
  { to: "/reports", labelKey: "nav.reports", exclude: ["agent"] },
  { to: "/accounts", labelKey: "nav.accounts", roles: [] }, // admin-only
  { to: "/activity", labelKey: "nav.activity", roles: [] }, // admin-only
  { to: "/topics", labelKey: "nav.topics", roles: [] }, // admin-only
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [showChangePw, setShowChangePw] = useState(false);
  const role = user?.role;
  const canSee = (item: NavItem) => {
    if (role && item.exclude?.includes(role)) return false;
    return !item.roles || role === "admin" || (role && item.roles.includes(role));
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">📦 {t("brand")}</div>
        <nav>
          {NAV.filter(canSee).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div />
          <div className="topbar-user">
            <LanguageSwitcher />
            <span className="user-name">{user?.full_name}</span>
            <span className="user-role">{user?.role}</span>
            <button
              className="btn btn-ghost"
              onClick={() => setShowChangePw(true)}
              title={t("common.changePassword")}
            >
              🔑
            </button>
            <button className="btn btn-ghost" onClick={logout}>
              {t("common.signOut")}
            </button>
          </div>
        </header>
        {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
