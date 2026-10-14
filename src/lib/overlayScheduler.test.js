// Kontrak scheduler overlay dikunci di sini agar urutan popup tidak berubah
// diam-diam saat komponen direfactor. Lihat komentar di overlayScheduler.js.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OVERLAY_PRIORITY,
  getActiveOverlayId,
  isOverlayBusy,
  isOverlaySlotActive,
  releaseOverlaySlot,
  requestOverlaySlot,
  subscribeOverlays,
} from "./overlayScheduler";

// Scheduler adalah singleton level modul, jadi state-nya wajib dibersihkan
// agar tidak bocor antar test.
const KNOWN_IDS = ["flashSalePopup", "newProductPopup", "academicPopup", "mysteryOverlay"];

function resetScheduler() {
  KNOWN_IDS.forEach((id) => releaseOverlaySlot(id));
}

describe("overlayScheduler", () => {
  beforeEach(resetScheduler);
  afterEach(() => {
    resetScheduler();
    vi.restoreAllMocks();
  });

  it("menjaga urutan prioritas publik: flash sale > new product > academic", () => {
    expect(OVERLAY_PRIORITY.flashSalePopup).toBeGreaterThan(OVERLAY_PRIORITY.newProductPopup);
    expect(OVERLAY_PRIORITY.newProductPopup).toBeGreaterThan(OVERLAY_PRIORITY.academicPopup);
  });

  it("hanya memberi satu slot eksklusif pada satu waktu", () => {
    requestOverlaySlot("academicPopup", { ready: true });
    requestOverlaySlot("flashSalePopup", { ready: true });

    expect(getActiveOverlayId()).toBe("academicPopup");
    expect(isOverlaySlotActive("academicPopup")).toBe(true);
    expect(isOverlaySlotActive("flashSalePopup")).toBe(false);
  });

  it("bersifat sticky: overlay prioritas lebih tinggi tidak merebut yang sedang tampil", () => {
    // Sengaja: merebut overlay yang sudah tampil menghasilkan kedip yang
    // membingungkan pengguna, jadi pemenang dipertahankan sampai ia selesai.
    requestOverlaySlot("academicPopup", { ready: true });
    requestOverlaySlot("newProductPopup", { ready: true });
    requestOverlaySlot("flashSalePopup", { ready: true });

    expect(getActiveOverlayId()).toBe("academicPopup");
  });

  it("menggilir sesuai prioritas setiap kali slot dilepas", () => {
    requestOverlaySlot("academicPopup", { ready: true });
    requestOverlaySlot("newProductPopup", { ready: true });
    requestOverlaySlot("flashSalePopup", { ready: true });

    releaseOverlaySlot("academicPopup");
    expect(getActiveOverlayId()).toBe("flashSalePopup");

    releaseOverlaySlot("flashSalePopup");
    expect(getActiveOverlayId()).toBe("newProductPopup");

    releaseOverlaySlot("newProductPopup");
    expect(getActiveOverlayId()).toBeNull();
  });

  it("tidak pernah memberi slot kepada kandidat yang belum ready", () => {
    requestOverlaySlot("flashSalePopup", { ready: false });
    expect(getActiveOverlayId()).toBeNull();
    expect(isOverlayBusy()).toBe(false);

    requestOverlaySlot("flashSalePopup", { ready: true });
    expect(getActiveOverlayId()).toBe("flashSalePopup");

    // Turun kembali ke not-ready harus melepas slot agar kandidat lain naik.
    requestOverlaySlot("flashSalePopup", { ready: false });
    expect(getActiveOverlayId()).toBeNull();
  });

  it("memakai priority 0 untuk overlay tak dikenal sehingga kalah dari yang terdaftar", () => {
    requestOverlaySlot("mysteryOverlay", { ready: true });
    requestOverlaySlot("academicPopup", { ready: true });
    expect(getActiveOverlayId()).toBe("mysteryOverlay");

    releaseOverlaySlot("mysteryOverlay");
    expect(getActiveOverlayId()).toBe("academicPopup");
  });

  it("menandai isOverlayBusy() agar banner/toast non-eksklusif bisa menunda diri", () => {
    expect(isOverlayBusy()).toBe(false);

    requestOverlaySlot("newProductPopup", { ready: true });
    expect(isOverlayBusy()).toBe(true);

    releaseOverlaySlot("newProductPopup");
    expect(isOverlayBusy()).toBe(false);
  });

  it("hanya memberi tahu subscriber saat pemenang benar-benar berubah", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOverlays(listener);

    requestOverlaySlot("academicPopup", { ready: true });
    expect(listener).toHaveBeenCalledTimes(1);

    // Permintaan ulang dengan state sama tidak boleh memicu notify (anti-flicker).
    requestOverlaySlot("academicPopup", { ready: true });
    expect(listener).toHaveBeenCalledTimes(1);

    requestOverlaySlot("academicPopup", { ready: false });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getActiveOverlayId()).toBeNull();

    unsubscribe();
    requestOverlaySlot("academicPopup", { ready: true });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("menyediakan fungsi pelepas yang idempoten", () => {
    const release = requestOverlaySlot("flashSalePopup", { ready: true });
    expect(getActiveOverlayId()).toBe("flashSalePopup");

    release();
    release();
    releaseOverlaySlot("flashSalePopup");
    expect(getActiveOverlayId()).toBeNull();
    expect(isOverlayBusy()).toBe(false);
  });
});
