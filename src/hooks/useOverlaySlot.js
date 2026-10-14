import { useEffect, useState } from "react";
import {
  OVERLAY_PRIORITY,
  getActiveOverlayId,
  releaseOverlaySlot,
  requestOverlaySlot,
  subscribeOverlays,
} from "../lib/overlayScheduler";

/**
 * Pesan satu slot overlay dari scheduler terpusat.
 *
 * Menggantikan pola lama "cek DOM popup lain + setTimeout retry": komponen cukup
 * menyatakan kapan ia siap (`ready`), dan scheduler yang memutuskan siapa tampil.
 *
 * @param {string} id  identitas overlay (lihat OVERLAY_PRIORITY)
 * @param {object} [options]
 * @param {boolean} [options.ready=true]    konten siap ditampilkan (data sudah dimuat)
 * @param {number}  [options.priority]      default diambil dari OVERLAY_PRIORITY[id]
 * @param {boolean} [options.enabled=true]  false = keluar dari antrean sepenuhnya
 * @returns {boolean} true hanya bila overlay ini pemegang slot saat ini
 */
export default function useOverlaySlot(id, { ready = true, priority, enabled = true } = {}) {
  const [activeId, setActiveId] = useState(getActiveOverlayId);
  const resolvedPriority = priority ?? OVERLAY_PRIORITY[id] ?? 0;

  useEffect(() => subscribeOverlays(() => setActiveId(getActiveOverlayId())), []);

  // Siklus hidup slot: terdaftar selama enabled, dilepas saat unmount/nonaktif.
  // Sengaja TIDAK bergantung pada `ready` agar perubahan ready tidak
  // melepas-lalu-mendaftar ulang slot (yang akan memberi celah ke overlay lain).
  useEffect(() => {
    if (!enabled) return undefined;
    requestOverlaySlot(id, { priority: resolvedPriority, ready });
    return () => releaseOverlaySlot(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, enabled]);

  // Sinkronkan opsi terbaru di tempat (update in place).
  useEffect(() => {
    if (!enabled) return;
    requestOverlaySlot(id, { priority: resolvedPriority, ready });
  }, [id, enabled, ready, resolvedPriority]);

  return enabled && activeId === id;
}

/**
 * True bila ADA overlay eksklusif yang sedang tampil.
 * Untuk overlay non-modal (banner keranjang, toast pencapaian) yang tidak ikut
 * berebut slot tetapi harus menunda diri agar tidak menumpuk di atas modal.
 */
export function useOverlayBusy() {
  const [busy, setBusy] = useState(() => getActiveOverlayId() !== null);

  useEffect(() => subscribeOverlays(() => setBusy(getActiveOverlayId() !== null)), []);

  return busy;
}
