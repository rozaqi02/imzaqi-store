let savedScrollY = null;

export function hasSavedScrollY() {
  return savedScrollY !== null;
}

export function consumeSavedScrollY() {
  const y = savedScrollY;
  savedScrollY = null;
  return y;
}

export function saveScrollY() {
  savedScrollY = window.scrollY;
}
