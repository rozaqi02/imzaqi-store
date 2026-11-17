import { formatAdminDate, formatAdminDateTime, getSafeOrderItems, normalizeWhatsApp, toDateKeyWIB } from "./adminUtils";
import { ORDER_SEARCH_BATCH_SIZE } from "./adminPerf";

const WIB_FULL_MONTH_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Build lowercase WIB date strings (ISO, slash, dash, short & full month) for order search. */
export function getOrderDateSearchTokens(value) {
  if (!value) return [];
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return [];

  const dateKey = toDateKeyWIB(date); // YYYY-MM-DD in WIB
  const tokens = [
    formatAdminDate(date),
    formatAdminDateTime(date),
    WIB_FULL_MONTH_FORMATTER.format(date),
    dateKey,
  ];

  if (dateKey) {
    const [yyyy, mm, dd] = dateKey.split("-");
    const dayInt = String(Number(dd));
    const monthInt = String(Number(mm));
    tokens.push(
      `${dd}/${mm}/${yyyy}`,
      `${dd}-${mm}-${yyyy}`,
      `${dayInt}/${monthInt}/${yyyy}`,
      `${dd}/${mm}`,
      `${dd}-${mm}`
    );
  }

  return tokens;
}

const DAY_MONTH_PHRASE_RE =
  /\b\d{1,2}\s+(?:jan(?:uari)?|feb(?:ruari)?|mar(?:et)?|apr(?:il)?|mei|may|jun(?:i)?|jul(?:i)?|agu(?:stus)?|aug|sep(?:tember)?|okt(?:ober)?|oct|nov(?:ember)?|des(?:ember)?|dec)\b/gi;

/** Tokenize search query while keeping "<day> <month>" date phrases atomic to avoid cross-field false positives. */
function tokenizeAdminOrderQuery(rawQuery) {
  const normalized = String(rawQuery || "").trim().toLowerCase();
  if (!normalized) return [];

  const tokens = [];
  const remainder = normalized.replace(DAY_MONTH_PHRASE_RE, (match) => {
    tokens.push(match.replace(/\s+/g, " "));
    return " ";
  });

  remainder
    .split(/\s+/)
    .filter(Boolean)
    .forEach((word) => tokens.push(word));

  return tokens;
}

/** Match an admin order query across code, WA, email, promo, notes, items, and WIB dates. */
export function orderMatchesAdminQuery(order, rawQuery) {
  const terms = tokenizeAdminOrderQuery(rawQuery);
  if (!terms.length) return true;

  const waDigits = normalizeWhatsApp(order?.customer_whatsapp);
  const waLocal = waDigits.startsWith("62") ? `0${waDigits.slice(2)}` : waDigits;

  const parts = [
    order?.order_code,
    order?.customer_whatsapp,
    waDigits,
    waLocal,
    order?.buyer_email,
    order?.promo_code,
    order?.notes,
    order?.admin_note,
    ...getOrderDateSearchTokens(order?.created_at),
    ...getSafeOrderItems(order).flatMap((item) => [
      item?.product_name,
      item?.variant_name,
      item?.duration_label,
    ]),
  ];

  const searchable = parts
    .filter((v) => v != null && v !== "")
    .map((v) => String(v).toLowerCase())
    .join(" ");

  return terms.every((term) => searchable.includes(term));
}

/** Merge two order arrays deduplicating by id, keeping primary entries first when present. */
export function mergeOrdersById(primary = [], secondary = []) {
  const seen = new Set();
  const out = [];
  for (const row of [...(primary || []), ...(secondary || [])]) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

/** Immutably patch a matching order record inside a nullable order list. */
export function patchOrderInList(list, orderId, patchOrUpdater) {
  if (!Array.isArray(list)) return list;
  let changed = false;
  const next = list.map((order) => {
    if (order?.id !== orderId) return order;
    changed = true;
    const patch = typeof patchOrUpdater === "function" ? patchOrUpdater(order) : patchOrUpdater;
    return { ...order, ...patch };
  });
  return changed ? next : list;
}

/**
 * Fetch every matching/available order across all pages without arbitrary row caps.
 * Paginates in PostgREST-safe chunks until a short batch terminates the table scan.
 */
export async function fetchAllOrdersForSearch({
  fetchBatch,
  batchSize = ORDER_SEARCH_BATCH_SIZE,
  onBatch,
  isCancelled,
}) {
  const collected = [];
  const seen = new Set();
  let offset = 0;

  while (!isCancelled?.()) {
    const rows = (await fetchBatch(offset, offset + batchSize - 1)) || [];
    if (isCancelled?.()) break;

    for (const row of rows) {
      if (!row?.id || seen.has(row.id)) continue;
      seen.add(row.id);
      collected.push(row);
    }

    onBatch?.([...collected]);

    if (rows.length < batchSize) break;
    offset += rows.length;
  }

  return collected;
}
