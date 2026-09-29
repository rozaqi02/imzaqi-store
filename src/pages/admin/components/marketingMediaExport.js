const imageCache = new Map();

export function loadMediaImage(src) {
  if (!src) return Promise.resolve(null);
  if (imageCache.has(src)) return imageCache.get(src);
  const promise = new Promise(resolve => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const finish = result => {
      clearTimeout(timer); image.onload = null; image.onerror = null;
      if (!result) imageCache.delete(src);
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), 8000);
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = src;
  });
  imageCache.set(src, promise);
  return promise;
}

export function canvasPng(canvas) {
  return new Promise((resolve, reject) => {
    try { canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Gambar gagal diekspor. Coba ulangi.")), "image/png"); }
    catch { reject(new Error("Gambar produk tidak mengizinkan ekspor. Coba produk lain.")); }
  });
}

export function downloadMedia(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// PNG is already compressed. A ZIP avoids browsers blocking multiple downloads.
export async function mediaZip(files) {
  const encode = new TextEncoder(), parts = [], directory = [];
  let offset = 0, dirSize = 0;
  for (const file of files) {
    const data = new Uint8Array(await file.blob.arrayBuffer()), name = encode.encode(file.name);
    let crc = -1;
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ -1) >>> 0;
    const local = new Uint8Array(30), l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x800, true);
    l.setUint32(14, crc, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true); l.setUint16(26, name.length, true);
    const central = new Uint8Array(46), c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    parts.push(local, name, data); directory.push(central, name);
    offset += local.length + name.length + data.length; dirSize += central.length + name.length;
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, dirSize, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...directory, end], { type: "application/zip" });
}
