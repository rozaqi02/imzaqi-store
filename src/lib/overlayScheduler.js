// ─────────────────────────────────────────────────────────────────────────────
// Overlay scheduler — satu-satunya sumber kebenaran untuk "siapa yang boleh
// tampil sekarang".
//
// Masalah sebelumnya: setiap popup memeriksa popup lain lewat DOM query
// (document.querySelector(".ac-popup-backdrop, .fsp-backdrop")), flag global
// (window.__imzaqi_academic_popup_active), dan retry setTimeout(800ms).
// Rapuh: bergantung pada nama class, bisa lolos saat dua popup siap di tick
// yang sama, dan logikanya tersebar di banyak file.
//
// Kontrak baru (lihat hooks/useOverlaySlot.js):
//   const active = useOverlaySlot("flashSalePopup", { ready });
//   render hanya bila active === true
//
// Aturan:
//   • Maksimal 1 overlay eksklusif aktif pada satu waktu.
//   • Pemenang = priority tertinggi; seri dipecah oleh urutan registrasi.
//   • Winner bersifat "sticky": selama ia masih ready ia mempertahankan slot,
//     sehingga tidak ada kedip karena saling rebut antar popup.
//   • Saat pemenang melepas slot (ditutup / unmount / tidak ready), antrean
//     dihitung ulang dan kandidat berikutnya naik otomatis.
//   • Blocking rute sensitif (/checkout, /bayar, /admin) tetap ditangani
//     useStorefrontOverlayBlocked() — scheduler tidak menduplikasinya.
// ─────────────────────────────────────────────────────────────────────────────

/** Durasi tampilan yang dipakai komponen overlay. */
export const OVERLAY_TIMING = {
  flashSaleMs: 12000,
};

/**
 * Prioritas antrean. Angka lebih besar = lebih dulu ditampilkan.
 * Urutan ini sengaja: promo berbatas waktu > promo produk > edukasi.
 */
export const OVERLAY_PRIORITY = {
  flashSalePopup: 40,
  newProductPopup: 30,
  academicPopup: 20,
};

const state = {
  seq: 0,
  /** @type {Map<string, {id:string, seq:number, priority:number, ready:boolean}>} */
  requests: new Map(),
  winnerId: null,
};

const listeners = new Set();

function computeWinner() {
  // Sticky: pemenang bertahan selama masih terdaftar dan ready.
  const current = state.winnerId ? state.requests.get(state.winnerId) : null;
  if (current && current.ready) return current.id;

  let best = null;
  for (const request of state.requests.values()) {
    if (!request.ready) continue;
    if (!best) {
      best = request;
      continue;
    }
    if (request.priority > best.priority) best = request;
    else if (request.priority === best.priority && request.seq < best.seq) best = request;
  }
  return best ? best.id : null;
}

function notify() {
  for (const listener of listeners) {
    // Kesalahan satu listener tidak boleh memutus antrean overlay lain.
    try {
      listener();
    } catch {}
  }
}

function reschedule() {
  const next = computeWinner();
  if (next === state.winnerId) return;
  state.winnerId = next;
  notify();
}

/** Berlangganan perubahan pemenang. Mengembalikan fungsi unsubscribe. */
export function subscribeOverlays(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** ID overlay eksklusif yang sedang memegang slot, atau null. */
export function getActiveOverlayId() {
  return state.winnerId;
}

/**
 * Minta slot overlay. Aman dipanggil berulang dengan opsi baru (update in place,
 * urutan registrasi dipertahankan).
 * @returns {() => void} fungsi pelepas slot (idempotent).
 */
export function requestOverlaySlot(id, options = {}) {
  const existing = state.requests.get(id);
  state.requests.set(id, {
    id,
    seq: existing ? existing.seq : (state.seq += 1),
    priority: options.priority ?? OVERLAY_PRIORITY[id] ?? 0,
    ready: options.ready !== false,
  });
  reschedule();
  return () => releaseOverlaySlot(id);
}

/** Lepas slot sehingga kandidat berikutnya boleh naik. */
export function releaseOverlaySlot(id) {
  if (!state.requests.delete(id)) return;
  if (state.winnerId === id) state.winnerId = null;
  reschedule();
}

/** True bila overlay inilah pemegang slot saat ini. */
export function isOverlaySlotActive(id) {
  return state.winnerId === id;
}

/**
 * True bila ADA overlay eksklusif yang sedang tampil.
 * Dipakai overlay non-eksklusif (banner keranjang, toast pencapaian) untuk
 * menunda diri alih-alih menumpuk di atas modal.
 */
export function isOverlayBusy() {
  return state.winnerId !== null;
}
