import React, { useRef, useState } from "react";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StorefrontPromotionSettings from "./StorefrontPromotionSettings";
import { upsertSetting } from "../../../lib/api";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("../../../context/ToastContext", () => ({ useToast: () => toast }));
vi.mock("../../../lib/api", () => ({ upsertSetting: vi.fn() }));
const products = [
  { id: "n", name: "Netflix", slug: "netflix", icon_url: "/netflix.png", is_active: true, category: "streaming", description: "Nonton film favoritmu.", product_variants: [{ id: "v", price_idr: 31000, stock: 5 }] },
  { id: "c", name: "Canva", slug: "canva", icon_url: "/canva.png", category: "design", product_variants: [{ price_idr: 5000, stock: 5 }] },
];
beforeEach(() => { vi.clearAllMocks(); upsertSetting.mockResolvedValue(); });
afterEach(cleanup);
const choose = (label, name) => {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(screen.getByRole("option", { name: new RegExp(name) }));
};
function Host() {
  const [settings, setSettings] = useState({});
  return <StorefrontPromotionSettings products={products} settings={settings} onSaved={(key, value) => setSettings(current => ({ ...current, [key]: value }))}/>;
}

describe("storefront promotion setup", () => {
  it("starts disabled, requires a product to publish, and fills a real preview automatically", async () => {
    render(<Host/>);
    for (const toggle of screen.getAllByRole("switch")) expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("switch", { name: "Aktifkan pop-up produk baru" }));
    expect(screen.getByRole("button", { name: "Simpan pop-up produk baru" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Pilih produk aktif/);
    choose("Produk untuk pop-up", "Netflix");
    const preview = screen.getByRole("complementary", { name: "Pratinjau pop-up produk baru" });
    expect(within(preview).getByRole("img", { name: "Netflix" })).toHaveAttribute("src", "/netflix.png");
    expect(within(preview).getByRole("heading", { name: "Baru hadir: Netflix" })).toBeInTheDocument();
    expect(within(preview).getByText(/31.000/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Simpan pop-up produk baru" }));
    await waitFor(() => expect(upsertSetting).toHaveBeenCalledWith("new_product_popup", expect.objectContaining({ enabled: true, product_id: "n", title: "", link: "", show_on: "home" })));
    await waitFor(() => expect(screen.getByRole("button", { name: "Simpan pop-up produk baru" })).toBeDisabled());
    expect(upsertSetting).toHaveBeenCalledTimes(1);
  });
  it("saving flash sale preserves a different announcement's unsaved draft", async () => {
    render(<Host/>);
    fireEvent.change(screen.getByLabelText("Pesan pengumuman"), { target: { value: "Promo akhir pekan!" } });
    fireEvent.click(screen.getByRole("switch", { name: "Aktifkan pop-up flash sale" }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan flash sale" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(screen.getByLabelText("Pesan pengumuman")).toHaveValue("Promo akhir pekan!");
    expect(screen.getByRole("button", { name: "Simpan banner" })).toBeEnabled();
    expect(upsertSetting).toHaveBeenCalledWith("flash_sale_popup", { enabled: true });
    expect(screen.getByRole("switch", { name: "Aktifkan pop-up jasa akademik" })).toHaveAttribute("aria-checked", "false");
  });
  it("keeps a failed save editable, prevents duplicate requests, and can retry", async () => {
    let rejectSave;
    upsertSetting.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectSave = reject; }));
    render(<Host/>);
    fireEvent.click(screen.getByRole("switch", { name: "Aktifkan pop-up flash sale" }));
    const save = screen.getByRole("button", { name: "Simpan flash sale" });
    fireEvent.click(save); fireEvent.click(save);
    expect(upsertSetting).toHaveBeenCalledTimes(1);
    expect(save).toBeDisabled();
    rejectSave(new Error("offline"));
    await waitFor(() => expect(screen.getByText(/Isianmu tetap aman/)).toBeInTheDocument());
    expect(screen.getByRole("switch", { name: "Aktifkan pop-up flash sale" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(save);
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(upsertSetting).toHaveBeenCalledTimes(2);
  });
  it("blocks invalid destinations when publishing but always allows turning a popup off", async () => {
    render(<StorefrontPromotionSettings products={products} settings={{ new_product_popup: { enabled: true, product_id: "n", link: "javascript:alert(1)" } }}/>);
    expect(screen.getByRole("button", { name: "Simpan pop-up produk baru" })).toBeDisabled();
    fireEvent.click(screen.getByRole("switch", { name: "Aktifkan pop-up produk baru" }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan pop-up produk baru" }));
    await waitFor(() => expect(upsertSetting).toHaveBeenCalledWith("new_product_popup", expect.objectContaining({ enabled: false })));
  });
  it("creates a product banner with live color preview and resets changes independently", () => {
    render(<Host/>);
    choose("Produk untuk banner", "Canva");
    const preview = screen.getByRole("complementary", { name: "Pratinjau banner" });
    expect(within(preview).getByText("Canva sekarang tersedia. Lihat paketnya!")).toBeInTheDocument();
    expect(within(preview).getByText("/produk/canva")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kuning" }));
    expect(within(preview).getByText("Canva sekarang tersedia. Lihat paketnya!").closest(".promo-ticker")).toHaveClass("promo-ticker--color-yellow");
    fireEvent.change(screen.getByLabelText("Pesan pengumuman"), { target: { value: "Pesan khusus" } });
    fireEvent.click(screen.getByRole("button", { name: "Batalkan perubahan banner" }));
    expect(screen.getByLabelText("Pesan pengumuman")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Simpan banner" })).toBeDisabled();
  });
  it("changing products updates automatic copy without discarding custom copy", () => {
    render(<Host/>);
    choose("Produk untuk pop-up", "Netflix");
    choose("Produk untuk pop-up", "Canva");
    expect(screen.getByRole("heading", { name: "Baru hadir: Canva" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Sesuaikan teks & tombol"));
    fireEvent.change(screen.getByLabelText("Judul"), { target: { value: "Khusus minggu ini" } });
    choose("Produk untuk pop-up", "Netflix");
    expect(screen.getByRole("heading", { name: "Khusus minggu ini" })).toBeInTheDocument();
  });
  it("preserves drafts while visiting a linked admin menu and returning to settings", () => {
    function NavigationHost() {
      const draftCache = useRef({});
      const [page, setPage] = useState("settings");
      return page === "settings"
        ? <StorefrontPromotionSettings products={products} draftCache={draftCache} onManageFlashSales={() => setPage("flashsale")}/>
        : <button type="button" onClick={() => setPage("settings")}>Kembali ke pengaturan</button>;
    }
    render(<NavigationHost/>);
    fireEvent.change(screen.getByLabelText("Pesan pengumuman"), { target: { value: "Pesan belum disimpan" } });
    fireEvent.click(screen.getByRole("button", { name: "Kelola flash sale →" }));
    fireEvent.click(screen.getByRole("button", { name: "Kembali ke pengaturan" }));
    expect(screen.getByLabelText("Pesan pengumuman")).toHaveValue("Pesan belum disimpan");
    expect(screen.getByRole("button", { name: "Simpan banner" })).toBeEnabled();
  });
});
