import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("rojaki1419@gmail.com");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) nav("/admin/dashboard");
    });
  }, [nav]);

  async function onLogin(e) {
    e.preventDefault();
    setMsg("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMsg(error.message); return; }
    if (data?.session) nav("/admin/dashboard");
  }

  return (
    <div className="page">
      <section className="section">
        <div className="container narrow">
          <div className="card pad">
            <h1 className="h2">Admin Login</h1>
            <p className="muted">Login pakai akun admin.</p>

            <form onSubmit={onLogin} className="form">
              <label className="label">Email</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@email.com" />

              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />

              <button className="btn btn-wide" type="submit">Login</button>
              {msg ? <div className="hint">{msg}</div> : null}
              <div className="hint subtle">
                Setelah berhasil login, disarankan ganti password.
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
