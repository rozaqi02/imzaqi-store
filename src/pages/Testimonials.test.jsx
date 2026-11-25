import React from "react";
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Testimonials from "./Testimonials";
import { fetchTestimonials } from "../lib/api";

vi.mock("../lib/api", () => ({ fetchTestimonials: vi.fn() }));
vi.mock("../hooks/usePageMeta", () => ({ usePageMeta: () => {} }));
vi.mock("../lib/log", () => ({ warn: vi.fn() }));

const samples = Array.from({ length: 20 }, (_, i) => {
  if (i % 3 === 0) {
    return {
      id: String(i),
      image_url: `/test-${i}.png`,
      product_name: `Netflix ${i}`,
      category: "streaming",
      caption: null,
      created_at: "2026-09-07T00:00:00Z",
    };
  }
  if (i % 3 === 1) {
    return {
      id: String(i),
      image_url: `/test-${i}.png`,
      product_name: `Canva Pro ${i}`,
      category: "design",
      caption: null,
      created_at: "2026-09-07T00:00:00Z",
    };
  }
  return {
    id: String(i),
    image_url: `/test-${i}.png`,
    product_name: null,
    category: null,
    caption: null,
    created_at: "2026-09-07T00:00:00Z",
  };
});

const openPage = () => render(<MemoryRouter><Testimonials /></MemoryRouter>);

beforeEach(() => {
  fetchTestimonials.mockReset();
  fetchTestimonials.mockResolvedValue(samples);
});

it("paginates gallery, filters by product category, and resets search and filters", async () => {
  openPage();
  await screen.findByRole("button", { name: "Buka testimoni 1: Netflix 0" });
  expect(screen.getAllByRole("button", { name: /^Buka testimoni/ })).toHaveLength(9);

  fireEvent.click(screen.getByRole("button", { name: "Lihat lebih banyak" }));
  expect(screen.getAllByRole("button", { name: /^Buka testimoni/ })).toHaveLength(18);

  // Filter by Streaming category (7 items: indices 0, 3, 6, 9, 12, 15, 18)
  fireEvent.click(screen.getByRole("button", { name: /Streaming/i }));
  expect(screen.getAllByRole("button", { name: /^Buka testimoni/ })).toHaveLength(7);

  // Filter by optional uncategorized ("Umum") (6 items: indices 2, 5, 8, 11, 14, 17)
  fireEvent.click(screen.getByRole("button", { name: /Umum/i }));
  expect(screen.getAllByRole("button", { name: /^Buka testimoni/ })).toHaveLength(6);

  // Search non-matching keyword -> empty state -> reset
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "netflix" } });
  expect(screen.getByText("Testimoni belum ketemu")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Lihat semua testimoni" }));
  expect(screen.getByRole("button", { name: /Semua/i, pressed: true })).toBeVisible();
  expect(screen.getByRole("searchbox")).toHaveValue("");
  expect(screen.getAllByRole("button", { name: /^Buka testimoni/ })).toHaveLength(9);
});

it("navigates the image dialog, handles image errors, and closes with Escape", async () => {
  openPage();
  const opener = await screen.findByRole("button", { name: "Buka testimoni 1: Netflix 0" });
  opener.focus();
  fireEvent.click(opener);
  const dialog = screen.getByRole("dialog");
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.click(within(dialog).getByRole("button", { name: "Testimoni berikutnya" }));
  expect(dialog).toHaveAccessibleName("Testimoni 2 dari 20");
  fireEvent.error(within(dialog).getByRole("img"));
  expect(within(dialog).getByText("Gambar belum bisa ditampilkan")).toBeVisible();
  fireEvent.keyDown(window, { key: "ArrowLeft" });
  expect(dialog).toHaveAccessibleName("Testimoni 1 dari 20");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.body.style.overflow).not.toBe("hidden");
  expect(opener).toHaveFocus();
});

it("retries a failed request without reloading the page", async () => {
  fetchTestimonials.mockRejectedValueOnce(new Error("offline"));
  openPage();
  fireEvent.click(await screen.findByRole("button", { name: "Coba lagi" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("20 testimoni"));
  expect(fetchTestimonials).toHaveBeenLastCalledWith({ useCache: false });
});

it("adapts cleanly when all testimonials omit category, product, and caption (optional)", async () => {
  fetchTestimonials.mockResolvedValue(
    samples.map((item) => ({ ...item, product_name: null, category: null, caption: null }))
  );
  openPage();
  await screen.findByRole("button", { name: "Buka testimoni 1", exact: true });
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Filter kategori paket produk" })).not.toBeInTheDocument();
  expect(screen.getByText("Ketuk screenshot untuk melihat bukti transaksi lebih jelas.")).toBeVisible();
});
