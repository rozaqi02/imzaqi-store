import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

export function usePageView(path) {
  // Gunakan ref untuk mencegah double-count di React.StrictMode (development mode)
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    
    // Fungsi untuk menambah counter via RPC
    async function hit() {
      try {
        await supabase.rpc("increment_view");
      } catch (e) {
        console.error("Gagal update view", e);
      }
    }

    hit();
    initialized.current = true;
    
    // Reset ref jika path berubah (opsional, tergantung mau hitung per halaman atau per sesi)
    // Kalau mau hitung setiap ganti halaman, hapus baris "if (initialized...)" di atas 
    // dan biarkan useEffect jalan tiap [path] berubah.
  }, [path]);
}