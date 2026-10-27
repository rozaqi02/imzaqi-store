/**
 * Kompresi gambar client-side via HTML5 Canvas sebelum upload.
 * Mereduksi ukuran file kamera/screenshot dari MB menjadi KB tanpa menurunkan ketajaman visual.
 *
 * @param {File} file
 * @param {{ maxWidth?: number, maxHeight?: number, quality?: number, mimeType?: string }} options
 * @returns {Promise<File>}
 */
export async function compressImage(file, options = {}) {
  if (!file || typeof window === "undefined" || !file.type || !file.type.startsWith("image/")) {
    return file;
  }
  // Lewati SVG dan GIF untuk menjaga animasi / vektor
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return file;
  }

  const maxWidth = options.maxWidth || 1200;
  const maxHeight = options.maxHeight || 1200;
  const quality = options.quality !== undefined ? options.quality : 0.82;
  const outputType = options.mimeType || (file.type === "image/png" ? "image/png" : "image/jpeg");

  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onerror = () => resolve(file);
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => resolve(file);
        img.onload = () => {
          let { width, height } = img;

          // Jika gambar sudah kecil (< 250KB) dan resolusi aman, lewati kompresi
          if (width <= maxWidth && height <= maxHeight && file.size <= 250 * 1024) {
            return resolve(file);
          }

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(file);

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (!blob || blob.size >= file.size) {
                return resolve(file);
              }
              const compressedFile = new File([blob], file.name, {
                type: outputType,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            outputType,
            quality
          );
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    } catch {
      resolve(file);
    }
  });
}
