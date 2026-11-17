import React, { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Box,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Settings2,
  Megaphone,
  Star,
  Sun,
  Tags,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { useOptionalTheme } from "../../../context/ThemeContext";

export const ADMIN_NAV_GROUPS = [
  {
    key: "main",
    label: "Utama",
    tabIds: ["overview"],
  },
  {
    key: "ops",
    label: "Operasional",
    tabIds: ["orders", "products"],
  },
  {
    key: "growth",
    label: "Promosi & Konten",
    tabIds: ["promos", "flashsale", "marketing", "testimonials"],
  },
  {
    key: "system",
    label: "Sistem",
    tabIds: ["settings"],
  },
];

export const MOBILE_PRIMARY_TAB_IDS = ["overview", "orders", "products", "promos"];

const MOBILE_SHORT_LABELS = {
  overview: "Ringkasan",
  orders: "Pesanan",
  products: "Produk",
  promos: "Promo",
};

const TAB_HINTS = {
  overview: "Metrik & antrean",
  orders: "Daftar & proses pesanan",
  products: "Katalog, varian & stok",
  promos: "Kode diskon",
  flashsale: "Promo waktu terbatas",
  marketing: "Poster & brosur",
  testimonials: "Ulasan pelanggan",
  settings: "Kontak, QRIS & banner",
};

function getTabBadge(tabId, ctx) {
  if (tabId === "orders") {
    const count = ctx.newOrderCount > 0 ? ctx.newOrderCount : ctx.liveOrders;
    if (count > 0) {
      return {
        tone: ctx.newOrderCount > 0 ? "accent" : "neutral",
        value: count > 99 ? "99+" : String(count),
        label: ctx.newOrderCount > 0 ? `${count} pesanan baru` : `${count} perlu diproses`,
      };
    }
  }
  if (tabId === "products" && ctx.stockAlertCount > 0) {
    return {
      tone: "neutral",
      value: ctx.stockAlertCount > 99 ? "99+" : String(ctx.stockAlertCount),
      label: `${ctx.stockAlertCount} varian stok menipis`,
    };
  }
  if (tabId === "flashsale" && ctx.flashSaleEndingSoon) {
    return {
      tone: "accent",
      value: "!",
      label: "Flash sale hampir berakhir",
    };
  }
  return null;
}

function AdminNavItem({ tab, Icon, active, collapsed, onSelect, badge, hint }) {
  return (
    <button
      type="button"
      className={`adm-navItem${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(tab.id)}
      title={collapsed ? `${tab.label}${badge ? ` (${badge.value})` : ""} — ${hint}` : hint}
    >
      <span className="adm-navItemIcon" aria-hidden="true">
        <Icon size={18} strokeWidth={2} />
        {collapsed && badge ? (
          <span className={`adm-navDot adm-navDot--${badge.tone}`}>{badge.value}</span>
        ) : null}
      </span>
      <span className="adm-navItemCopy">
        <span className="adm-navItemLabel">{tab.label}</span>
      </span>
      {!collapsed && badge ? (
        <span className={`adm-navBadge adm-navBadge--${badge.tone}`} title={badge.label}>
          {badge.value}
        </span>
      ) : null}
    </button>
  );
}

export function AdminSidebar({
  tabs,
  activeTabId,
  onSelectTab,
  icons,
  greetingName = "Admin",
  adminEmail = "",
  todayOrders = 0,
  liveOrders = 0,
  newOrderCount = 0,
  stockAlertCount = 0,
  flashSaleEndingSoon = false,
  onLogout,
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
}) {
  const tabsById = useMemo(() => Object.fromEntries(tabs.map((t) => [t.id, t])), [tabs]);
  const alertCtx = { newOrderCount, liveOrders, stockAlertCount, flashSaleEndingSoon };
  const avatarInitial = String(greetingName || "A").trim().slice(0, 1).toUpperCase() || "A";

  useEffect(() => {
    if (!mobileOpen) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") onCloseMobile?.();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen, onCloseMobile]);

  function handleNavClick(id) {
    onSelectTab(id);
    onCloseMobile?.();
  }

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="adm-drawerBackdrop"
          aria-label="Tutup menu sidebar"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        className={`adm-sidebar${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}
        aria-label="Navigasi admin"
      >
        <header className="adm-sidebarHead">
          <div className="adm-sidebarBrandWrap">
            <div className="adm-sidebarLogo" aria-hidden="true">
              IM
            </div>
            {!collapsed ? (
              <div className="adm-sidebarBrand">
                <strong className="adm-sidebarGreeting">Imzaqi Store</strong>
                <span className="adm-sidebarRole">Admin Panel</span>
              </div>
            ) : null}
          </div>

          {onToggleCollapse ? (
            <button
              type="button"
              className="adm-sidebarCollapseBtn adm-desktopToggle"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
              title={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
            >
              {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
          ) : null}

          {onCloseMobile ? (
            <button
              type="button"
              className="adm-sidebarCollapseBtn adm-mobileDrawerClose"
              onClick={onCloseMobile}
              aria-label="Tutup sidebar"
            >
              <X size={18} />
            </button>
          ) : null}
        </header>

        {!collapsed ? (
          <div className="adm-sidebarStats" aria-label="Status operasional singkat">
            <div className="adm-statPill">
              <span>Perlu Aksi</span>
              <strong>{liveOrders}</strong>
            </div>
            <div className="adm-statPill">
              <span>Order Hari Ini</span>
              <strong>{todayOrders}</strong>
            </div>
          </div>
        ) : null}

        <nav className="adm-sidebarNav">
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.key} className="adm-navGroup">
              {!collapsed ? (
                <div className="adm-navGroupLabel">{group.label}</div>
              ) : (
                <div className="adm-navGroupDivider" aria-hidden="true" />
              )}
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
                      collapsed={collapsed}
                      onSelect={handleNavClick}
                      badge={getTabBadge(id, alertCtx)}
                      hint={TAB_HINTS[id] || tab.hint}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <footer className="adm-sidebarFoot">
          {!collapsed ? (
            <div className="adm-profileCard">
              <div className="adm-profileAvatar" aria-hidden="true">
                {avatarInitial}
              </div>
              <div className="adm-profileCopy">
                <strong>{greetingName}</strong>
                {adminEmail ? <span title={adminEmail}>{adminEmail}</span> : <span>Administrator</span>}
              </div>
            </div>
          ) : null}

          <div className="adm-sidebarFootActions">
            <a
              className="adm-footBtn"
              href="/"
              target="_blank"
              rel="noreferrer"
              title="Buka halaman toko"
            >
              <ExternalLink size={15} aria-hidden="true" />
              {!collapsed ? <span>Lihat Toko</span> : null}
            </a>

            <button
              className="adm-footBtn adm-footBtn--danger"
              type="button"
              onClick={onLogout}
              title="Keluar dari admin"
            >
              <LogOut size={15} aria-hidden="true" />
              {!collapsed ? <span>Keluar</span> : null}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}

export function AdminTopbar({
  activeTab,
  loading = false,
  syncLabel = "",
  soundEnabled = true,
  onToggleSound,
  onRefresh,
  collapsed = false,
  onToggleCollapse,
  onOpenMobileMenu,
}) {
  const themeCtx = useOptionalTheme();
  const isDark = themeCtx?.isDark ?? false;

  return (
    <header className="adm-topbar" aria-label="Header panel admin">
      <div className="adm-topbarLeft">
        <button
          type="button"
          className="adm-topbarIconBtn adm-mobileMenuBtn"
          onClick={onOpenMobileMenu}
          aria-label="Buka menu navigasi"
        >
          <Menu size={18} aria-hidden="true" />
        </button>

        {onToggleCollapse ? (
          <button
            type="button"
            className="adm-topbarIconBtn adm-desktopMenuBtn"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
            title={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
          </button>
        ) : null}

        <div className="adm-topbarTitleGroup">
          <div className="adm-breadcrumb" aria-label="Breadcrumb">
            <span>Admin</span>
            <ChevronRight size={13} aria-hidden="true" />
            <strong>{activeTab?.label || "Ringkasan"}</strong>
          </div>
          {activeTab?.hint ? <span className="adm-topbarSub">{activeTab.hint}</span> : null}
        </div>
      </div>

      <div className="adm-topbarRight">
        {syncLabel ? (
          <span className="adm-topbarSync" title={syncLabel}>
            <span className="adm-liveSyncDot" aria-hidden="true" />
            <span>{syncLabel}</span>
          </span>
        ) : null}

        <button
          type="button"
          className="adm-topbarBtn"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Sinkronisasi data"
          title="Muat ulang semua data"
        >
          <RefreshCw size={15} className={loading ? "adm-spin" : ""} aria-hidden="true" />
          <span className="adm-topbarBtnLabel">Sinkron</span>
        </button>

        {onToggleSound ? (
          <button
            type="button"
            className={`adm-topbarIconBtn${soundEnabled ? " is-active" : ""}`}
            onClick={onToggleSound}
            aria-label={soundEnabled ? "Matikan suara notifikasi order" : "Aktifkan suara notifikasi order"}
            title={soundEnabled ? "Suara notifikasi aktif" : "Suara notifikasi senyap"}
          >
            {soundEnabled ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
          </button>
        ) : null}

        {themeCtx?.toggleTheme ? (
          <button
            type="button"
            className="adm-topbarIconBtn"
            onClick={themeCtx.toggleTheme}
            aria-label={isDark ? "Ubah ke tema terang" : "Ubah ke tema gelap"}
            title={isDark ? "Tema terang" : "Tema gelap"}
          >
            {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
          </button>
        ) : null}

        <a
          className="adm-topbarBtn adm-topbarStoreLink"
          href="/"
          target="_blank"
          rel="noreferrer"
          title="Buka storefront di tab baru"
        >
          <span>Toko</span>
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}

export function AdminMobileNav({
  tabs,
  activeTabId,
  onSelectTab,
  icons,
  liveOrders = 0,
  newOrderCount = 0,
  stockAlertCount = 0,
  flashSaleEndingSoon = false,
  onOpenDrawer,
}) {
  const tabsById = useMemo(() => Object.fromEntries(tabs.map((t) => [t.id, t])), [tabs]);
  const alertCtx = { newOrderCount, liveOrders, stockAlertCount, flashSaleEndingSoon };
  const primaryTabs = MOBILE_PRIMARY_TAB_IDS.map((id) => tabsById[id]).filter(Boolean);
  const hasSecondaryActive = !MOBILE_PRIMARY_TAB_IDS.includes(activeTabId);

  if (typeof document === "undefined") return null;

  return createPortal(
    <nav className="adm-dock" aria-label="Navigasi cepat mobile">
      {primaryTabs.map((tab) => {
        const Icon = icons[tab.id] || Box;
        const badge = getTabBadge(tab.id, alertCtx);
        const label = MOBILE_SHORT_LABELS[tab.id] || tab.label;
        return (
          <button
            key={tab.id}
            type="button"
            className={`adm-dockBtn${activeTabId === tab.id ? " is-active" : ""}`}
            aria-current={activeTabId === tab.id ? "page" : undefined}
            onClick={() => onSelectTab(tab.id)}
          >
            <span className="adm-dockIcon">
              <Icon size={19} strokeWidth={2} />
              {badge ? <span className={`adm-navDot adm-navDot--${badge.tone}`}>{badge.value}</span> : null}
            </span>
            <span className="adm-dockLabel">{label}</span>
          </button>
        );
      })}
      <button
        type="button"
        className={`adm-dockBtn${hasSecondaryActive ? " is-active" : ""}`}
        onClick={onOpenDrawer}
        aria-label="Buka semua menu admin"
      >
        <span className="adm-dockIcon">
          <Menu size={19} strokeWidth={2} />
          {flashSaleEndingSoon ? <span className="adm-navDot adm-navDot--urgent">!</span> : null}
        </span>
        <span className="adm-dockLabel">Menu</span>
      </button>
    </nav>,
    document.body
  );
}

export const ADMIN_NAV_ICONS_FALLBACK = {
  overview: LayoutDashboard,
  orders: ClipboardList,
  products: Box,
  promos: Tags,
  flashsale: Zap,
  marketing: Megaphone,
  testimonials: Star,
  settings: Settings2,
};
