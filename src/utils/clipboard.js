/**
 * Safely copies text to the clipboard.
 * Supports modern Clipboard API (HTTPS/localhost) and falls back to document.execCommand('copy') in insecure HTTP contexts.
 * @param {string} text - The text to copy.
 * @returns {Promise<void>}
 */
export function copyToClipboard(text) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("DOM is not available"));
  }

  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  // Fallback for non-secure contexts (e.g. accessing over local IP network on HTTP)
  return new Promise((resolve, reject) => {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      // Prevent scrolling page to bottom on focus
      area.style.position = "fixed";
      area.style.top = "0";
      area.style.left = "0";
      area.style.opacity = "0";
      area.style.pointerEvents = "none";
      
      document.body.appendChild(area);
      area.focus();
      area.select();
      
      const success = document.execCommand("copy");
      document.body.removeChild(area);
      
      if (success) {
        resolve();
      } else {
        reject(new Error("Copy command failed"));
      }
    } catch (err) {
      reject(err);
    }
  });
}
