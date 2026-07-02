import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n";
import LanguageSwitcher from "./LanguageSwitcher";
import ChangePasswordModal from "./ChangePasswordModal";
import type { Role } from "../api/types";
import * as cls from "../ui/cls";

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
  { to: "/orders/new", labelKey: "nav.createOrder" },
  { to: "/refunds", labelKey: "nav.refunds", roles: ["manager", "accountant"] },
  { to: "/order-history", labelKey: "nav.history", roles: ["manager", "accountant"] },
  { to: "/create", labelKey: "nav.create" },
  { to: "/products", labelKey: "nav.products" },
  { to: "/customers", labelKey: "nav.customers" },
  { to: "/agents", labelKey: "nav.agents", roles: ["manager"] },
  { to: "/invoices", labelKey: "nav.invoices" },
  { to: "/cash", labelKey: "nav.cash", roles: ["manager", "accountant"] },
  { to: "/photos", labelKey: "nav.photos", roles: ["manager"] },
  { to: "/reports", labelKey: "nav.reports", exclude: ["agent"] },
  { to: "/accounts", labelKey: "nav.accounts", roles: [] }, // admin-only
  { to: "/activity", labelKey: "nav.activity", roles: [] }, // admin-only
  { to: "/branding", labelKey: "nav.branding", roles: [] }, // admin-only
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
    <div className={cls.appShell}>
      <aside className={cls.sidebar}>
        <div className={cls.brand}>📦 {t("brand")}</div>
        <nav>
          {NAV.filter(canSee).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cls.cx(cls.navLink, isActive && cls.navLinkActive)
              }
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className={cls.main}>
        <header className={cls.topbar}>
          <div />
          <div className={cls.topbarUser}>
            <LanguageSwitcher />
            <span className={cls.userName}>{user?.full_name}</span>
            <span className={cls.userRole}>{user?.role}</span>
            <button
              className={cls.btn.ghost}
              onClick={() => setShowChangePw(true)}
              title={t("common.changePassword")}
            >
              🔑
            </button>
            <button className={cls.btn.ghost} onClick={logout}>
              {t("common.signOut")}
            </button>
          </div>
        </header>
        {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
        <main className={cls.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
