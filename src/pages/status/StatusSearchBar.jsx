import React from "react";
import { History, Search } from "lucide-react";
import { formatIDR } from "../../lib/format";
import { sanitizeOrderInput } from "./statusHelpers";

export default function StatusSearchBar({
  input,
  onChange,
  onSubmit,
  onPaste,
  loading,
  message = "",
  compact = false,
  recentOrders = [],
  onSelectOrder,
}) {
  return (
    <section className={`st-search${compact ? " st-search--compact" : ""}`}>
      {!compact ? (
        <div className="st-searchHead">
          <div>
            <div className="st-kicker">ID order</div>
            <h2 className="st-searchTitle">Masukkan ID pesanan</h2>
          </div>
        </div>
      ) : null}

      <div className="st-searchRow">
        <div className="st-inputWrap">
          <Search size={16} aria-hidden="true" />
          <button
            className="btn btn-ghost st-pasteBtn st-pasteBtn--inline"
            type="button"
            onClick={onPaste}
          >
            Tempel
          </button>
          <input
            className="input st-input"
            inputMode="search"
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            placeholder="IMZ-ABCD1234"
            aria-label="ID pesanan"
            aria-describedby="status-search-hint"
            aria-invalid={Boolean(message) || undefined}
            value={input}
            onChange={(e) => onChange(sanitizeOrderInput(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmit(input);
            }}
          />
        </div>

        <button
          className="btn st-checkBtn"
          type="button"
          onClick={() => onSubmit(input)}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="st-checkSpinner" aria-hidden="true" />
              Mencari...
            </>
          ) : (
            "Cek status"
          )}
        </button>
      </div>

      {!compact || message ? (
        <div
          id="status-search-hint"
          className={`st-searchHint${message ? " is-error" : ""}`}
          role="status"
        >
          {message || "Contoh: IMZ-ABCD1234 dari bukti konfirmasi pembayaran."}
        </div>
      ) : null}

      {compact && recentOrders.length > 0 ? (
        <div className="st-compactRecent" aria-label="Order tersimpan lain">
          <span className="st-compactRecentLabel">
            <History size={12} aria-hidden="true" />
            Lainnya:
          </span>
          <div className="st-compactRecentList">
            {recentOrders.map((r) => (
              <button
                key={r.order_code}
                type="button"
                className="st-recentChip st-recentChip--mini"
                onClick={() => onSelectOrder?.(r.order_code)}
              >
                <span className="st-recentCode">{r.order_code}</span>
                {r.total_idr ? <span className="st-recentPrice">{formatIDR(r.total_idr)}</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
