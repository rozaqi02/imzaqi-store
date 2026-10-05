import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Bell, BookOpen, Check, CircleHelp, LoaderCircle, Megaphone, Monitor, Save, ShieldCheck, Sparkles, Tag, Undo2, X, Zap } from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import { upsertSetting } from "../../../lib/api";
import { isAcademicProduct, resolveProductCategory } from "../../../lib/productCategories";
import { BANNER_COLORS, BANNER_GRAPHICS, BANNER_ICONS, BANNER_LINK_STYLES, BANNER_STYLES, BANNER_TYPES, normalizePromotion, productPromotionCopy, readyFlashPromotions, resolveBannerCopy, resolvePromotionCopy, validatePromotion } from "../../../lib/storefrontPromotions";
import BannerGraphic from "../../../components/BannerGraphic";
import AdminPicker from "./AdminPicker";
import NewProductPopupContent from "../../../components/NewProductPopupContent";
import "./StorefrontPromotionSettings.css";

function BannerIcon({ name }) {
  if (!name || name === "none") return null;
  switch (name) {
    case "bell": return <Bell size={13} className="promo-tickerGlyph" aria-hidden="true" />;
    case "megaphone": return <Megaphone size={13} className="promo-tickerGlyph" aria-hidden="true" />;
    case "zap": return <Zap size={13} className="promo-tickerGlyph" aria-hidden="true" />;
    case "sparkles": return <Sparkles size={13} className="promo-tickerGlyph" aria-hidden="true" />;
    case "shield": return <ShieldCheck size={13} className="promo-tickerGlyph" aria-hidden="true" />;
    case "tag": return <Tag size={13} className="promo-tickerGlyph" aria-hidden="true" />;
    default: return null;
  }
}

function usePromotionDraft(key, settings, onSaved, draftCache) {
  const toast = useToast();
  const source = JSON.stringify(normalizePromotion(key, settings[key]));
  const [state, setState] = useState(() => {
    const saved = JSON.parse(source), cached = draftCache?.current[key];
    return { draft: cached && JSON.stringify(cached.draft) !== JSON.stringify(cached.saved) ? cached.draft : saved, saved };
  });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    const incoming = JSON.parse(source);
    setState(current => ({ draft: JSON.stringify(current.draft) === JSON.stringify(current.saved) ? incoming : current.draft, saved: incoming }));
  }, [source]);
  useEffect(() => {
    if (draftCache) draftCache.current[key] = state;
  }, [draftCache, key, state]);
  const dirty = JSON.stringify(state.draft) !== JSON.stringify(state.saved);
  const patch = values => { setError(""); setState(current => ({ ...current, draft: { ...current.draft, ...values } })); };
  const reset = () => { setError(""); setState(current => ({ ...current, draft: current.saved })); };
  const save = async () => {
    if (lock.current || !dirty) return;
    const snapshot = normalizePromotion(key, state.draft);
    lock.current = true; setBusy(true); setError("");
    try {
      const payload = { ...(settings[key] || {}), ...snapshot };
      await upsertSetting(key, payload);
      setState({ draft: snapshot, saved: snapshot });
      onSaved?.(key, payload);
      toast.success("Pengaturan disimpan.");
    } catch {
      setError("Belum berhasil disimpan. Isianmu tetap aman; coba simpan lagi.");
      toast.error("Pengaturan belum berhasil disimpan.");
    } finally { lock.current = false; setBusy(false); }
  };
  return { ...state, dirty, busy, error, patch, reset, save };
}

function SaveRow({ editor, name, invalid = false }) {
  return <div className="sps-saveRow">
    <span role="status" className={editor.error ? "sps-error" : "sps-saveHint"}>{editor.error || (editor.busy ? "Menyimpan…" : editor.dirty ? "Ada perubahan yang belum disimpan" : "Sesuai pengaturan tersimpan")}</span>
    <div>{editor.dirty && <button type="button" className="sps-textButton" disabled={editor.busy} onClick={editor.reset} aria-label={`Batalkan perubahan ${name}`}><Undo2 size={14}/>Batalkan</button>}
      <button type="button" className="sps-saveButton" disabled={!editor.dirty || editor.busy || invalid} onClick={editor.save}>{editor.busy ? <LoaderCircle className="sps-spin" size={16}/> : <Save size={16}/>}Simpan {name}</button>
    </div>
  </div>;
}

function ChannelHeader({ icon: Icon, title, subtitle, editor, label }) {
  const id = useId();
  return <div className="sps-channelHead">
    <span className="sps-channelIcon" aria-hidden="true"><Icon size={21}/></span>
    <div><h3 id={id}>{title}</h3><p>{subtitle}</p></div>
    <button type="button" className={`sps-switch ${editor.draft.enabled ? "is-on" : ""}`} role="switch" aria-label={`Aktifkan ${label}`} aria-checked={editor.draft.enabled} disabled={editor.busy} onClick={() => editor.patch({ enabled: !editor.draft.enabled })}><span/><small>{editor.draft.enabled ? "Aktif" : "Nonaktif"}</small></button>
  </div>;
}

function TextField({ label, field, editor, placeholder, hint, error, maxLength, multiline = false }) {
  const id = useId();
  const props = { id, className: "input", value: editor.draft[field], maxLength, placeholder, disabled: editor.busy, "aria-invalid": Boolean(error), "aria-describedby": `${id}-hint`, onChange: event => editor.patch({ [field]: event.target.value }) };
  return <div className="sps-field"><label htmlFor={id}>{label}</label>{multiline ? <textarea {...props} rows={3}/> : <input {...props}/>}
    <small id={`${id}-hint`} className={error ? "sps-error" : ""}>{error || hint}</small>
  </div>;
}

function previewStatus(editor) {
  if (editor.dirty) return editor.draft.enabled ? "Aktif setelah disimpan" : "Nonaktif setelah disimpan";
  return editor.saved.enabled ? "Aktif di toko" : "Nonaktif";
}

export default function StorefrontPromotionSettings({ settings = {}, products = [], flashSales = [], onSaved, onManageFlashSales, onManageProducts, draftCache }) {
  const flash = usePromotionDraft("flash_sale_popup", settings, onSaved, draftCache);
  const academic = usePromotionDraft("academic_popup", settings, onSaved, draftCache);
  const popup = usePromotionDraft("new_product_popup", settings, onSaved, draftCache);
  const serviceBanner = usePromotionDraft("service_banner", settings, onSaved, draftCache);
  const banner = usePromotionDraft("new_product_banner", settings, onSaved, draftCache);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const active = useMemo(() => products.filter(p => p.is_active !== false), [products]);
  const productOptions = useMemo(() => active.map(p => ({ value: String(p.id), label: p.name, icon: p.icon_url, description: resolveProductCategory(p).label })), [active]);
  const popupProduct = active.find(p => String(p.id) === popup.draft.product_id);
  const bannerProduct = active.find(p => String(p.id) === banner.draft.product_id);
  const popupCopy = resolvePromotionCopy(popup.draft, popupProduct), bannerCopy = resolveBannerCopy(banner.draft, products, flashSales, now);
  const popupErrors = validatePromotion("new_product_popup", popup.draft, products);
  const serviceErrors = validatePromotion("service_banner", serviceBanner.draft, products);
  const bannerErrors = validatePromotion("new_product_banner", banner.draft, products);
  const readySales = readyFlashPromotions(flashSales, products, now);
  const academicCount = active.filter(isAcademicProduct).length;
  const selectProduct = (editor, productId, kind) => {
    const previous = active.find(p => String(p.id) === editor.draft.product_id);
    const previousCopy = productPromotionCopy(previous);
    const patch = { product_id: productId };
    for (const field of kind === "popup" ? ["title", "description", "link"] : ["text", "link"]) {
      if (editor.draft[field] === previousCopy[field]) patch[field] = "";
    }
    editor.patch(patch);
  };

  return <section className="sps-settings" aria-labelledby="sps-title">
    <div className="sps-intro"><span className="sps-eyebrow">Pengumuman toko</span><h2 id="sps-title">Beri kabar yang tepat ke pelanggan.</h2><p>Pop-up muncul sebagai jendela di atas halaman. Banner adalah baris pengumuman di bagian paling atas toko.</p>
      <ol className="sps-guide"><li><b>1</b>Pilih pengumuman</li><li><b>2</b>Atur & lihat pratinjau</li><li><b>3</b>Aktifkan, lalu simpan</li></ol>
      <div className="sps-info"><CircleHelp size={16}/><span>Semua jenis nonaktif secara bawaan. Mengubah sakelar belum mengubah toko sampai kamu menekan Simpan.</span></div>
    </div>

    <div className="sps-sectionTitle"><h2>Pop-up otomatis</h2><p>Cukup aktifkan. Isi mengikuti promo dan katalog yang tersedia.</p></div>
    <div className="sps-autoGrid">
      <article className="sps-channel">
        <ChannelHeader icon={Zap} title="Flash sale" subtitle="Kenalkan diskon yang sedang berlangsung." editor={flash} label="pop-up flash sale"/>
        <div className="sps-autoBody"><span className="sps-location"><Monitor size={14}/>Beranda saja</span><p>Produk, harga diskon, dan batas waktu diambil otomatis dari menu Flash Sale.</p>
          <div className={`sps-readiness ${!readySales.length ? "is-waiting" : ""}`}><span/>{readySales.length ? `${readySales.length} promo siap ditampilkan` : "Menunggu flash sale aktif dengan stok tersedia"}</div>
          {!readySales.length && <small>Boleh diaktifkan sekarang. Pop-up akan muncul ketika ada promo yang siap tayang.</small>}
          <button type="button" className="sps-textButton" onClick={onManageFlashSales}>Kelola flash sale →</button>
        </div><SaveRow editor={flash} name="flash sale"/>
      </article>
      <article className="sps-channel">
        <ChannelHeader icon={BookOpen} title="Jasa akademik" subtitle="Kenalkan layanan untuk kebutuhan kampus." editor={academic} label="pop-up jasa akademik"/>
        <div className="sps-autoBody"><span className="sps-location"><Monitor size={14}/>Beranda saja</span><p>Nama layanan, logo, dan harga diambil otomatis dari produk kategori Jasa Akademik.</p>
          <div className={`sps-readiness ${!academicCount ? "is-waiting" : ""}`}><span/>{academicCount ? `${academicCount} layanan aktif tersedia` : "Belum ada layanan akademik aktif"}</div>
          {!academicCount && <small>Tambahkan atau aktifkan layanan di katalog agar pop-up bisa ditampilkan.</small>}
          <button type="button" className="sps-textButton" onClick={onManageProducts}>Kelola produk →</button>
        </div><SaveRow editor={academic} name="jasa akademik"/>
      </article>
    </div>

    <article className="sps-channel">
      <ChannelHeader icon={Sparkles} title="Pop-up produk baru" subtitle="Tampilkan logo, harga mulai, dan tombol menuju produk." editor={popup} label="pop-up produk baru"/>
      <div className="sps-editorLayout"><div className="sps-editor">
        <div className="sps-step"><span>1</span><h4>Pilih produk</h4></div>
        <AdminPicker label="Produk untuk pop-up" value={popup.draft.product_id} options={productOptions} disabled={popup.busy} onChange={id => selectProduct(popup, id, "popup")} placeholder="Cari produk yang ingin dikenalkan"/>
        <small role={popupErrors.product_id ? "alert" : undefined} className={popupErrors.product_id ? "sps-error" : "sps-help"}>{popupErrors.product_id || "Logo dan harga mengikuti produk. Judul dan tautan diisi otomatis jika tidak disesuaikan."}</small>
        <div className="sps-step"><span>2</span><h4>Tentukan tempat tayang</h4></div>
        <fieldset className="sps-targets"><legend className="sps-srOnly">Halaman tayang pop-up produk baru</legend>{[{ value: "home", title: "Beranda saja", note: "Pilihan yang paling sederhana" }, { value: "all", title: "Semua halaman toko", note: "Admin & pembayaran tetap dikecualikan" }].map(item => <label key={item.value} className={popup.draft.show_on === item.value ? "is-selected" : ""}><input type="radio" name="sps-show-on" value={item.value} checked={popup.draft.show_on === item.value} disabled={popup.busy} onChange={() => popup.patch({ show_on: item.value })}/><span><strong>{item.title}</strong><small>{item.note}</small></span></label>)}</fieldset>
        <details className="sps-customize"><summary>Sesuaikan teks & tombol <span>Opsional</span></summary><div>
          <TextField label="Judul" field="title" editor={popup} placeholder={popupCopy.title} hint="Kosongkan agar judul mengikuti produk." maxLength={90}/>
          <TextField label="Deskripsi singkat" field="description" editor={popup} placeholder={productPromotionCopy(popupProduct).description} hint="Kosongkan untuk menggunakan ringkasan deskripsi produk." multiline maxLength={240}/>
          <div className="sps-fieldsPair"><TextField label="Label kecil" field="badge" editor={popup} placeholder="PRODUK BARU" hint="Contoh: BARU atau FAVORIT." maxLength={24}/><TextField label="Tulisan tombol" field="button_text" editor={popup} placeholder="Lihat produknya" hint="Teks yang mengajak pelanggan membuka produk." maxLength={40}/></div>
          <TextField label="Tujuan tombol" field="link" editor={popup} placeholder={productPromotionCopy(popupProduct).link} hint="Kosongkan untuk menuju produk pilihan. Bisa memakai https:// untuk tautan lain." error={popupErrors.link} maxLength={500}/>
          <button type="button" className="sps-textButton" disabled={popup.busy} onClick={() => popup.patch({ title: "", description: "", badge: "PRODUK BARU", button_text: "Lihat produknya", link: "" })}><Undo2 size={14}/>Gunakan teks otomatis</button>
        </div></details>
        {popupErrors.link && <p className="sps-error" role="alert">Tautan tujuan tombol belum valid. Periksa bagian Sesuaikan teks & tombol.</p>}
      </div><aside className="sps-preview" aria-label="Pratinjau pop-up produk baru"><div className="sps-previewLabel">Pratinjau <span>{previewStatus(popup)}</span></div><div className="sps-popupStage"><div className="np-popup-card sps-popupSample"><span className="sps-previewClose" aria-hidden="true"><X size={16}/></span><NewProductPopupContent config={popup.draft} product={popupProduct} preview/></div></div><p>Pratinjau tidak mengaktifkan pop-up di toko. Harga mengikuti paket yang tersedia.</p></aside></div>
      <SaveRow editor={popup} name="pop-up produk baru" invalid={Object.keys(popupErrors).length > 0}/>
    </article>

    <div className="sps-sectionTitle"><h2>Banner atas website</h2><p>Pilih pesan banner dan informasi layanan yang ingin ditampilkan di baris paling atas website.</p></div>

    <article className="sps-channel">
      <ChannelHeader icon={ShieldCheck} title="Banner info layanan" subtitle="Informasi garansi, kecepatan proses, atau metode pembayaran (banner info layanan toko)." editor={serviceBanner} label="banner info layanan"/>
      <div className="sps-editorLayout"><div className="sps-editor">
        <div className="sps-step"><span>1</span><h4>Tulis pesan informasi</h4></div>
        <TextField label="Pesan banner" field="text" editor={serviceBanner} placeholder="Proses 5–30 menit · Garansi replace · Checkout QRIS" hint="Pesan ringkas yang menginfokan layanan toko ke pelanggan." error={serviceErrors.text} maxLength={160}/>

        <div className="sps-step"><span>2</span><h4>Pilih gaya tampilan banner</h4></div>
        <div className="sps-styleChoices" role="group" aria-label="Gaya tampilan banner info layanan">
          {BANNER_STYLES.map(style => (
            <button
              type="button"
              key={style.id}
              disabled={serviceBanner.busy}
              className={`sps-choiceCard ${serviceBanner.draft.banner_style === style.id ? "is-selected" : ""}`}
              aria-pressed={serviceBanner.draft.banner_style === style.id}
              onClick={() => serviceBanner.patch({ banner_style: style.id })}
            >
              <div className="sps-choiceCardHead">
                <strong>{style.label}</strong>
                {serviceBanner.draft.banner_style === style.id && <Check size={14} className="sps-checkIcon" />}
              </div>
              <small>{style.description}</small>
            </button>
          ))}
        </div>

        <div className="sps-step"><span>3</span><h4>Karakter grafis maskot</h4></div>
        <div className="sps-graphicChoices" role="group" aria-label="Karakter grafis maskot banner info layanan">
          {BANNER_GRAPHICS.map(item => (
            <button
              type="button"
              key={item.id}
              disabled={serviceBanner.busy}
              className={`sps-graphicBtn ${serviceBanner.draft.graphic === item.id ? "is-selected" : ""}`}
              aria-pressed={serviceBanner.draft.graphic === item.id}
              onClick={() => serviceBanner.patch({ graphic: item.id })}
            >
              <div className="sps-graphicSample">
                <BannerGraphic name={item.id} height={20} />
              </div>
              <div className="sps-graphicMeta">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </div>
              {serviceBanner.draft.graphic === item.id && <Check size={14} className="sps-checkIcon" />}
            </button>
          ))}
        </div>

        <div className="sps-step"><span>4</span><h4>Pilih warna</h4></div>
        <div className="sps-colorChoices" role="group" aria-label="Warna banner info layanan">
          {BANNER_COLORS.map(color => (
            <button
              type="button"
              key={color.id}
              disabled={serviceBanner.busy}
              aria-pressed={serviceBanner.draft.color === color.id}
              onClick={() => serviceBanner.patch({ color: color.id })}
            >
              <i style={{ background: color.color }}/>
              {color.label}
              {serviceBanner.draft.color === color.id && <Check size={14}/>}
            </button>
          ))}
        </div>

        <div className="sps-step"><span>5</span><h4>Pilih ikon banner (opsional)</h4></div>
        <div className="sps-iconChoices" role="group" aria-label="Ikon banner info layanan">
          {BANNER_ICONS.map(icon => (
            <button
              type="button"
              key={icon.id}
              disabled={serviceBanner.busy}
              className={`sps-iconBtn ${serviceBanner.draft.icon === icon.id ? "is-selected" : ""}`}
              aria-pressed={serviceBanner.draft.icon === icon.id}
              onClick={() => serviceBanner.patch({ icon: icon.id })}
            >
              <BannerIcon name={icon.id} />
              <span>{icon.label}</span>
              {serviceBanner.draft.icon === icon.id && <Check size={13} className="sps-checkIcon" />}
            </button>
          ))}
        </div>

        <div className="sps-step"><span>6</span><h4>Gaya teks tautan</h4></div>
        <div className="sps-linkChoices" role="group" aria-label="Gaya teks tautan banner info layanan">
          {BANNER_LINK_STYLES.map(ls => (
            <button
              type="button"
              key={ls.id}
              disabled={serviceBanner.busy}
              className={`sps-linkChoiceBtn ${serviceBanner.draft.link_style === ls.id ? "is-selected" : ""}`}
              aria-pressed={serviceBanner.draft.link_style === ls.id}
              onClick={() => serviceBanner.patch({ link_style: ls.id })}
            >
              <span className={`sps-linkPreview promo-tickerLink promo-tickerLink--${ls.id}`}>{ls.label}</span>
              {serviceBanner.draft.link_style === ls.id && <Check size={13} className="sps-checkIcon" />}
            </button>
          ))}
        </div>

        <details className="sps-customize"><summary>Sesuaikan label & tautan <span>Opsional</span></summary><div>
          <TextField label="Label banner" field="badge" editor={serviceBanner} placeholder="INFO" hint="Label kecil di depan teks (kosongkan jika tidak ingin badge)." maxLength={16}/>
          <TextField label="Tujuan saat banner diklik" field="link" editor={serviceBanner} placeholder="/produk" hint="Kosongkan untuk mengarah ke katalog (/produk)." error={serviceErrors.link} maxLength={500}/>
        </div></details>
        {serviceErrors.link && <p className="sps-error" role="alert">Tautan banner belum valid. Periksa bagian Sesuaikan label & tautan.</p>}
      </div><aside className="sps-preview" aria-label="Pratinjau banner info layanan"><div className="sps-previewLabel">Pratinjau <span>{previewStatus(serviceBanner)}</span></div><div className="sps-bannerStage"><div className={`promo-ticker promo-ticker--service promo-ticker--color-${serviceBanner.draft.color || "green"} promo-ticker--style-${serviceBanner.draft.banner_style || "minimal_border"}`}><p className="promo-tickerItem"><BannerIcon name={serviceBanner.draft.icon} />{serviceBanner.draft.badge ? <span className="promo-tickerBadge">{serviceBanner.draft.badge}</span> : null}<span className={`promo-tickerLink promo-tickerLink--${serviceBanner.draft.link_style || "underline"}`}>{serviceBanner.draft.text || "Proses 5–30 menit · Garansi replace · Checkout QRIS"}</span><BannerGraphic name={serviceBanner.draft.graphic || "shield_star"} height={20} /></p><span className="sps-previewClose" aria-hidden="true"><X size={14} strokeWidth={2.4}/></span></div><div className="sps-navbarSample"><strong>IMZAQI STORE</strong><span>Beranda · Katalog</span></div><div className="sps-pageSample"><span/><span/><span/></div></div><p>{serviceBanner.draft.enabled ? <>Pelanggan dapat menutup banner. Klik pada pesannya akan membuka <strong>{serviceBanner.draft.link || "/produk"}</strong>.</> : "Banner ini nonaktif dan tidak akan ditampilkan di toko."}</p></aside></div>
      <SaveRow editor={serviceBanner} name="banner info layanan" invalid={Object.keys(serviceErrors).length > 0}/>
    </article>

    <article className="sps-channel">
      <ChannelHeader icon={Megaphone} title="Banner atas toko" subtitle="Pilih satu pesan untuk baris teratas toko. Banner flash sale mengambil promo aktif secara otomatis." editor={banner} label="banner atas toko"/>
      <div className="sps-editorLayout"><div className="sps-editor">
        <div className="sps-step"><span>1</span><h4>Pilih jenis banner</h4></div>
        <fieldset className="sps-bannerKinds"><legend className="sps-srOnly">Jenis banner atas toko</legend>{BANNER_TYPES.map(type => <label key={type.id} className={banner.draft.type === type.id ? "is-selected" : ""}><input type="radio" name="sps-banner-type" value={type.id} checked={banner.draft.type === type.id} disabled={banner.busy} onChange={() => banner.patch({ type: type.id, product_id: "", text: "", badge: "", link: "" })}/><span><strong>{type.label}</strong> <small>{type.description}</small></span></label>)}</fieldset>
        <div className="sps-step"><span>2</span><h4>{banner.draft.type === "product" ? "Pilih produk" : banner.draft.type === "custom" ? "Tulis pengumuman" : "Konten otomatis"}</h4></div>
        {banner.draft.type === "product" && <><AdminPicker label="Produk untuk banner" value={banner.draft.product_id} disabled={banner.busy} options={productOptions} onChange={id => selectProduct(banner, id, "banner")} placeholder="Cari produk yang ingin dikenalkan"/><small role={bannerErrors.product_id ? "alert" : undefined} className={bannerErrors.product_id ? "sps-error" : "sps-help"}>{bannerErrors.product_id || "Pesan dan tautan mengikuti produk pilihan. Kamu bisa menyesuaikannya di bawah."}</small><TextField label="Pesan pengumuman" field="text" editor={banner} placeholder={bannerCopy.text} hint="Kosongkan untuk memakai pesan otomatis dari produk." maxLength={160}/></>}
        {banner.draft.type === "custom" && <TextField label="Pesan pengumuman" field="text" editor={banner} placeholder="Contoh: Layanan baru tersedia hari ini!" hint="Tulis pesan singkat yang ingin dilihat pelanggan." error={bannerErrors.text} maxLength={160}/>}
        {banner.draft.type === "flash" && <div className={`sps-readiness ${!readySales.length ? "is-waiting" : ""}`}><span/>{readySales.length ? `${readySales.length} promo aktif siap ditampilkan. Diskon terbesar dipilih otomatis.` : "Belum ada flash sale aktif. Banner akan muncul saat promo tersedia."}</div>}
        {banner.draft.type === "academic" && <div className={`sps-readiness ${!academicCount ? "is-waiting" : ""}`}><span/>{academicCount ? `${academicCount} layanan tersedia. Banner menuju layanan pertama di katalog.` : "Belum ada jasa akademik aktif. Banner akan muncul saat layanan tersedia."}</div>}

        <div className="sps-step"><span>3</span><h4>Pilih gaya tampilan banner</h4></div>
        <div className="sps-styleChoices" role="group" aria-label="Gaya tampilan banner atas toko">
          {BANNER_STYLES.map(style => (
            <button
              type="button"
              key={style.id}
              disabled={banner.busy}
              className={`sps-choiceCard ${banner.draft.banner_style === style.id ? "is-selected" : ""}`}
              aria-pressed={banner.draft.banner_style === style.id}
              onClick={() => banner.patch({ banner_style: style.id })}
            >
              <div className="sps-choiceCardHead">
                <strong>{style.label}</strong>
                {banner.draft.banner_style === style.id && <Check size={14} className="sps-checkIcon" />}
              </div>
              <small>{style.description}</small>
            </button>
          ))}
        </div>

        <div className="sps-step"><span>4</span><h4>Karakter grafis maskot</h4></div>
        <div className="sps-graphicChoices" role="group" aria-label="Karakter grafis maskot banner atas toko">
          {BANNER_GRAPHICS.map(item => (
            <button
              type="button"
              key={item.id}
              disabled={banner.busy}
              className={`sps-graphicBtn ${banner.draft.graphic === item.id ? "is-selected" : ""}`}
              aria-pressed={banner.draft.graphic === item.id}
              onClick={() => banner.patch({ graphic: item.id })}
            >
              <div className="sps-graphicSample">
                <BannerGraphic name={item.id} height={20} />
              </div>
              <div className="sps-graphicMeta">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </div>
              {banner.draft.graphic === item.id && <Check size={14} className="sps-checkIcon" />}
            </button>
          ))}
        </div>

        <div className="sps-step"><span>5</span><h4>Pilih warna</h4></div>
        <div className="sps-colorChoices" role="group" aria-label="Warna banner">{BANNER_COLORS.map(color => <button type="button" key={color.id} disabled={banner.busy} aria-pressed={banner.draft.color === color.id} onClick={() => banner.patch({ color: color.id })}><i style={{ background: color.color }}/>{color.label}{banner.draft.color === color.id && <Check size={14}/>}</button>)}</div>

        <div className="sps-step"><span>6</span><h4>Pilih ikon banner (opsional)</h4></div>
        <div className="sps-iconChoices" role="group" aria-label="Ikon banner atas toko">
          {BANNER_ICONS.map(icon => (
            <button
              type="button"
              key={icon.id}
              disabled={banner.busy}
              className={`sps-iconBtn ${banner.draft.icon === icon.id ? "is-selected" : ""}`}
              aria-pressed={banner.draft.icon === icon.id}
              onClick={() => banner.patch({ icon: icon.id })}
            >
              <BannerIcon name={icon.id} />
              <span>{icon.label}</span>
              {banner.draft.icon === icon.id && <Check size={13} className="sps-checkIcon" />}
            </button>
          ))}
        </div>

        <div className="sps-step"><span>7</span><h4>Gaya teks tautan</h4></div>
        <div className="sps-linkChoices" role="group" aria-label="Gaya teks tautan banner atas toko">
          {BANNER_LINK_STYLES.map(ls => (
            <button
              type="button"
              key={ls.id}
              disabled={banner.busy}
              className={`sps-linkChoiceBtn ${banner.draft.link_style === ls.id ? "is-selected" : ""}`}
              aria-pressed={banner.draft.link_style === ls.id}
              onClick={() => banner.patch({ link_style: ls.id })}
            >
              <span className={`sps-linkPreview promo-tickerLink promo-tickerLink--${ls.id}`}>{ls.label}</span>
              {banner.draft.link_style === ls.id && <Check size={13} className="sps-checkIcon" />}
            </button>
          ))}
        </div>

        <details className="sps-customize"><summary>Sesuaikan label & tautan <span>Opsional</span></summary><div>
          <TextField label="Label banner" field="badge" editor={banner} placeholder={bannerCopy.badge} hint="Label singkat di depan pesan." maxLength={16}/>
          {(banner.draft.type === "product" || banner.draft.type === "custom") && <TextField label="Tujuan saat banner diklik" field="link" editor={banner} placeholder={bannerCopy.link} hint={banner.draft.type === "product" ? "Kosongkan untuk menuju produk pilihan." : "Kosongkan untuk menuju katalog."} error={bannerErrors.link} maxLength={500}/>}
        </div></details>
        {bannerErrors.link && <p className="sps-error" role="alert">Tautan banner belum valid. Periksa bagian Sesuaikan label & tautan.</p>}
      </div><aside className="sps-preview" aria-label="Pratinjau banner"><div className="sps-previewLabel">Pratinjau <span>{previewStatus(banner)}</span></div><div className="sps-bannerStage"><div className={`promo-ticker promo-ticker--newProduct promo-ticker--color-${banner.draft.color || "orange"} promo-ticker--style-${banner.draft.banner_style || "minimal_border"}`}><p className="promo-tickerItem"><BannerIcon name={banner.draft.icon} />{bannerCopy.badge ? <span className="promo-tickerBadge">{bannerCopy.badge}</span> : null}<span className={`promo-tickerLink promo-tickerLink--${banner.draft.link_style || "underline"}`}>{bannerCopy.text}</span><BannerGraphic name={banner.draft.graphic || "bell_megaphone"} height={20} /></p><span className="sps-previewClose" aria-hidden="true"><X size={14} strokeWidth={2.4}/></span></div><div className="sps-navbarSample"><strong>IMZAQI STORE</strong><span>Beranda · Katalog</span></div><div className="sps-pageSample"><span/><span/><span/></div></div><p>{bannerCopy.available ? <>Pelanggan bisa menutup banner. Klik pada pesannya akan membuka <strong>{bannerCopy.link}</strong>.</> : "Banner otomatis akan tampil saat kontennya tersedia."}</p></aside></div>
      <SaveRow editor={banner} name="banner" invalid={Object.keys(bannerErrors).length > 0}/>
    </article>
    <p className="sps-footnote">Pop-up dapat ditutup dan tidak diulang dalam sesi yang sama. Admin dan halaman pembayaran tidak menampilkan pop-up.</p>
  </section>;
}
