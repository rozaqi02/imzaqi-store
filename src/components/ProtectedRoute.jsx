import React from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/**
 * Simple auth guard for admin pages.
 * Checks Supabase session before rendering.
 */
export default function ProtectedRoute({ children, fallback = null }) {
  const [state, setState] = React.useState({ checking: true, ok: false });

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        setState({ checking: false, ok: Boolean(data?.session) });
      } catch {
        if (!alive) return;
        setState({ checking: false, ok: false });
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setState({ checking: false, ok: Boolean(session) });
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
                <div className="hint subtle">Memeriksa akses admin…</div>
                <div className="skeleton" style={{ height: 14, marginTop: 12 }} />
              </div>
            </div>
          </section>
        </div>
      )
    );
  }

  if (!state.ok) return <Navigate to="/admin" replace />;

  return children;
}
