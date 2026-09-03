/**
 * Minimal RFC 4180 CSV writer.
 *
 * The exported data is simple enough that a dependency is not warranted; this
 * only needs to quote the three characters that would otherwise break a field.
 */
function escapeValue(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * Serialise an array of plain objects. Column order follows the first row's
 * keys. An empty array yields an empty string.
 */
export function rowsToCsv(rows) {
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(escapeValue).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeValue(row[h])).join(","));
  }
  return lines.join("\n");
}
