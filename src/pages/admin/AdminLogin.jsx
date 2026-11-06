import React, { useEffect, useState } from "react";
import { AlertCircle, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import "../../css/pages/AdminLogin.css";
import "../../css/pages/AdminPolish.css";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePageMeta } from "../../hooks/usePageMeta";
import { useToast } from "../../context/ToastContext";
import { warn } from "../../lib/log";
import { checkAdminAccess, checkIsAdmin } from "../../lib/adminAuth";

const RATE_LIMIT_KEY = "imzaqi_admin_login_rate_limit";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 menit

function getRateLimitState() {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return { attempts: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw);
    if (parsed.lockedUntil && Date.now() > parsed.lockedUntil) {
      localStorage.removeItem(RATE_LIMIT_KEY);
      return { attempts: 0, lockedUntil: 0 };
    }
    return parsed;
  } catch {
    return { attempts: 0, lockedUntil: 0 };
  }
}

function recordFailedAttempt() {
  try {
    const current = getRateLimitState();
    const nextAttempts = (current.attempts || 0) + 1;
    const lockedUntil = nextAttempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0;
    const payload = { attempts: nextAttempts, lockedUntil };
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(payload));
    return payload;
  } catch {
    return { attempts: 1, lockedUntil: 0 };
  }
}

function clearRateLimitState() {
  try {
    localStorage.removeItem(RATE_LIMIT_KEY);
  } catch {}
}

export default function AdminLogin() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lockRemainingSeconds, setLockRemainingSeconds] = useState(0);

  useEffect(() => {
    const checkLock = () => {
      const state = getRateLimitState();
      if (state.lockedUntil && state.lockedUntil > Date.now()) {
        setLockRemainingSeconds(Math.ceil((state.lockedUntil - Date.now()) / 1000));
      } else {
        setLockRemainingSeconds(0);
      }
    };

    checkLock();
    const interval = setInterval(checkLock, 1000);
    return () => clearInterval(interval);
  }, []);

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

    if (lockRemainingSeconds > 0) {
      const mins = Math.ceil(lockRemainingSeconds / 60);
      setMsg(`Terlalu banyak percobaan gagal. Akses dibatasi selama ${mins} menit demi keamanan.`);
      toast.error("Akses dikunci sementara");
      return;
    }

    // SEC-02: Validasi kompleksitas password di client (minimal 12 karakter, tolak PIN numerik pendek)
    if (!password || /^\d+$/.test(password) || password.length < 12) {
      const warning = /^\d+$/.test(password)
        ? "PIN numerik tidak diizinkan. Gunakan kata sandi minimal 12 karakter."
        : "Kata sandi admin minimal 12 karakter sesuai standar keamanan.";
      setMsg(warning);
      toast.error("Kata sandi tidak memenuhi standar keamanan");
      return;
    }

    setSubmitting(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const updated = recordFailedAttempt();
      const remainingAttempts = Math.max(0, MAX_ATTEMPTS - updated.attempts);

      let nextMessage = /invalid login credentials/i.test(String(error?.message || ""))
        ? "Email atau password salah."
        : "Login belum bisa diproses.";

      if (updated.lockedUntil > 0) {
        nextMessage = "Terlalu banyak percobaan gagal (5x). Akses dikunci selama 15 menit.";
        setLockRemainingSeconds(Math.ceil(LOCKOUT_MS / 1000));
      } else if (remainingAttempts > 0) {
        nextMessage += ` Sisa kesempatan: ${remainingAttempts}x.`;
      }

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
      clearRateLimitState();
      nav("/admin/dashboard");
      return;
    }

    setSubmitting(false);
  }

  const isLocked = lockRemainingSeconds > 0;

  return (
    <div className="page admin-login-page">
      <section className="section">
        <div className="container narrow">
          <div className="admin-loginShell">
            <div className="admin-loginAside">
              <h1 className="h2">Admin Dashboard.</h1>
              <p className="admin-loginSub">Kelola order, produk, promo, dan QRIS.</p>

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
                {isLocked && (
                  <div
                    style={{
                      background: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      marginBottom: "14px",
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#f87171",
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>
                      Akses dikunci sementara ({Math.floor(lockRemainingSeconds / 60)}:
                      {String(lockRemainingSeconds % 60).padStart(2, "0")})
                    </span>
                  </div>
                )}

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
                  disabled={isLocked}
                  aria-invalid={msg ? "true" : undefined}
                  aria-describedby={msg ? "admin-login-error" : undefined}
                />

                <label className="label" htmlFor="admin-login-password">
                  Password <span style={{ fontSize: "11px", color: "var(--text-subtle, #888)" }}>(min. 12 karakter)</span>
                </label>
                <input
                  id="admin-login-password"
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password kuat"
                  autoComplete="current-password"
                  required
                  disabled={isLocked}
                />

                <button className="btn btn-wide" type="submit" disabled={submitting || isLocked}>
                  {submitting ? "Masuk..." : isLocked ? "Terkunci sementara" : "Masuk admin"}
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
