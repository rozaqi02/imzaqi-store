import React, { useEffect, useState } from "react";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import "../../css/pages/AdminLogin.css";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePageMeta } from "../../hooks/usePageMeta";
import { useToast } from "../../context/ToastContext";
import { warn } from "../../lib/log";
import { checkAdminAccess, checkIsAdmin } from "../../lib/adminAuth";

export default function AdminLogin() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "not_admin") {
      setMsg("Akun ini tidak punya akses admin. Hubungi pemilik toko.");
    }
  }, [searchParams]);

  useEffect(() => {
    checkAdminAccess().then((result) => {
      if (result.ok) nav("/admin/dashboard");
    });
  }, [nav]);

  usePageMeta({
    title: "Admin Login",
    description: "Masuk ke ruang admin buat kelola order, produk, promo, sama operasional toko.",
  });

  async function onLogin(e) {
    e.preventDefault();
    setMsg("");
    setSubmitting(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const nextMessage = /invalid login credentials/i.test(String(error?.message || ""))
        ? "Email atau password salah."
        : "Login belum bisa diproses.";
      setMsg(nextMessage);
      warn("Admin login gagal:", error);
      toast.error("Login gagal");
      setSubmitting(false);
      return;
    }

    if (data?.session) {
      const isAdmin = await checkIsAdmin(data.session.user);
      if (!isAdmin) {
        await supabase.auth.signOut();
        setMsg(
          "Akun ini tidak terdaftar di admin_users. Pastikan email kamu sudah ditambahkan di database Supabase."
        );
        toast.error("Akses ditolak");
        setSubmitting(false);
        return;
      }
      nav("/admin/dashboard");
      return;
    }

    setSubmitting(false);
  }

  return (
    <div className="page admin-login-page">
      <section className="section">
        <div className="container narrow">
          <div className="admin-loginShell">
            <div className="admin-loginAside">
              <h1 className="h2">Masuk ke Admin Dashboard.</h1>
              <p className="admin-loginSub">Kelola orderan, produk, promo, sama QRIS.</p>

              <div className="admin-loginSignals">
                <div className="admin-loginSignal">
                  <KeyRound size={15} />
                  <span>Aman</span>
                </div>
                <div className="admin-loginSignal">
                  <LockKeyhole size={15} />
                  <span>Privat</span>
                </div>
                <div className="admin-loginSignal">
                  <ShieldCheck size={15} />
                  <span>Terverifikasi</span>
                </div>
              </div>
            </div>

            <div className="admin-loginFormWrap">
              <form onSubmit={onLogin} className="form admin-loginForm" noValidate>
                <label className="label" htmlFor="admin-login-email">Email</label>
                <input
                  id="admin-login-email"
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@email.com"
                  autoComplete="username"
                  required
                  aria-invalid={msg ? "true" : undefined}
                  aria-describedby={msg ? "admin-login-error" : undefined}
                />

                <label className="label" htmlFor="admin-login-password">Password</label>
                <input
                  id="admin-login-password"
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  required
                />

                <button className="btn btn-wide" type="submit" disabled={submitting}>
                  {submitting ? "Masuk..." : "Masuk admin"}
                </button>

                {msg ? (
                  <div id="admin-login-error" className="hint" role="alert">
                    {msg}
                  </div>
                ) : null}
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
