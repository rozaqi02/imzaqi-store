import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Box, LogOut, MoreHorizontal, RefreshCw } from "lucide-react";
import "../../../css/pages/AdminNav.css";

export const ADMIN_NAV_GROUPS = [
  { key: "ops", label: "Operasional", tabIds: ["overview", "orders", "products"] },
  { key: "promo", label: "Promosi", tabIds: ["promos", "flashsale", "testimonials"] },
  { key: "system", label: "Sistem", tabIds: ["settings"] },
];

export const MOBILE_PRIMARY_TAB_IDS = ["overview", "orders", "products"];
export const MOBILE_MORE_TAB_IDS = ["promos", "flashsale", "testimonials", "settings"];

const MOBILE_SHORT_LABELS = {
  overview: "Beranda",
  orders: "Order",
  products: "Produk",
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

function AdminNavItem({ tab, Icon, active, onSelect, alerts }) {
  return (
    <button
      type="button"
      className={`adm-navItem${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(tab.id)}
    >
      <span className="adm-navItemIcon">
        <Icon size={18} strokeWidth={2.1} />
        {alerts.map((a, i) => (
          <NavDot key={i} tone={a.tone}>
            {a.value}
          </NavDot>
        ))}
      </span>
      <span className="adm-navItemLabel">{tab.label}</span>
    </button>
  );
}

export function AdminSidebar({
  tabs,
  activeTabId,
  onSelectTab,
  icons,
  todayOrders,
  todayRevenue,
  newOrderCount,
  stockAlertCount,
  flashSaleEndingSoon,
  onRefresh,
  onLogout,
}) {
  const tabsById = useMemo(() => Object.fromEntries(tabs.map((t) => [t.id, t])), [tabs]);
  const alertCtx = { newOrderCount, stockAlertCount, flashSaleEndingSoon };

  return (
    <aside className="adm-sidebar" aria-label="Navigasi admin">
      <header className="adm-sidebarHead">
        <div className="adm-sidebarLogo">IM</div>
        <div className="adm-sidebarBrand">
          <strong>Admin</strong>
          <span>imzaqi.store</span>
        </div>
      </header>

      <div className="adm-sidebarStats" aria-label="Ringkasan hari ini">
        <div className="adm-statPill">
          <span>Order</span>
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
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <footer className="adm-sidebarFoot">
        <button className="adm-footBtn" type="button" onClick={onRefresh}>
          <RefreshCw size={16} />
          Muat ulang
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
        <div className="adm-moreSheetHead">
          <strong>Menu lainnya</strong>
          <span>Promo, flash sale, testimoni, pengaturan</span>
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
                  <small>{tab.hint}</small>
                </span>
              </button>
            );
          })}
        </div>
        <div className="adm-moreSheetActions">
          <button className="adm-moreAction" type="button" onClick={() => { setMoreOpen(false); onRefresh(); }}>
            <RefreshCw size={16} />
            Muat ulang data
          </button>
          <button className="adm-moreAction adm-moreAction--danger" type="button" onClick={() => { setMoreOpen(false); onLogout(); }}>
            <LogOut size={16} />
            Keluar admin
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
          <span className="adm-dockLabel">Menu</span>
        </button>
      </nav>
    </>,
    document.body
  );
}