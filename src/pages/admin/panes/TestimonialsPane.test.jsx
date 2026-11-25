import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TestimonialsPane from "./TestimonialsPane";

const sampleProducts = [
  { id: "p-netflix", name: "Netflix", slug: "netflix", category: "streaming", is_active: true, icon_url: "/netflix.png" },
  { id: "p-turnitin", name: "Turnitin", slug: "turnitin", category: "academic", is_active: true, icon_url: "/turnitin.png" },
];

const sampleTestimonials = [
  { id: "t1", image_url: "/t1.png", is_active: true, product_id: "p-netflix", product_name: "Netflix", category: "streaming" },
  { id: "t2", image_url: "/t2.png", is_active: true, product_id: null, product_name: null, category: null },
];

it("allows uploading testimonials with optional product/category and auto-syncs category when product is selected", async () => {
  const onAdd = vi.fn().mockResolvedValue(true);
  const { container } = render(
    <TestimonialsPane
      activeCount={2}
      testimonials={sampleTestimonials}
      products={sampleProducts}
      onAddTestimonials={onAdd}
      onUpdateTestimonial={vi.fn()}
      onDeleteTestimonial={vi.fn()}
    />
  );

  const fileInput = container.querySelector('input[type="file"]');
  const fakeFile = new File(["img"], "bukti.png", { type: "image/png" });
  fireEvent.change(fileInput, { target: { files: [fakeFile] } });

  // Upload without product/category (optional)
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
  expect(onAdd.mock.calls[0][0]).toMatchObject({
    productId: null,
    productName: null,
    category: null,
  });

  // Upload with a selected product (auto-fills category) and purchase date
  fireEvent.change(fileInput, { target: { files: [fakeFile] } });
  fireEvent.click(screen.getByRole("combobox", { name: /Produk \/ Paket/i }));
  fireEvent.click(screen.getByRole("option", { name: /Turnitin/i }));
  expect(screen.getByLabelText("Kategori paket produk (opsional)")).toHaveValue("academic");
  fireEvent.change(screen.getByLabelText("Tanggal pembelian (opsional)"), {
    target: { value: "2026-11-25" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(2));
  expect(onAdd.mock.calls[1][0]).toMatchObject({
    productId: "p-turnitin",
    productName: "Turnitin",
    category: "academic",
    purchasedAt: "2026-11-25T12:00:00.000Z",
  });
});

it("filters by category and lets admin edit or clear category/product/date via modal", async () => {
  const onUpdate = vi.fn().mockResolvedValue(true);
  render(
    <TestimonialsPane
      activeCount={2}
      testimonials={sampleTestimonials}
      products={sampleProducts}
      onAddTestimonials={vi.fn()}
      onUpdateTestimonial={onUpdate}
      onDeleteTestimonial={vi.fn()}
    />
  );

  // Filter to uncategorized
  fireEvent.click(screen.getByRole("button", { name: "Tanpa kategori (1)" }));
  expect(screen.getAllByRole("button", { name: "Detail" })).toHaveLength(1);

  // Edit uncategorized testimonial -> assign Streaming category & date
  fireEvent.click(screen.getByRole("button", { name: "Detail" }));
  const modalSelect = screen.getByLabelText(/Kategori Paket \(opsional\)/i);
  fireEvent.change(modalSelect, { target: { value: "streaming" } });
  fireEvent.change(screen.getByLabelText("Edit tanggal pembelian (opsional)"), {
    target: { value: "2026-11-20" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

  await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("t2", {
    product_id: null,
    product_name: null,
    category: "streaming",
    purchased_at: "2026-11-20T12:00:00.000Z",
  }));
});

it("opens full photo preview modal when clicking a testimonial image and navigates between photos", () => {
  render(
    <TestimonialsPane
      activeCount={2}
      testimonials={sampleTestimonials}
      products={sampleProducts}
      onAddTestimonials={vi.fn()}
      onUpdateTestimonial={vi.fn()}
      onDeleteTestimonial={vi.fn()}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: /Lihat foto penuh testimoni 1: Netflix · Streaming/i }));
  expect(screen.getByRole("dialog", { name: "Foto Testimoni 1 dari 2" })).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Foto berikutnya" }));
  expect(screen.getByRole("dialog", { name: "Foto Testimoni 2 dari 2" })).toBeVisible();

  fireEvent.keyDown(window, { key: "ArrowLeft" });
  expect(screen.getByRole("dialog", { name: "Foto Testimoni 1 dari 2" })).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("supports pasting images via Ctrl+V and Tempel gambar button", async () => {
  const onAdd = vi.fn().mockResolvedValue(true);
  render(
    <TestimonialsPane
      activeCount={2}
      testimonials={sampleTestimonials}
      products={sampleProducts}
      onAddTestimonials={onAdd}
      onUpdateTestimonial={vi.fn()}
      onDeleteTestimonial={vi.fn()}
    />
  );

  // Paste image via Ctrl+V (window paste event)
  const pastedBlob = new File(["pngdata"], "image.png", { type: "image/png" });
  fireEvent.paste(window, {
    clipboardData: {
      items: [{ kind: "file", type: "image/png", getAsFile: () => pastedBlob }],
    },
  });
  expect(screen.getByText("1 gambar ditempel dari clipboard.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Upload" })).toBeEnabled();

  // Paste another image via "Tempel gambar" button (navigator.clipboard.read)
  const originalClipboard = navigator.clipboard;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      read: vi.fn().mockResolvedValue([
        {
          types: ["image/png"],
          getType: vi.fn().mockResolvedValue(new Blob(["clip"], { type: "image/png" })),
        },
      ]),
    },
  });

  fireEvent.click(screen.getByRole("button", { name: /Tempel gambar/i }));
  await waitFor(() => expect(screen.getByText("2 gambar siap")).toBeInTheDocument());

  // Remove first queued image, leaving 1 image, then upload
  const removeButtons = screen.getAllByRole("button", { name: /dari antrean/i });
  expect(removeButtons).toHaveLength(2);
  fireEvent.click(removeButtons[0]);
  expect(screen.getByText("1 gambar siap")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
  expect(onAdd.mock.calls[0][0].files).toHaveLength(1);
  expect(onAdd.mock.calls[0][0].files[0].type).toBe("image/png");

  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: originalClipboard,
  });
});
