const STORAGE_KEY = "imzaqi:catalog-scroll";
const RESTORE_LOCK_KEY = "imzaqi:catalog-restore-lock";

let memoryCache = null;
let restoreLockUntil = 0;

function readStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.y !== "number" || !Number.isFinite(parsed.y)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(data) {
  memoryCache = data;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Private mode or quota — in-memory fallback still works for same-tab navigation.
  }
}

function getSaved() {
  if (memoryCache) return memoryCache;
  const stored = readStorage();
  if (stored) memoryCache = stored;
  return stored;
}

export function hasSavedScrollY() {
  return getSaved() !== null;
}

export function isCatalogRestoreLocked() {
  if (Date.now() < restoreLockUntil) return true;
  try {
    return sessionStorage.getItem(RESTORE_LOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function shouldSkipCatalogScrollToTop() {
  return hasSavedScrollY() || isCatalogRestoreLocked();
}

export function beginCatalogRestoreLock(ms = 1200) {
  const until = Date.now() + ms;
  restoreLockUntil = Math.max(restoreLockUntil, until);
  try {
    sessionStorage.setItem(RESTORE_LOCK_KEY, "1");
  } catch {
    // ignore
  }
}

export function endCatalogRestoreLock() {
  restoreLockUntil = 0;
  try {
    sessionStorage.removeItem(RESTORE_LOCK_KEY);
  } catch {
    // ignore
  }
}

export function peekSavedScroll() {
  return getSaved();
}

export function consumeSavedScroll() {
  const data = getSaved();
  clearSavedScroll();
  return data;
}

export function clearSavedScroll() {
  memoryCache = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function isCatalogProductLink(href) {
  const value = String(href || "");
  if (!value.includes("/produk/")) return false;
  return /\/produk\/[^/?#]+/.test(value);
}

export function slugFromCatalogProductLink(href) {
  const match = String(href || "").match(/\/produk\/([^/?#]+)/);
  return match?.[1] || null;
}

export function saveScrollY({ slug, y } = {}) {
  beginCatalogRestoreLock(1200);
  const current = getSaved();
  writeStorage({
    y: typeof y === "number" && Number.isFinite(y) ? y : window.scrollY,
    search: window.location.search || "",
    slug: slug ?? current?.slug ?? null,
    ts: Date.now(),
  });
}

export function touchCatalogScrollY(y) {
  const current = getSaved();
  if (!current) return;
  if (typeof y !== "number" || !Number.isFinite(y)) return;
  writeStorage({ ...current, y, ts: Date.now() });
}

export function getCatalogReturnPath() {
  const saved = getSaved();
  if (saved?.search) return `/produk${saved.search}`;
  return "/produk";
}

export function restoreCatalogScroll({ y, slug } = {}, onDone) {
  if (typeof window === "undefined") return () => {};

  beginCatalogRestoreLock(1600);

  const prevRestoration = history.scrollRestoration;
  history.scrollRestoration = "manual";
  document.documentElement.classList.add("catalog-scroll-restore");

  let attempts = 0;
  const maxAttempts = 64;
  let stabilizeTimer = null;
  let releaseTimer = null;
  let resizeObserver = null;
  let done = false;

  const cleanup = () => {
    if (done) return;
    done = true;
    if (stabilizeTimer) window.clearTimeout(stabilizeTimer);
    if (releaseTimer) window.clearTimeout(releaseTimer);
    resizeObserver?.disconnect();
    document.documentElement.classList.remove("catalog-scroll-restore");
    history.scrollRestoration = prevRestoration;
    onDone?.();
  };

  const applyScroll = () => {
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const target = Math.min(Math.max(0, y), maxY);
    window.scrollTo({ top: target, left: 0, behavior: "auto" });
    return target;
  };

  const pageCanReachY = () => {
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (y <= maxY + 4) return true;
    if (!slug) return false;
    const el =
      document.getElementById(`catalog-card-${slug}`) ||
      document.querySelector(`[data-catalog-slug="${slug}"]`);
    return Boolean(el);
  };

  const tryRestore = () => {
    attempts += 1;

    if (!pageCanReachY() && attempts < maxAttempts) {
      requestAnimationFrame(tryRestore);
      return;
    }

    applyScroll();

    if (!resizeObserver && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        if (done) return;
        beginCatalogRestoreLock(900);
        applyScroll();
      });
      resizeObserver.observe(document.documentElement);
    }

    if (!stabilizeTimer) {
      stabilizeTimer = window.setTimeout(() => {
        applyScroll();
        beginCatalogRestoreLock(1200);
        releaseTimer = window.setTimeout(() => {
          applyScroll();
          cleanup();
        }, 520);
      }, 120);
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(tryRestore);
  });

  return cleanup;
}