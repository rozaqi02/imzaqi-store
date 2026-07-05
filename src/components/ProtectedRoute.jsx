import React from "react";
import { Navigate } from "react-router-dom";
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
        <div className="page">
          <section className="section">
            <div className="container narrow">
              <div className="card pad">
                <div className="hint subtle">Memeriksa akses admin...</div>
                <div className="skeleton" style={{ height: 14, marginTop: 12 }} />
                <div className="skeleton" style={{ height: 120, marginTop: 12 }} />
              </div>
            </div>
          </section>
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