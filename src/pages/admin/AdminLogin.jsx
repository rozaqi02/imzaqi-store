import React, { useEffect, useState } from "react";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { usePageMeta } from "../../hooks/usePageMeta";
import { useToast } from "../../context/ToastContext";

export default function AdminLogin() {
  const nav = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState("rojaki1419@gmail.com");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) nav("/admin/dashboard");
    });
  }, [nav]);

  usePageMeta({
    title: "Admin Login",
    description: "Halaman login admin untuk mengelola produk, promo, dan order.",
  });

  async function onLogin(e) {
    e.preventDefault();
    setMsg("");
    setSubmitting(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMsg(error.message);
      toast.error("Login gagal");
      setSubmitting(false);
      return;
    }

    if (data?.session) {
      nav("/admin/dashboard");
      return;
    }

    setSubmitting(false);
  }

  return (
    <div className="page">
      <section className="section">
        <div className="container narrow">
          <div className="admin-loginShell card">
            <div className="admin-loginAside">
              <h1 className="h2">Masuk cepat.</h1>
              <p className="admin-loginSub">Satu pintu untuk order, promo, dan produk.</p>

              <div className="admin-loginSignals">
                <div className="admin-loginSignal">
                  <KeyRound size={15} />
                  <span>Secure</span>
                </div>
                <div className="admin-loginSignal">
                  <LockKeyhole size={15} />
                  <span>Private</span>
                </div>
                <div className="admin-loginSignal">
                  <ShieldCheck size={15} />
                  <span>Verified</span>
                </div>
              </div>
            </div>

            <div className="admin-loginFormWrap">
              <form onSubmit={onLogin} className="form admin-loginForm">
                <label className="label">Email</label>
                <input
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@email.com"
                  autoComplete="username"
                />

                <label className="label">Password</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                />

                <button className="btn btn-wide" type="submit" disabled={submitting}>
                  {submitting ? "Masuk..." : "Login"}
                </button>

                {msg ? <div className="hint">{msg}</div> : null}
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
