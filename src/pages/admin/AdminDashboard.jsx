import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { fetchProducts, fetchPromoCodes, fetchSettings, fetchTestimonials, upsertSetting } from "../../lib/api";
import { formatIDR, slugify } from "../../lib/format";
import { useNavigate } from "react-router-dom";

const BUCKET = "imzaqi-public";

function TabButton({ active, onClick, children }) {
  return (
    <button className={"tab-btn " + (active ? "active" : "")} onClick={onClick}>
      {children}
    </button>
  );
}

export default function AdminDashboard() {
  const nav = useNavigate();
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState("produk");
  const [msg, setMsg] = useState("");

  // data
  const [products, setProducts] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [settings, setSettings] = useState({});
  const [promos, setPromos] = useState([]);
  const [orders, setOrders] = useState([]);

  async function refreshAll() {
    const [p, t, s, pc] = await Promise.all([
      fetchProducts({ includeInactive: true }),
      fetchTestimonials({ includeInactive: true }),
      fetchSettings(),
      fetchPromoCodes(),
    ]);
    setProducts(p);
    setTestimonials(t);
    setSettings(s);
    setPromos(pc);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      const sess = data?.session || null;
      setSession(sess);
      if (!sess) return;

      // Check admin privileges via RPC (recommended)
      // NOTE: ensure DB function `public.is_admin()` is SECURITY DEFINER and granted to authenticated.
      let ok = false;
      const { data: okRpc, error: okRpcErr } = await supabase.rpc("is_admin");
      if (!okRpcErr) {
        ok = !!okRpc;
      } else {
        // Fallback: read own row (works only if RLS allows selecting your own admin row)
        const { data: adminRow } = await supabase
          .from("admin_users")
          .select("user_id")
          .eq("user_id", sess.user.id)
          .maybeSingle();
        ok = !!adminRow?.user_id;
      }
      setIsAdmin(ok);
      if (!ok) return;

      await refreshAll();

      // load orders (admin only)
      const { data: o } = await supabase.from("orders").select("id,created_at,total_idr,status,items").order("created_at", { ascending: false }).limit(50);
      setOrders(o || []);
    })();
    return () => { alive = false; };
  }, []);

  const waNumber = useMemo(() => settings?.whatsapp?.number || "6283136049987", [settings]);

  async function logout() {
    await supabase.auth.signOut();
    nav("/admin");
  }

  if (!session) {
    return (
      <div className="page">
        <section className="section">
          <div className="container">
            <div className="card pad">
              <h1 className="h2">Belum login</h1>
              <p className="muted">Silakan login dulu.</p>
              <button className="btn" onClick={() => nav("/admin")}>Ke Login</button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="page">
        <section className="section">
          <div className="container">
            <div className="card pad">
              <h1 className="h2">Akses Admin</h1>
              <p className="muted">
                Akun ini belum memiliki akses admin.
                Jika kamu pemilik toko, pastikan akun kamu sudah diberi akses admin.
              </p>
              <button className="btn btn-ghost" onClick={logout}>Logout</button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ======== Actions: Products ========
  async function createProduct() {
    setMsg("");
    const name = prompt("Nama produk? (contoh: Netflix)");
    if (!name) return;
    const slug = slugify(prompt("Slug? (contoh: netflix)") || name);
    if (!slug) return;

    const { error } = await supabase.from("products").insert({
      name,
      slug,
      description: "",
      is_active: true,
      sort_order: 100,
    });
    if (error) { setMsg(error.message); return; }
    await refreshAll();
  }

  async function updateProduct(patch) {
    setMsg("");
    const { id, ...rest } = patch;
    const { error } = await supabase.from("products").update(rest).eq("id", id);
    if (error) { setMsg(error.message); return; }
    await refreshAll();
  }

  async function deleteProduct(id) {
    if (!window.confirm("Hapus produk ini beserta variannya?")) return;
    setMsg("");
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { setMsg(error.message); return; }
    await refreshAll();
  }

  async function addVariant(product) {
    const name = prompt("Nama varian? (contoh: Sharing 1P1U)");
    if (!name) return;
    const duration_label = prompt("Durasi? (contoh: 23 hari / 1 bulan)") || "1 bulan";
    const price_idr = Number(prompt("Harga (angka saja)? (contoh: 28000)") || "0");
    const guarantee_text = prompt("Teks garansi (opsional)") || "";
    const { error } = await supabase.from("product_variants").insert({
      product_id: product.id,
      name,
      duration_label,
      price_idr,
      guarantee_text,
      is_active: true,
      sort_order: 100,
    });
    if (error) { setMsg(error.message); return; }
    await refreshAll();
  }

  async function updateVariant(v) {
    setMsg("");
    const { id, ...rest } = v;
    const { error } = await supabase.from("product_variants").update(rest).eq("id", id);
    if (error) { setMsg(error.message); return; }
    await refreshAll();
  }

  async function deleteVariant(id) {
    if (!window.confirm("Hapus varian ini?")) return;
    setMsg("");
    const { error } = await supabase.from("product_variants").delete().eq("id", id);
    if (error) { setMsg(error.message); return; }
    await refreshAll();
  }

  // ======== Actions: Testimonials ========
  async function uploadToBucket(file, folder = "testimonials") {
    // Requires Storage bucket BUCKET and policies allowing admin write
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${folder}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (upErr) throw upErr;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function addTestimonial(e) {
    e.preventDefault();
    setMsg("");

    const file = e.target.elements.file.files[0];
    const caption = e.target.elements.caption.value;

    if (!file) { setMsg("Pilih file gambar dulu."); return; }

    try {
      const image_url = await uploadToBucket(file, "testimonials");
      const { error } = await supabase.from("testimonials").insert({ image_url, caption, is_active: true, sort_order: 100 });
      if (error) throw error;
      e.target.reset();
      await refreshAll();
      setMsg("Testimoni berhasil ditambahkan.");
    } catch (err) {
      setMsg("Upload gagal. Pastikan bucket & policy Storage sudah dibuat. Detail: " + (err?.message || err));
    }
  }

  async function toggleTestimonial(t) {
    setMsg("");
    const { error } = await supabase.from("testimonials").update({ is_active: !t.is_active }).eq("id", t.id);
    if (error) { setMsg(error.message); return; }
    await refreshAll();
  }

  async function deleteTestimonial(id) {
    if (!window.confirm("Hapus testimoni ini?")) return;
    setMsg("");
    const { error } = await supabase.from("testimonials").delete().eq("id", id);
    if (error) { setMsg(error.message); return; }
    await refreshAll();
  }

  // ======== Actions: Settings ========
  async function saveWhatsApp(number) {
    setMsg("");
    await upsertSetting("whatsapp", { number });
    setSettings(await fetchSettings());
    setMsg("WhatsApp disimpan.");
  }


  // ======== Actions: Promo ========
  async function upsertPromo(code, percent, is_active) {
    setMsg("");
    const { error } = await supabase.from("promo_codes").upsert({
      code: String(code || "").trim().toUpperCase(),
      percent: Number(percent || 0),
      is_active: !!is_active,
    }, { onConflict: "code" });
    if (error) { setMsg(error.message); return; }
    await refreshAll();
    setMsg("Promo disimpan.");
  }

  return (
    <div className="page">
      <section className="section">
        <div className="container section-head">
          <div>
            <h1 className="h1">Admin Dashboard</h1>
            <p className="muted">Kelola produk, harga, testimoni, promo, dan setting checkout.</p>
          </div>
          <button className="btn btn-ghost" onClick={logout}>Logout</button>
        </div>

        <div className="container">
          <div className="tabs">
            <TabButton active={tab === "produk"} onClick={() => setTab("produk")}>Produk</TabButton>
            <TabButton active={tab === "testimoni"} onClick={() => setTab("testimoni")}>Testimoni</TabButton>
            <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>Settings</TabButton>
            <TabButton active={tab === "promo"} onClick={() => setTab("promo")}>Promo</TabButton>
            <TabButton active={tab === "orders"} onClick={() => setTab("orders")}>Orders</TabButton>
          </div>

          {msg ? <div className="hint">{msg}</div> : null}

          {tab === "produk" ? (
            <div className="card pad">
              <div className="row between">
                <h2 className="h3">Kelola Produk</h2>
                <button className="btn btn-sm" onClick={createProduct}>+ Produk</button>
              </div>

              <div className="admin-list">
                {products.map(p => (
                  <div key={p.id} className="admin-item">
                    <div className="row between">
                      <div>
                        <div className="admin-title">{p.name} <span className="muted">/{p.slug}</span></div>
                        <div className="muted">{p.description || "—"}</div>
                      </div>
                      <div className="row">
                        <button className="btn btn-ghost btn-sm" onClick={() => addVariant(p)}>+ Varian</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => updateProduct({ id: p.id, is_active: !p.is_active })}>
                          {p.is_active ? "Nonaktif" : "Aktifkan"}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                          const name = prompt("Nama baru", p.name) || p.name;
                          const description = prompt("Deskripsi", p.description || "") || "";
                          updateProduct({ id: p.id, name, description });
                        }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteProduct(p.id)}>Hapus</button>
                      </div>
                    </div>

                    <div className="variant-admin">
                      {(p.product_variants || []).map(v => (
                        <div key={v.id} className="variant-admin-row">
                          <div className="variant-admin-left">
                            <div className="variant-name">{v.name}</div>
                            <div className="muted">{v.duration_label} {v.guarantee_text ? `• ${v.guarantee_text}` : ""}</div>
                          </div>
                          <div className="row">
                            <input
                              className="input input-sm"
                              type="number"
                              defaultValue={v.price_idr}
                              onBlur={(e) => updateVariant({ id: v.id, price_idr: Number(e.target.value || 0) })}
                              title="Ubah harga lalu klik keluar (blur)"
                            />
                            <button className="btn btn-ghost btn-sm" onClick={() => updateVariant({ id: v.id, is_active: !v.is_active })}>
                              {v.is_active ? "Nonaktif" : "Aktifkan"}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => {
                              const name = prompt("Nama varian", v.name) || v.name;
                              const duration_label = prompt("Durasi", v.duration_label) || v.duration_label;
                              const guarantee_text = prompt("Garansi", v.guarantee_text || "") || "";
                              updateVariant({ id: v.id, name, duration_label, guarantee_text });
                            }}>Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteVariant(v.id)}>Hapus</button>
                          </div>
                        </div>
                      ))}
                      {(p.product_variants || []).length === 0 ? <div className="hint subtle">Belum ada varian.</div> : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hint subtle">
                Tip: Edit harga → ubah angka → klik keluar dari input (blur) untuk auto-save.
              </div>
            </div>
          ) : null}

          {tab === "testimoni" ? (
            <div className="card pad">
              <h2 className="h3">Kelola Testimoni</h2>

              <form className="form" onSubmit={addTestimonial}>
                <label className="label">Upload gambar (jpg/png)</label>
                <input name="file" type="file" accept="image/*" className="input" />

                <label className="label">Caption (opsional)</label>
                <input name="caption" className="input" placeholder="contoh: Terima kasih, fast respon!" />

                <button className="btn" type="submit">Upload</button>
              </form>

              <div className="divider" />

              <div className="admin-grid">
                {testimonials.map(t => (
                  <div key={t.id} className="admin-thumb">
                    <img src={t.image_url} alt={t.caption || "testimoni"} />
                    <div className="admin-thumb-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleTestimonial(t)}>
                        {t.is_active ? "Hide" : "Show"}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteTestimonial(t.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hint subtle">
                Storage bucket yang disarankan: <code>{BUCKET}</code> (public), folder <code>testimonials/</code>.
              </div>
            </div>
          ) : null}

          {tab === "settings" ? (
            <div className="card pad">
              <h2 className="h3">Settings Checkout</h2>

              <div className="prose-grid">
                <div className="prose-card">
                  <h3>WhatsApp</h3>
                  <p className="muted">Gunakan format internasional tanpa tanda + (contoh: 62813...).</p>
                  <input className="input" defaultValue={waNumber} onBlur={(e) => saveWhatsApp(e.target.value)} />
                  <div className="hint subtle">Auto-save saat keluar dari input.</div>
                </div>

                <div className="prose-card">
                  <h3>Pembayaran QRIS</h3>
                  <p className="muted">
                    QRIS ditampilkan dari file <b>qris_payment.jpeg</b> di folder <b>public</b> (frontend).
                    Untuk mengganti QRIS, cukup replace file tersebut lalu deploy ulang.
                  </p>
                </div>
              </div>

              <div className="hint subtle">
                Upload QRIS juga butuh Storage bucket + policy. Kalau belum, lihat panduan SQL policy di chat.
              </div>
            </div>
          ) : null}

          {tab === "promo" ? (
            <div className="card pad">
              <h2 className="h3">Promo</h2>
              <p className="muted">Default: DISKON30 = diskon 30% untuk semua harga.</p>

              <div className="promo-admin">
                <div className="row">
                  <input className="input" id="promo_code" defaultValue="DISKON30" />
                  <input className="input" id="promo_percent" type="number" min="0" max="90" defaultValue={promos.find(p => p.code === "DISKON30")?.percent ?? 30} />
                  <label className="checkbox">
                    <input type="checkbox" id="promo_active" defaultChecked={promos.find(p => p.code === "DISKON30")?.is_active ?? true} />
                    aktif
                  </label>
                  <button className="btn" onClick={() => {
                    const code = document.getElementById("promo_code").value;
                    const percent = document.getElementById("promo_percent").value;
                    const active = document.getElementById("promo_active").checked;
                    upsertPromo(code, percent, active);
                  }}>Simpan</button>
                </div>

                <div className="divider" />
                <div className="hint subtle">
                  Promo lain bisa ditambahkan via SQL / UI lanjut. Untuk versi ini fokus 1 kode.
                </div>
              </div>
            </div>
          ) : null}

          {tab === "orders" ? (
            <div className="card pad">
              <h2 className="h3">Orders terbaru</h2>
              <div className="muted">Menampilkan 50 order terakhir (klik “Sudah bayar”).</div>

              <div className="divider" />

              {orders.length === 0 ? <div className="hint">Belum ada order.</div> : (
                <div className="orders">
                  {orders.map(o => (
                    <div key={o.id} className="order-row">
                      <div>
                        <div className="order-id">{o.id}</div>
                        <div className="muted">{new Date(o.created_at).toLocaleString("id-ID")} • {o.status}</div>
                      </div>
                      <div className="order-total">{formatIDR(o.total_idr)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}