import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "../../../context/ThemeContext";
import {
  ADMIN_NAV_ICONS_FALLBACK,
  AdminMobileNav,
  AdminSidebar,
  AdminTopbar,
} from "./AdminNav";

const TABS = [
  { id: "overview", label: "Ringkasan", hint: "Metrik & antrean" },
  { id: "orders", label: "Pesanan", hint: "Daftar & proses pesanan" },
  { id: "products", label: "Produk", hint: "Katalog, varian & stok" },
  { id: "promos", label: "Promo", hint: "Kode voucher" },
  { id: "flashsale", label: "Flash Sale", hint: "Diskon kilat" },
  { id: "marketing", label: "Media Promosi", hint: "Poster & brosur" },
  { id: "testimonials", label: "Testimoni", hint: "Ulasan toko" },
  { id: "settings", label: "Pengaturan", hint: "Sistem & toko" },
];

describe("AdminNav (Laravel/CI Shell)", () => {
  it("renders grouped left sidebar with badges, live stats, and collapses cleanly", () => {
    const onSelectTab = vi.fn();
    const onToggleCollapse = vi.fn();
    const onLogout = vi.fn();

    const { container, rerender } = render(
      <AdminSidebar
        tabs={TABS}
        activeTabId="overview"
        onSelectTab={onSelectTab}
        icons={ADMIN_NAV_ICONS_FALLBACK}
        greetingName="Bos Zaqi"
        adminEmail="rojaki@imzaqi.store"
        todayOrders={12}
        liveOrders={4}
        newOrderCount={2}
        stockAlertCount={3}
        flashSaleEndingSoon
        onLogout={onLogout}
        collapsed={false}
        onToggleCollapse={onToggleCollapse}
      />
    );

    expect(screen.getByText("Utama")).toBeTruthy();
    expect(screen.getByText("Operasional")).toBeTruthy();
    expect(screen.getByText("Promosi & Konten")).toBeTruthy();
    expect(screen.getByText("Sistem")).toBeTruthy();
    expect(screen.getByText("Bos Zaqi")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("!")).toBeTruthy();

    fireEvent.click(screen.getByText("Pesanan").closest("button"));
    expect(onSelectTab).toHaveBeenCalledWith("orders");

    fireEvent.click(screen.getByRole("button", { name: "Ciutkan sidebar" }));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);

    rerender(
      <AdminSidebar
        tabs={TABS}
        activeTabId="overview"
        onSelectTab={onSelectTab}
        icons={ADMIN_NAV_ICONS_FALLBACK}
        greetingName="Bos Zaqi"
        liveOrders={4}
        newOrderCount={2}
        stockAlertCount={3}
        onLogout={onLogout}
        collapsed
        onToggleCollapse={onToggleCollapse}
      />
    );
    expect(container.querySelector(".adm-sidebar.is-collapsed")).not.toBeNull();

    fireEvent.click(screen.getByTitle("Keluar dari admin"));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("renders persistent topbar with breadcrumb, refresh, sound toggle, and theme switcher", () => {
    localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const onRefresh = vi.fn();
    const onToggleSound = vi.fn();
    const onOpenMobileMenu = vi.fn();

    render(
      <ThemeProvider>
        <AdminTopbar
          activeTab={TABS[1]}
          loading={false}
          syncLabel="Sinkron 21.50"
          soundEnabled
          onToggleSound={onToggleSound}
          onRefresh={onRefresh}
          onOpenMobileMenu={onOpenMobileMenu}
        />
      </ThemeProvider>
    );

    expect(screen.getByText("Admin")).toBeTruthy();
    expect(screen.getByText("Pesanan")).toBeTruthy();
    expect(screen.getByText("Sinkron 21.50")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Sinkronisasi data" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Matikan suara notifikasi order" }));
    expect(onToggleSound).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Ubah ke tema gelap" }));
    expect(document.documentElement.dataset.theme).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "Buka menu navigasi" }));
    expect(onOpenMobileMenu).toHaveBeenCalledTimes(1);
  });

  it("opens full sidebar drawer when mobile Menu button is clicked", () => {
    const onSelectTab = vi.fn();
    const onOpenDrawer = vi.fn();

    render(
      <AdminMobileNav
        tabs={TABS}
        activeTabId="settings"
        onSelectTab={onSelectTab}
        icons={ADMIN_NAV_ICONS_FALLBACK}
        liveOrders={2}
        onOpenDrawer={onOpenDrawer}
      />
    );

    const menuBtn = screen.getByRole("button", { name: "Buka semua menu admin" });
    expect(menuBtn.classList.contains("is-active")).toBe(true);
    fireEvent.click(menuBtn);
    expect(onOpenDrawer).toHaveBeenCalledTimes(1);
  });
});
