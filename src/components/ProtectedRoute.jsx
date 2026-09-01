import React from "react";
import { Navigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { checkAdminAccess } from "../lib/adminAuth";

/**
 * Admin route guard — session + admin_users row or app_metadata.role === "admin".
 */
export default function ProtectedRoute({ children, fallback = null }) {
  const [state, setState] = React.useState({ checking: true, ok: false, reason: null });

  React.useEffect(() => {
    let alive = true;

    async function verify() {
      try {
        const result = await checkAdminAccess();
        if (!alive) return;
        setState({ checking: false, ok: result.ok, reason: result.reason });
      } catch {
        if (!alive) return;
        setState({ checking: false, ok: false, reason: "error" });
      }
    }

    verify();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      verify();
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (state.checking) {
    return (
      fallback || (
        <div className="page admin-gate-page" role="status" aria-live="polite" aria-busy="true">
          <div className="admin-gate-bg" aria-hidden="true" />
          <div className="admin-gate-card">
            <div className="admin-gate-brand">
              <span className="admin-gate-logoWrap">
                <img className="admin-gate-logo" src="/icon.png" alt="" />
                <span className="admin-gate-ring" aria-hidden="true" />
              </span>
              <div className="admin-gate-brandCopy">
                <span className="admin-gate-kicker">
                  <ShieldCheck size={14} strokeWidth={2.4} aria-hidden="true" />
                  Admin
                </span>
                <strong>Imzaqi Store</strong>
              </div>
            </div>

            <div className="admin-gate-body">
              <div className="admin-gate-spinner" aria-hidden="true">
                <span />
              </div>
              <h1 className="admin-gate-title">Memverifikasi akses</h1>
              <p className="admin-gate-sub">
                Mengecek sesi dan izin admin. Sebentar saja…
              </p>
            </div>

            <div className="admin-gate-skeleton" aria-hidden="true">
              <div className="admin-gate-skel admin-gate-skel--nav" />
              <div className="admin-gate-skelRow">
                <div className="admin-gate-skel admin-gate-skel--stat" />
                <div className="admin-gate-skel admin-gate-skel--stat" />
                <div className="admin-gate-skel admin-gate-skel--stat" />
              </div>
              <div className="admin-gate-skel admin-gate-skel--panel" />
            </div>
          </div>
        </div>
      )
    );
  }

  if (!state.ok) {
    if (state.reason === "not_admin") {
      return <Navigate to="/admin?error=not_admin" replace />;
    }
    return <Navigate to="/admin" replace />;
  }

  return children;
}
