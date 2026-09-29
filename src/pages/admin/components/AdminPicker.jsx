import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import "./AdminPicker.css";

const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function PickerIcon({ option }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [option?.icon]);
  return <span className="ap-icon" aria-hidden="true">
    {option?.icon && !failed ? <img src={option.icon} alt="" onError={() => setFailed(true)}/> : <span>{option?.label?.slice(0, 1).toUpperCase() || "·"}</span>}
  </span>;
}

/** Searchable single-select. Options retain the original value type for callers. */
export default function AdminPicker({ label, value, onChange, options = [], placeholder = "Pilih…", disabled = false }) {
  const id = useId(), listId = `${id}-list`, searchId = `${id}-search`;
  const [open, setOpen] = useState(false), [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0), [position, setPosition] = useState(null);
  const triggerRef = useRef(null), popupRef = useRef(null), searchRef = useRef(null);
  const selected = options.find(option => String(option.value) === String(value));
  const filtered = useMemo(() => {
    const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
    return options.filter(option => {
      const text = normalize([option.label, option.description, option.meta, option.status, option.searchText].filter(Boolean).join(" "));
      return terms.every(term => text.includes(term));
    });
  }, [options, query]);
  const index = Math.min(activeIndex, Math.max(0, filtered.length - 1));

  const close = (restoreFocus = false) => {
    setOpen(false); setQuery("");
    if (restoreFocus) triggerRef.current?.focus();
  };
  const choose = option => {
    onChange(option.value); close(true);
  };
  const show = (last = false) => {
    if (disabled) return;
    setQuery(""); setPosition(null);
    const selectedIndex = options.findIndex(option => String(option.value) === String(value));
    setActiveIndex(last ? Math.max(0, options.length - 1) : Math.max(0, selectedIndex));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (window.innerWidth <= 600) {
        const viewport = window.visualViewport;
        const keyboardInset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
        setPosition({ mobile: true, bottom: keyboardInset ? keyboardInset + 12 : undefined, maxHeight: Math.min(480, (viewport?.height || window.innerHeight) * .68) });
        return;
      }
      const width = Math.min(Math.max(rect.width, 340), window.innerWidth - 24);
      const below = window.innerHeight - rect.bottom - 20, above = rect.top - 20;
      const upwards = below < 280 && above > below;
      setPosition({ mobile: false, width, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), maxHeight: Math.max(160, Math.min(420, upwards ? above : below)), ...(upwards ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }) });
    };
    const outside = event => {
      if (!triggerRef.current?.contains(event.target) && !popupRef.current?.contains(event.target)) close();
    };
    const scroll = event => { if (!popupRef.current?.contains(event.target)) close(); };
    place();
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
    };
  }, [open]);
  const positioned = Boolean(position);
  useEffect(() => {
    if (open && positioned) searchRef.current?.focus();
  }, [open, positioned]);
  useEffect(() => {
    if (open && disabled) close();
  }, [disabled, open]);
  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${index}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, index, id]);

  const keyboard = event => {
    if (event.nativeEvent?.isComposing) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); }
    else if (event.key === "Tab") { close(true); }
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : event.key === "End" ? Math.max(0, filtered.length - 1) : Math.max(0, Math.min(filtered.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))));
    } else if (event.key === "Enter") { event.preventDefault(); if (filtered[index]) choose(filtered[index]); }
  };

  return <div className="admin-picker">
    <span className="ap-label" id={`${id}-label`}>{label}</span>
    <button ref={triggerRef} type="button" role="combobox" aria-labelledby={`${id}-label`} aria-describedby={`${id}-value`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} disabled={disabled} className={`ap-trigger ${open ? "is-open" : ""}`} onClick={() => open ? close() : show()} onKeyDown={event => {
      if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); if (open) searchRef.current?.focus(); else show(event.key === "ArrowUp"); }
    }}>
      {selected && <PickerIcon option={selected}/>}
      <span className="ap-triggerCopy" id={`${id}-value`}><strong>{selected?.label || placeholder}</strong>{selected?.description && <small>{selected.description}</small>}</span>
      {selected?.meta && <span className="ap-triggerMeta">{selected.meta}</span>}
      <ChevronDown size={16} aria-hidden="true"/>
    </button>
    {open && createPortal(<>
      {position?.mobile && <div className="ap-backdrop" aria-hidden="true" onPointerDown={() => close(true)}/>}
      <div ref={popupRef} className={`ap-popover ${position?.mobile ? "is-mobile" : ""}`} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); } }} style={position?.mobile ? { bottom: position.bottom, maxHeight: position.maxHeight } : position ? { left: position.left, top: position.top, bottom: position.bottom, width: position.width, maxHeight: position.maxHeight } : { visibility: "hidden" }}>
        <div className="ap-searchRow"><Search size={17} aria-hidden="true"/><input id={searchId} ref={searchRef} role="combobox" aria-label={`Cari ${label.toLowerCase()}`} aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={filtered.length ? `${id}-option-${index}` : undefined} value={query} placeholder="Cari nama produk, paket, atau harga…" autoComplete="off" onChange={event => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={keyboard}/><button type="button" className="ap-close" aria-label={`Tutup pilihan ${label.toLowerCase()}`} onClick={() => close(true)}><X size={17}/></button></div>
        <div id={listId} role="listbox" aria-label={label} className="ap-list">
          {filtered.map((option, i) => <div key={String(option.value)} id={`${id}-option-${i}`} role="option" aria-label={[option.label, option.description, option.status, option.meta].filter(Boolean).join(" ")} aria-selected={String(option.value) === String(value)} className={`ap-option ${i === index ? "is-highlighted" : ""}`} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>
            <PickerIcon option={option}/><span className="ap-optionCopy"><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}{option.status && <span className={`ap-status ${option.statusTone === "muted" ? "is-muted" : ""}`}>{option.status}</span>}</span><span className="ap-optionEnd">{option.meta && <strong>{option.meta}</strong>}{String(option.value) === String(value) && <Check size={17} aria-hidden="true"/>}</span>
          </div>)}
          {!filtered.length && <p className="ap-empty">Tidak ada pilihan yang cocok. Coba kata lain.</p>}
        </div>
        <div className="ap-footer">{filtered.length} pilihan<span>↑ ↓ pilih · Enter konfirmasi</span></div>
      </div>
    </>, document.body)}
  </div>;
}
