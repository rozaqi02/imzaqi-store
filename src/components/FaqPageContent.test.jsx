import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FaqPageContent from "./FaqPageContent";
vi.mock("../lib/api", () => ({ fetchSettings: () => Promise.resolve({}) }));
vi.mock("../hooks/usePageMeta", () => ({ usePageMeta: () => {} }));
it("filters, expands answers accessibly, and recovers from an empty search", () => {
  render(<MemoryRouter><FaqPageContent /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Bayar 3" }));
  expect(screen.getByRole("status")).toHaveTextContent("3 pertanyaan");
  const question = screen.getByRole("button", { name: /Gimana cara bayarnya/ });
  fireEvent.click(question);
  expect(question).toHaveAttribute("aria-expanded", "true");
  expect(document.getElementById(question.getAttribute("aria-controls"))).toBeVisible();
  fireEvent.click(question);
  expect(document.getElementById(question.getAttribute("aria-controls"))).not.toBeVisible();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nomatchxyz" } });
  expect(screen.getByText("Jawabannya belum ketemu")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Lihat semua pertanyaan" }));
  expect(screen.getByRole("status")).toHaveTextContent("12 pertanyaan");
});
it("supports search links with surrounding spaces", () => {
  render(<MemoryRouter initialEntries={["/faq?q=%20QRIS%20"]}><FaqPageContent /></MemoryRouter>);
  expect(screen.getByRole("status")).toHaveTextContent("3 pertanyaan");
});
