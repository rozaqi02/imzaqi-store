import React, { useMemo, useState } from "react";
import { usePageMeta } from "../hooks/usePageMeta";

const FAQ = [
  {
    q: "Bagaimana alur pembelian di Imzaqi Store?",
    a: "Pilih produk & paket → checkout via QRIS → upload bukti bayar → admin proses → kamu bisa cek Status Order kapan saja.",
  },
  {
    q: "Garansinya seperti apa?",
    a: "Garansi mengikuti paket/varian yang kamu pilih. Detail garansi selalu ditulis jelas di setiap varian paket.",
  },
  {
    q: "Berapa lama prosesnya?",
    a: "Tergantung antrean dan jam operasional admin. Yang kami jaga: proses rapi, status jelas, dan respons secepat mungkin.",
  },
  {
    q: "Kalau ada kendala gimana?",
    a: "Hubungi admin sesuai info kontak di footer / menu Bantuan. Kami bantu sampai selesai sesuai ketentuan paket.",
  },
];

function Chevron({ open }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 180ms cubic-bezier(0.16, 1, 0.3, 1)",
        opacity: 0.9,
      }}
    >
      ▾
    </span>
  );
}

export default function About() {
  usePageMeta({
    title: "Tentang",
    description: "Tentang Imzaqi Store — cara kerja, komitmen layanan, dan FAQ.",
  });

  const [openIdx, setOpenIdx] = useState(0);

  const values = useMemo(
    () => [
      {
        title: "Transparan",
        desc: "Paket & durasi jelas. Detail ada di tiap varian. Tanpa kejutan.",
        icon: "🔎",
      },
      {
        title: "Rapi",
        desc: "Checkout QRIS + bukti bayar terarsip. Proses terasa profesional.",
        icon: "🧾",
      },
      {
        title: "Aman",
        desc: "Flow pembayaran dan status order dibuat jelas untuk menghindari bingung.",
        icon: "🔒",
      },
    ],
    []
  );

  const steps = useMemo(
    () => [
      {
        num: "01",
        title: "Pilih produk & paket",
        desc: "Cari aplikasi yang kamu mau, lalu pilih durasi/paket yang sesuai kebutuhan.",
        icon: "🧩",
      },
      {
        num: "02",
        title: "Checkout via QRIS",
        desc: "Bayar cepat. Setelah itu, upload bukti bayar langsung dari website.",
        icon: "⚡",
      },
      {
        num: "03",
        title: "Pantau status order",
        desc: "Admin memproses. Kamu bisa cek status kapan saja tanpa nanya berulang.",
        icon: "📍",
      },
    ],
    []
  );

  return (
    <div className="page">
      {/* HERO (premium, narrative) */}
      <section className="section about2-hero reveal">
        <div className="container center">
          <div className="about2-badge">Tentang Imzaqi Store</div>

          <h1 className="h1 about2-title">
            Beli premium apps itu harusnya <span className="hero-accent">simple</span>,
            bukan bikin ragu.
          </h1>

          <p className="about2-sub">
            Kami fokus di pengalaman beli yang rapi: paket jelas, checkout QRIS, bukti bayar bisa diupload,
            dan status order transparan. Tujuannya satu — kamu merasa aman dari awal sampai selesai.
          </p>

          <div className="about2-trust">
            <span className="trust-pill">✅ Garansi sesuai paket</span>
            <span className="trust-pill">⚡ Proses cepat</span>
            <span className="trust-pill">🔒 Aman & rapi</span>
          </div>

          <div className="about2-cta">
            <a className="btn" href="/produk">Lihat Produk</a>
            <a className="btn btn-ghost" href="/status">Cek Status</a>
          </div>

          <div className="about2-hero-strip">
            <div className="about2-strip-item">
              <div className="strip-k">Flow rapi</div>
              <div className="strip-v">Order → Bayar → Upload → Proses</div>
            </div>
            <div className="about2-strip-item">
              <div className="strip-k">Status jelas</div>
              <div className="strip-v">Transparan di halaman Status</div>
            </div>
            <div className="about2-strip-item">
              <div className="strip-k">Kontrol</div>
              <div className="strip-v">Kamu bisa pantau tanpa ribet</div>
            </div>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="section reveal">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 className="h2">Prinsip kami</h2>
              <p className="muted">Biar pengalaman belinya terasa “berkelas” dan bisa dipercaya.</p>
            </div>
          </div>

          <div className="about2-values">
            {values.map((v) => (
              <div key={v.title} className="card pad about2-value">
                <div className="about2-icon">{v.icon}</div>
                <div className="h3">{v.title}</div>
                <p className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS (timeline) */}
      <section className="section reveal">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 className="h2">Cara kerja</h2>
              <p className="muted">3 langkah simpel, tapi terasa profesional.</p>
            </div>
            <a className="btn btn-ghost" href="/produk">Mulai sekarang</a>
          </div>

          <div className="about2-steps">
            {steps.map((s) => (
              <div key={s.num} className="about2-step card pad">
                <div className="about2-step-top">
                  <div className="about2-step-num">{s.num}</div>
                  <div className="about2-step-ic">{s.icon}</div>
                </div>

                <div className="h3">{s.title}</div>
                <p className="muted" style={{ marginTop: 6, lineHeight: 1.75 }}>{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="about2-proof card pad">
            <div className="about2-proof-left">
              <div className="h3">Kenapa alur ini efektif?</div>
              <p className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
                Karena mengurangi bolak-balik chat & miskomunikasi. Bukti bayar terdokumentasi,
                dan status order jadi pusat informasi. Kamu tinggal pantau.
              </p>
              <div className="about2-proof-ctas">
                <a className="btn" href="/status">Cek Status Order</a>
                <a className="btn btn-ghost" href="/testimoni">Lihat Testimoni</a>
              </div>
            </div>

            <div className="about2-proof-right">
              <div className="about2-mini">
                <div className="mini-k">Paket jelas</div>
                <div className="mini-v">Detail di tiap varian</div>
              </div>
              <div className="about2-mini">
                <div className="mini-k">Bukti bayar</div>
                <div className="mini-v">Upload langsung di web</div>
              </div>
              <div className="about2-mini">
                <div className="mini-k">Status</div>
                <div className="mini-v">Transparan & realtime</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section reveal">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 className="h2">FAQ</h2>
              <p className="muted">Yang sering ditanyain sebelum order.</p>
            </div>
          </div>

          <div className="about2-faq">
            {FAQ.map((f, idx) => {
              const open = idx === openIdx;
              return (
                <button
                  key={f.q}
                  className={`about2-faq-item card ${open ? "open" : ""}`}
                  onClick={() => setOpenIdx(open ? -1 : idx)}
                  type="button"
                  aria-expanded={open}
                >
                  <div className="about2-faq-q">
                    <div className="faq-q-text">{f.q}</div>
                    <Chevron open={open} />
                  </div>
                  {open ? <div className="about2-faq-a">{f.a}</div> : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section reveal">
        <div className="container">
          <div className="cta-panel card pad center about2-final">
            <h2 className="h2">Siap mulai?</h2>
            <p className="muted">Cari aplikasi favoritmu, pilih paketnya, dan checkout sekarang.</p>
            <div className="about2-cta">
              <a className="btn" href="/produk">Mulai belanja</a>
              <a className="btn btn-ghost" href="/testimoni">Lihat testimoni</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
