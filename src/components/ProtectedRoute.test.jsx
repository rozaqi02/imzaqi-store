import React from "react";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { checkAdminAccess } from "../lib/adminAuth";
vi.mock("../lib/adminAuth", () => ({ checkAdminAccess: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({ supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } }));
it("shows the admin loader before granting access on a direct dashboard visit", async () => {
  let resolve;
  checkAdminAccess.mockReturnValue(new Promise(done => { resolve = done; }));
  render(<MemoryRouter initialEntries={["/admin/dashboard"]}><ProtectedRoute><div>Private dashboard</div></ProtectedRoute></MemoryRouter>);
  expect(screen.getByRole("status")).toHaveClass("admin-gate-page");
  expect(screen.getByText("Memverifikasi akses")).toBeVisible();
  expect(screen.queryByText("Private dashboard")).not.toBeInTheDocument();
  await act(async () => resolve({ ok: true }));
  expect(screen.getByText("Private dashboard")).toBeVisible();
});
