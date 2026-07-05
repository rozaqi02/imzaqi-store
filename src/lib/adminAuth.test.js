import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockGetSession = vi.fn();

vi.mock("./supabaseClient", () => ({
  supabase: {
    auth: { getSession: (...args) => mockGetSession(...args) },
    from: (...args) => mockFrom(...args),
    rpc: (...args) => mockRpc(...args),
  },
}));

vi.mock("./log", () => ({
  warn: vi.fn(),
}));

import { checkIsAdmin, hasAdminRoleMetadata, checkAdminAccess } from "./adminAuth";

describe("adminAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: null, error: { message: "not found" } });
  });

  it("hasAdminRoleMetadata detects app_metadata.role", () => {
    expect(hasAdminRoleMetadata({ app_metadata: { role: "admin" } })).toBe(true);
    expect(hasAdminRoleMetadata({ app_metadata: { role: "user" } })).toBe(false);
  });

  it("checkIsAdmin returns true when user is in admin_users", async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { user_id: "uuid-1" }, error: null }),
        }),
      }),
    });

    const ok = await checkIsAdmin({ id: "uuid-1", app_metadata: {} });
    expect(ok).toBe(true);
  });

  it("checkIsAdmin returns false when not in admin_users and no metadata", async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    });

    const ok = await checkIsAdmin({ id: "uuid-2", app_metadata: {} });
    expect(ok).toBe(false);
  });

  it("checkAdminAccess returns not_admin when session exists but not listed", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "x", app_metadata: {} } } },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    });

    const result = await checkAdminAccess();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_admin");
  });
});