import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import AdminPicker from "./AdminPicker";

const options = [
  { value: "one", label: "Canva", description: "Pro · 1 Bulan", meta: "Rp 5.000", searchText: "5000", icon: "/canva.png", status: "Stok 5" },
  { value: "two", label: "Canva", description: "Pro · 3 Bulan", meta: "Rp 13.000", searchText: "13000", status: "Stok habis", statusTone: "muted" },
  { value: 3, label: "Netflix", description: "Private · 1 Bulan", meta: "Rp 31.000" },
];
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("AdminPicker", () => {
  it("searches across package details and raw prices, then preserves the chosen ID", () => {
    const onChange = vi.fn();
    render(<AdminPicker label="Varian" value="one" options={options} onChange={onChange}/>);
    const trigger = screen.getByRole("combobox", { name: "Varian" });
    fireEvent.click(trigger);
    const search = screen.getByRole("combobox", { name: "Cari varian" });
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: "canva 13000" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.click(screen.getByRole("option", { name: /3 Bulan Stok habis/ }));
    expect(onChange).toHaveBeenCalledWith("two");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("supports keyboard navigation and Escape without changing the selection", () => {
    const onChange = vi.fn();
    render(<AdminPicker label="Produk" value="one" options={options} onChange={onChange}/>);
    const trigger = screen.getByRole("combobox", { name: "Produk" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const search = screen.getByRole("combobox", { name: "Cari produk" });
    fireEvent.keyDown(search, { key: "End" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(3);
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Cari produk" }), { key: "Escape" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });
  it("shows an empty search state and closes on outside interactions", () => {
    render(<AdminPicker label="Produk" options={options} onChange={vi.fn()}/>);
    fireEvent.click(screen.getByRole("combobox", { name: "Produk" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Cari produk" }), { target: { value: "missing" } });
    expect(screen.getByText(/Tidak ada pilihan/)).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
  it("uses a mobile sheet above the keyboard and keeps list scrolling open", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(390);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(844);
    const viewport = new EventTarget();
    Object.assign(viewport, { height: 500, offsetTop: 0 });
    vi.stubGlobal("visualViewport", viewport);
    render(<AdminPicker label="Produk" options={options} onChange={vi.fn()}/>);
    fireEvent.click(screen.getByRole("combobox", { name: "Produk" }));
    const list = screen.getByRole("listbox");
    expect(list.parentElement).toHaveClass("is-mobile");
    expect(list.parentElement.style.bottom).toBe("356px");
    fireEvent.scroll(list);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tutup pilihan produk" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
