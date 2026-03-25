import QRCode from "qrcode";

function parseTLV(payload) {
  const fields = [];
  let cursor = 0;

  while (cursor < payload.length) {
    if (cursor + 4 > payload.length) {
      throw new Error("Payload QRIS tidak lengkap.");
    }

    const id = payload.slice(cursor, cursor + 2);
    const lengthText = payload.slice(cursor + 2, cursor + 4);
    const length = Number(lengthText);

    if (!Number.isInteger(length)) {
      throw new Error(`Panjang field QRIS tidak valid untuk tag ${id}.`);
    }

    cursor += 4;
    const value = payload.slice(cursor, cursor + length);
    if (value.length !== length) {
      throw new Error(`Nilai field QRIS tidak lengkap untuk tag ${id}.`);
    }

    fields.push({ id, value });
    cursor += length;
  }

  return fields;
}

function serializeTLV(fields) {
  return fields.map(({ id, value }) => `${id}${String(value.length).padStart(2, "0")}${value}`).join("");
}

function crc16CcittFalse(text) {
  let crc = 0xffff;

  for (let index = 0; index < text.length; index += 1) {
    crc ^= text.charCodeAt(index) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function normalizeAmount(amount) {
  const rounded = Math.round(Number(amount || 0));
  if (!Number.isFinite(rounded) || rounded <= 0) {
    throw new Error("Nominal QRIS tidak valid.");
  }

  return String(rounded);
}

export function buildDynamicQrisPayload(basePayload, amount) {
  const raw = String(basePayload || "").trim();
  if (!raw) throw new Error("REACT_APP_QRIS_BASE belum diisi.");

  const fields = parseTLV(raw).filter((field) => field.id !== "63" && field.id !== "54");
  const amountText = normalizeAmount(amount);

  const pointOfInitiationIndex = fields.findIndex((field) => field.id === "01");
  if (pointOfInitiationIndex >= 0) {
    fields[pointOfInitiationIndex] = { ...fields[pointOfInitiationIndex], value: "12" };
  } else {
    fields.splice(1, 0, { id: "01", value: "12" });
  }

  const currencyIndex = fields.findIndex((field) => field.id === "53");
  const countryIndex = fields.findIndex((field) => field.id === "58");
  const amountInsertIndex =
    currencyIndex >= 0 ? currencyIndex + 1 : countryIndex >= 0 ? countryIndex : fields.length;

  fields.splice(amountInsertIndex, 0, { id: "54", value: amountText });

  const payloadWithoutCrc = `${serializeTLV(fields)}6304`;
  return `${payloadWithoutCrc}${crc16CcittFalse(payloadWithoutCrc)}`;
}

export async function buildDynamicQrisImage(basePayload, amount) {
  const payload = buildDynamicQrisPayload(basePayload, amount);
  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 480,
    color: {
      dark: "#0C221D",
      light: "#FFFFFF",
    },
  });

  return { dataUrl, payload };
}
