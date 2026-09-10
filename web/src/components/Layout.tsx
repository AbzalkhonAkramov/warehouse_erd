import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n";
import { getCompany } from "../api/endpoints";
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

interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

// Small dependency-free icon wrapper (inherits currentColor, sized via cls.navIcon).
const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const ICONS: Record<string, ReactNode> = {
  "/": svg(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>),
  "/orders": svg(<><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h6" /></>),
  "/orders/new": svg(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 9v6M9 12h6" /></>),
  "/returns": svg(<><path d="M3 7v6h6" /><path d="M3.5 13a9 9 0 1 0 2-8.5L3 7" /></>),
  "/refunds": svg(<><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 5 5v2" /></>),
  "/order-history": svg(<><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></>),
  "/create": svg(<><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>),
  "/products": svg(<><path d="m21 8-9 4-9-4 9-4 9 4Z" /><path d="M3 8v8l9 4 9-4V8" /><path d="m12 12v8" /></>),
  "/customers": svg(<><path d="M3 9 4 4h16l1 5" /><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" /><path d="M4 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></>),
  "/agents": svg(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>),
  "/invoices": svg(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></>),
  "/cash": svg(<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>),
  "/photos": svg(<><path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4Z" /><circle cx="12" cy="13" r="3.5" /></>),
  "/reports": svg(<><path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="6" /><rect x="12" y="7" width="3" height="10" /><rect x="17" y="13" width="3" height="4" /></>),
  "/accounts": svg(<><path d="M12 3 4 6v5c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6Z" /><path d="m9 12 2 2 4-4" /></>),
  "/activity": svg(<><path d="M22 12h-4l-3 8-6-16-3 8H2" /></>),
  "/branding": svg(<><circle cx="12" cy="12" r="9" /><circle cx="8" cy="10" r="1" /><circle cx="12" cy="8" r="1" /><circle cx="16" cy="10" r="1" /><path d="M12 21a3 3 0 0 1 0-6 2 2 0 0 0 2-2c0-1 1-1 2-1" /></>),
  "/topics": svg(<><path d="M21 11.5a8.38 8.38 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.38 8.38 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" /></>),
  "/currencies": svg(<><circle cx="12" cy="12" r="9" /><path d="M14.5 9.5a2.5 2 0 0 0-2.5-1.5c-1.4 0-2.5.7-2.5 1.8 0 2.4 5 1.2 5 3.6 0 1.1-1.1 1.8-2.5 1.8a2.5 2 0 0 1-2.5-1.5M12 6.5v11" /></>),
};

// Same routes and labels as before — grouped for scannability only.
const GROUPS: NavGroup[] = [
  {
    labelKey: "nav.group.overview",
    items: [{ to: "/", labelKey: "nav.dashboard", end: true, exclude: ["agent"] }],
  },
  {
    labelKey: "nav.group.sales",
    items: [
      { to: "/orders", labelKey: "nav.orders" },
      { to: "/orders/new", labelKey: "nav.createOrder" },
      { to: "/returns", labelKey: "nav.returns", roles: ["manager", "accountant"] },
      { to: "/refunds", labelKey: "nav.refunds", roles: ["manager", "accountant"] },
      { to: "/order-history", labelKey: "nav.history", roles: ["manager", "accountant"] },
    ],
  },
  {
    labelKey: "nav.group.catalog",
    items: [
      { to: "/create", labelKey: "nav.create" },
      { to: "/products", labelKey: "nav.products" },
    ],
  },
  {
    labelKey: "nav.group.people",
    items: [
      { to: "/customers", labelKey: "nav.customers" },
      { to: "/agents", labelKey: "nav.agents", roles: ["manager"] },
    ],
  },
  {
    labelKey: "nav.group.finance",
    items: [
      { to: "/invoices", labelKey: "nav.invoices" },
      { to: "/cash", labelKey: "nav.cash", roles: ["manager", "accountant"] },
    ],
  },
  {
    labelKey: "nav.group.insights",
    items: [
      { to: "/reports", labelKey: "nav.reports", exclude: ["agent"] },
      { to: "/photos", labelKey: "nav.photos", roles: ["manager"] },
    ],
  },
  {
    labelKey: "nav.group.admin",
    items: [
      { to: "/currencies", labelKey: "nav.currencies", roles: [] }, // admin-only
      { to: "/accounts", labelKey: "nav.accounts", roles: [] }, // admin-only
      { to: "/activity", labelKey: "nav.activity", roles: [] }, // admin-only
      { to: "/branding", labelKey: "nav.branding", roles: [] }, // admin-only
      { to: "/topics", labelKey: "nav.topics", roles: [] }, // admin-only
    ],
  },
];

const ALL_ITEMS: NavItem[] = GROUPS.flatMap((g) => g.items);

/** Longest-prefix match of the current path to a nav item (for the topbar title). */
function activeLabelKey(pathname: string): string | undefined {
  return ALL_ITEMS.filter((i) =>
    i.to === "/" ? pathname === "/" : pathname === i.to || pathname.startsWith(i.to + "/"),
  ).sort((a, b) => b.to.length - a.to.length)[0]?.labelKey;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const [showChangePw, setShowChangePw] = useState(false);
  const role = user?.role;
  const canSee = (item: NavItem) => {
    if (role && item.exclude?.includes(role)) return false;
    return !item.roles || role === "admin" || (role && item.roles.includes(role));
  };

  // Surface the real brand from the branding settings; 📦 + name is the fallback.
  const company = useQuery({ queryKey: ["company"], queryFn: getCompany });
  const mode = company.data?.display_mode ?? "both";
  const logoUrl = company.data?.logo_url ?? null;
  const brandName = company.data?.name || t("brand");
  const showLogo = mode !== "text";
  const showName = mode !== "logo" || !logoUrl;

  const titleKey = activeLabelKey(location.pathname);

  return (
    <div className={cls.appShell}>
      <aside className={cls.sidebar}>
        <div className={cls.brand}>
          {showLogo &&
            (logoUrl ? (
              <img src={logoUrl} alt="" className={cls.brandLogo} />
            ) : (
              <span className="text-lg leading-none">📦</span>
            ))}
          {showName && <span className={cls.brandName}>{brandName}</span>}
        </div>
        <nav>
          {GROUPS.map((group) => {
            const items = group.items.filter(canSee);
            if (items.length === 0) return null;
            return (
              <div key={group.labelKey} className={cls.navGroup}>
                <div className={cls.navGroupLabel}>{t(group.labelKey)}</div>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cls.cx(cls.navLink, isActive && cls.navLinkActive)
                    }
                  >
                    <span className={cls.navIcon}>{ICONS[item.to]}</span>
                    {t(item.labelKey)}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className={cls.main}>
        <header className={cls.topbar}>
          <div className={cls.topbarTitle}>{titleKey ? t(titleKey) : ""}</div>
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
