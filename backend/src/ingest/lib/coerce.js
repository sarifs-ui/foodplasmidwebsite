/**
 * Value coercion shared by every importer.
 *
 * The source files come from several different pipelines and disagree about
 * how to spell "missing" and how to write a decimal point, so all of that is
 * normalised in exactly one place.
 */

/** Trim; treat both "" and "-" as missing. `-` is the empty marker everywhere. */
export function toTextOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (text === "" || text === "-") return null;
  return text;
}

/** Strand must preserve '-' for reverse and '+' for forward. */
export function toStrand(value) {
  if (value === undefined || value === null) return "+";
  const text = String(value).trim();
  return text === "-" ? "-" : "+";
}

export function toIntOrNull(value) {
  const text = toTextOrNull(value);
  if (text === null) return null;
  const n = Number.parseInt(text, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Accepts both "0.57" and the European "0,594" produced by some of the
 * upstream tools. Only a single comma is treated as a decimal separator, so a
 * genuinely multi-valued field is not silently mangled into a number.
 */
export function toFloatFlexible(value) {
  const text = toTextOrNull(value);
  if (text === null) return null;
  const normalised = text.split(",").length === 2 ? text.replace(",", ".") : text;
  const n = Number.parseFloat(normalised);
  return Number.isFinite(n) ? n : null;
}

/** "F"/"NF" (and a few synonyms) -> true/false; anything else -> null. */
export function toFermentedFlag(value) {
  const text = toTextOrNull(value);
  if (text === null) return null;
  const key = text.toUpperCase().replace(/[\s-]/g, "_");
  if (["F", "FERMENTED", "1", "TRUE", "YES"].includes(key)) return true;
  if (["NF", "NON_FERMENTED", "0", "FALSE", "NO"].includes(key)) return false;
  return null;
}

/**
 * Years are mostly plain integers, but 15 rows carry a range ("2014/2015").
 * Number() turns those into NaN, which used to drop the samples out of the
 * year filter entirely — so the label is preserved and a sortable start year
 * is derived alongside it.
 */
export function toYear(value) {
  const text = toTextOrNull(value);
  if (text === null) return { label: null, start: null };
  const match = text.match(/\d{4}/);
  return { label: text, start: match ? Number.parseInt(match[0], 10) : null };
}

/**
 * Split a multi-value annotation cell into terms. The CSV parser has already
 * removed the surrounding quotes, so "ko:K17943,ko:K17944" arrives as a plain
 * comma-separated string.
 */
export function splitTerms(value) {
  const text = toTextOrNull(value);
  if (text === null) return [];
  return text
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t !== "" && t !== "-");
}
