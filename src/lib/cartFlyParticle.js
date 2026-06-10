const CART_SELECTOR = ".header-cart";

export function spawnCartFlyParticle(sourceRect) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const motion = document.documentElement.getAttribute("data-motion");
  if (reduce || motion === "off") return;

  const cartEl = document.querySelector(CART_SELECTOR);
  if (!cartEl || !sourceRect) return;

  const cartRect = cartEl.getBoundingClientRect();
  const sx = sourceRect.left + sourceRect.width / 2;
  const sy = sourceRect.top + sourceRect.height / 2;
  const tx = cartRect.left + cartRect.width / 2 - sx;
  const ty = cartRect.top + cartRect.height / 2 - sy;

  const particle = document.createElement("span");
  particle.className = "cart-fly-particle";
  particle.style.left = `${sx}px`;
  particle.style.top = `${sy}px`;
  particle.style.setProperty("--fly-tx", `${tx}px`);
  particle.style.setProperty("--fly-ty", `${ty}px`);
  document.body.appendChild(particle);

  window.setTimeout(() => particle.remove(), 700);
}