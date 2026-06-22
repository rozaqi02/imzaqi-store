export function warn(...args) {
  if (import.meta.env.DEV) console.warn(...args);
}

export function info(...args) {
  if (import.meta.env.DEV) console.info(...args);
}
