import React from "react";
import { ShieldCheck } from "lucide-react";
import "../css/pages/AdminGate.css";

export default function AdminLoader({ verifying = false }) {
  return (
        <div className="page admin-gate-page" role="status" aria-live="polite" aria-busy="true">
          <div className="admin-gate-bg" aria-hidden="true" />
          <div className="admin-gate-card">
            <div className="admin-gate-brand">
              <span className="admin-gate-logoWrap">
                <img className="admin-gate-logo" src="/icon.png" alt="" />
                <span className="admin-gate-ring" aria-hidden="true" />
              </span>
              <div className="admin-gate-brandCopy">
                <span className="admin-gate-kicker">
                  <ShieldCheck size={14} strokeWidth={2.4} aria-hidden="true" />
                  Admin
                </span>
                <strong>Imzaqi Store</strong>
              </div>
            </div>

            <div className="admin-gate-body">
              <div className="admin-gate-spinner" aria-hidden="true">
                <span />
              </div>
              <h1 className="admin-gate-title">{verifying ? "Memverifikasi akses" : "Menyiapkan halaman admin"}</h1>
              <p className="admin-gate-sub">
                {verifying ? "Mengecek sesi dan izin admin. Sebentar saja…" : "Memuat ruang kerja Anda. Sebentar saja…"}
              </p>
            </div>

            <div className="admin-gate-skeleton" aria-hidden="true">
              <div className="admin-gate-skel admin-gate-skel--nav" />
              <div className="admin-gate-skelRow">
                <div className="admin-gate-skel admin-gate-skel--stat" />
                <div className="admin-gate-skel admin-gate-skel--stat" />
                <div className="admin-gate-skel admin-gate-skel--stat" />
              </div>
              <div className="admin-gate-skel admin-gate-skel--panel" />
            </div>
          </div>
        </div>
  );
}
