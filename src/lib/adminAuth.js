import { supabase } from "./supabaseClient";
import { warn } from "./log";

/**
 * Admin identity — any of:
 * 1. auth.users app_metadata.role === "admin"
 * 2. Row in public.admin_users for auth.uid() (ImzaQi production setup)
 * 3. Supabase RPC public.is_admin() when deployed
 */
export function hasAdminRoleMetadata(user) {
  if (!user) return false;
  const role = user.app_metadata?.role ?? user.user_metadata?.role;
  return String(role || "").toLowerCase() === "admin";
}

async function isUserInAdminTable(userId) {
  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    warn("Gagal cek admin_users:", error);
    return false;
  }
  return Boolean(data?.user_id);
}

async function isAdminViaRpc() {
  try {
    const { data, error } = await supabase.rpc("is_admin");
    if (error) return null;
    return data === true;
  } catch {
    return null;
  }
}

export async function checkIsAdmin(user) {
  if (!user?.id) return false;
  if (hasAdminRoleMetadata(user)) return true;

  const rpcResult = await isAdminViaRpc();
  if (rpcResult === true) return true;

  return isUserInAdminTable(user.id);
}

export async function checkAdminAccess() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session) {
    return { ok: false, reason: "no_session", session: null, user: null };
  }
  const user = data.session.user;
  const isAdmin = await checkIsAdmin(user);
  if (!isAdmin) {
    return { ok: false, reason: "not_admin", session: data.session, user };
  }
  return { ok: true, reason: null, session: data.session, user };
}

export async function requireAdminOrSignOut() {
  const result = await checkAdminAccess();
  if (!result.ok && result.session) {
    await supabase.auth.signOut();
  }
  return result;
}