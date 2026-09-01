import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Box,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  Settings2,
  Sparkles,
  Star,
  Tags,
  Zap,
} from "lucide-react";

export const ADMIN_NAV_GROUPS = [
  {
    key: "ops",
    label: "Hari ini",
    tabIds: ["overview", "orders", "products"],
  },
  {
    key: "growth",
    label: "Growth",
    tabIds: ["promos", "flashsale", "testimonials"],
  },
  {
    key: "system",
    label: "Sistem",
    tabIds: ["settings"],
  },
];

export const MOBILE_PRIMARY_TAB_IDS = ["overview", "orders", "products", "promos"];
export const MOBILE_MORE_TAB_IDS = ["flashsale", "testimonials", "settings"];

const MOBILE_SHORT_LABELS = {
  overview: "Home",
  orders: "Order",
  products: "Produk",
  promos: "Promo",
};

const TAB_HINTS = {
  overview: "Apa yang perlu dikerjakan sekarang",
  orders: "Antrean bayar & proses",
  products: "Katalog & stok paket",
  promos: "Kode diskon aktif",
  flashsale: "Diskon kilat per varian",
  testimonials: "Bukti sosial di etalase",
  settings: "WA, QRIS, operasional",
};

function NavDot({ tone = "accent", children }) {
  if (!children) return null;
  return (
    <span className={`adm-navDot adm-navDot--${tone}`} aria-hidden="true">
      {children}
    </span>
  );
}

function getTabAlerts(tabId, ctx) {
  const alerts = [];
  if (tabId === "orders" && ctx.newOrderCount > 0) {
    alerts.push({ tone: "accent", value: ctx.newOrderCount > 9 ? "9+" : ctx.newOrderCount });
  }
  if (tabId === "products" && ctx.stockAlertCount > 0) {
    alerts.push({ tone: "warn", value: ctx.stockAlertCount > 9 ? "9+" : ctx.stockAlertCount });
  }
  if (tabId === "flashsale" && ctx.flashSaleEndingSoon) {
    alerts.push({ tone: "urgent", value: "!" });
  }
  return alerts;
}

function AdminNavItem({ tab, Icon, active, onSelect, alerts, hint }) {
  return (
    <button
      type="button"
      className={`adm-navItem${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(tab.id)}
      title={hint || tab.hint}
    >
      <span className="adm-navItemIcon">
        <Icon size={18} strokeWidth={2.15} />
        {alerts.map((a, i) => (
          <NavDot key={i} tone={a.tone}>
            {a.value}
          </NavDot>
        ))}
      </span>
      <span className="adm-navItemCopy">
        <span className="adm-navItemLabel">{tab.label}</span>
        <span className="adm-navItemHint">{hint || tab.hint}</span>
      </span>
    </button>
  );
}

export function AdminSidebar({
  tabs,
  activeTabId,
  onSelectTab,
  icons,
  greetingName = "Admin",
  todayOrders,
  todayRevenue,
  liveOrders = 0,
  newOrderCount,
  stockAlertCount,
  flashSaleEndingSoon,
  onRefresh,
  onLogout,
  syncLabel,
}) {
  const tabsById = useMemo(() => Object.fromEntries(tabs.map((t) => [t.id, t])), [tabs]);
  const alertCtx = { newOrderCount, stockAlertCount, flashSaleEndingSoon };

  const nextFocus = useMemo(() => {
    if (newOrderCount > 0) return { id: "orders", label: `${newOrderCount} order baru`, tone: "accent" };
    if (liveOrders > 0) return { id: "orders", label: `${liveOrders} order aktif`, tone: "accent" };
    if (stockAlertCount > 0) {
      return { id: "products", label: `${stockAlertCount} stok tipis`, tone: "warn", opts: { lowStock: true } };
    }
    if (flashSaleEndingSoon) return { id: "flashsale", label: "Flash sale hampir habis", tone: "urgent" };
    return { id: "overview", label: "Toko aman · pantau ringkasan", tone: "ok" };
  }, [newOrderCount, liveOrders, stockAlertCount, flashSaleEndingSoon]);

  const greetingHello = useMemo(() => {
    const name = String(greetingName || "Admin").trim() || "Admin";
    return `Halo, ${name}`;
  }, [greetingName]);

  return (
    <aside className="adm-sidebar" aria-label="Navigasi admin">
      <header className="adm-sidebarHead">
        <div className="adm-sidebarLogo" aria-hidden="true">
          IM
        </div>
        <div className="adm-sidebarBrand">
          <strong className="adm-sidebarGreeting">{greetingHello}</strong>
          <span>Command Center · imzaqi.store</span>
        </div>
      </header>

      <button
        type="button"
        className={`adm-nextFocus adm-nextFocus--${nextFocus.tone}`}
        onClick={() => onSelectTab(nextFocus.id, nextFocus.opts)}
      >
        <span className="adm-nextFocusLabel">Fokus sekarang</span>
        <strong>{nextFocus.label}</strong>
        <span className="adm-nextFocusCta">Buka →</span>
      </button>

      <div className="adm-sidebarStats" aria-label="Snapshot hari ini">
        <div className="adm-statPill">
          <span>Order hari ini</span>
          <strong>{todayOrders}</strong>
        </div>
        <div className="adm-statPill">
          <span>Omzet</span>
          <strong>{todayRevenue}</strong>
        </div>
      </div>

      <nav className="adm-sidebarNav">
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.key} className="adm-navGroup">
            <div className="adm-navGroupLabel">{group.label}</div>
            <div className="adm-navGroupItems">
              {group.tabIds.map((id) => {
                const tab = tabsById[id];
                if (!tab) return null;
                const Icon = icons[id] || Box;
                return (
                  <AdminNavItem
                    key={id}
                    tab={tab}
                    Icon={Icon}
                    active={activeTabId === id}
                    onSelect={onSelectTab}
                    alerts={getTabAlerts(id, alertCtx)}
                    hint={TAB_HINTS[id] || tab.hint}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <footer className="adm-sidebarFoot">
        {syncLabel ? <div className="adm-syncLabel">{syncLabel}</div> : null}
        <button className="adm-footBtn" type="button" onClick={onRefresh}>
          <RefreshCw size={16} />
          Sinkron data
        </button>
        <button className="adm-footBtn adm-footBtn--danger" type="button" onClick={onLogout}>
          <LogOut size={16} />
          Keluar
        </button>
      </footer>
    </aside>
  );
}

export function AdminMobileNav({
  tabs,
  activeTabId,
  onSelectTab,
  icons,
  newOrderCount,
  stockAlertCount,
  flashSaleEndingSoon,
  onRefresh,
  onLogout,
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const tabsById = useMemo(() => Object.fromEntries(tabs.map((t) => [t.id, t])), [tabs]);
  const alertCtx = { newOrderCount, stockAlertCount, flashSaleEndingSoon };
  const isMoreTabActive = MOBILE_MORE_TAB_IDS.includes(activeTabId);
  const moreAlertCount = MOBILE_MORE_TAB_IDS.reduce(
    (sum, id) => sum + (getTabAlerts(id, alertCtx).length > 0 ? 1 : 0),
    0
  );

  useEffect(() => {
    setMoreOpen(false);
  }, [activeTabId]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [moreOpen]);

  if (typeof document === "undefined") return null;

  function selectTab(id) {
    onSelectTab(id);
    setMoreOpen(false);
  }

  const primaryTabs = MOBILE_PRIMARY_TAB_IDS.map((id) => tabsById[id]).filter(Boolean);
  const moreTabs = MOBILE_MORE_TAB_IDS.map((id) => tabsById[id]).filter(Boolean);

  return createPortal(
    <>
      {moreOpen ? (
        <button
          type="button"
          className="adm-sheetBackdrop"
          aria-label="Tutup menu"
          onClick={() => setMoreOpen(false)}
        />
      ) : null}

      <div
        className={`adm-moreSheet${moreOpen ? " is-open" : ""}`}
        role="dialog"
        aria-modal={moreOpen ? "true" : undefined}
        aria-hidden={moreOpen ? undefined : "true"}
        aria-label="Menu lainnya"
      >
        <div className="adm-moreSheetGrab" aria-hidden="true" />
        <div className="adm-moreSheetHead">
          <strong>Lainnya</strong>
          <span>Flash sale, testimoni, pengaturan</span>
        </div>
        <div className="adm-moreSheetList">
          {moreTabs.map((tab) => {
            const Icon = icons[tab.id] || Box;
            const alerts = getTabAlerts(tab.id, alertCtx);
            return (
              <button
                key={tab.id}
                type="button"
                className={`adm-moreSheetItem${activeTabId === tab.id ? " is-active" : ""}`}
                onClick={() => selectTab(tab.id)}
              >
                <span className="adm-moreSheetIcon">
                  <Icon size={18} />
                  {alerts.map((a, i) => (
                    <NavDot key={i} tone={a.tone}>
                      {a.value}
                    </NavDot>
                  ))}
                </span>
                <span className="adm-moreSheetCopy">
                  <strong>{tab.label}</strong>
                  <small>{TAB_HINTS[tab.id] || tab.hint}</small>
                </span>
              </button>
            );
          })}
        </div>
        <div className="adm-moreSheetActions">
          <button
            className="adm-moreAction"
            type="button"
            onClick={() => {
              setMoreOpen(false);
              onRefresh();
            }}
          >
            <RefreshCw size={16} />
            Sinkron data
          </button>
          <button
            className="adm-moreAction adm-moreAction--danger"
            type="button"
            onClick={() => {
              setMoreOpen(false);
              onLogout();
            }}
          >
            <LogOut size={16} />
            Keluar
          </button>
        </div>
      </div>

      <nav className="adm-dock" aria-label="Navigasi admin mobile">
        {primaryTabs.map((tab) => {
          const Icon = icons[tab.id] || Box;
          const alerts = getTabAlerts(tab.id, alertCtx);
          const label = MOBILE_SHORT_LABELS[tab.id] || tab.label;
          return (
            <button
              key={tab.id}
              type="button"
              className={`adm-dockBtn${activeTabId === tab.id ? " is-active" : ""}`}
              aria-current={activeTabId === tab.id ? "page" : undefined}
              onClick={() => selectTab(tab.id)}
            >
              <span className="adm-dockIcon">
                <Icon size={20} strokeWidth={2.1} />
                {alerts.map((a, i) => (
                  <NavDot key={i} tone={a.tone}>
                    {a.value}
                  </NavDot>
                ))}
              </span>
              <span className="adm-dockLabel">{label}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={`adm-dockBtn${moreOpen || isMoreTabActive ? " is-active" : ""}`}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          onClick={() => setMoreOpen((v) => !v)}
        >
          <span className="adm-dockIcon">
            <MoreHorizontal size={20} strokeWidth={2.1} />
            {moreAlertCount > 0 ? <NavDot tone="accent">{moreAlertCount}</NavDot> : null}
          </span>
          <span className="adm-dockLabel">Lainnya</span>
        </button>
      </nav>
    </>,
    document.body
  );
}

// re-export icons map helper for dashboard if needed
export const ADMIN_NAV_ICONS_FALLBACK = {
  overview: LayoutDashboard,
  orders: ClipboardList,
  products: Box,
  promos: Tags,
  flashsale: Zap,
  testimonials: Star,
  settings: Settings2,
  sparkles: Sparkles,
};
