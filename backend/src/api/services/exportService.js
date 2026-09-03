import { EXPORT_ANNOTATION_KEYS, annotationByKey } from "../../config/annotations.js";
import { db, tableExists } from "../../data/annotationsDb.js";
import { readAll } from "../../data/sampleStore.js";
import { rowsToCsv } from "../../utils/csv.js";

/**
 * SQLite caps the number of bound parameters per statement, so long id lists
 * are queried in chunks.
 */
const CHUNK_SIZE = 400;

const METADATA_COLUMNS = [
  "run_id",
  "project_id",
  "biosample_id",
  "sample_acc",
  "category",
  "type",
  "sub_type",
  "fermented",
  "country",
  "year",
  "database_origin",
  "plasmid_contig_counts",
  "classified",
  "unclassified",
];

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function resolveTableName(key) {
  if (key === "host_taxonomy") return "host_taxonomy";
  return annotationByKey(key)?.table ?? null;
}

export function isExportableKey(key) {
  return EXPORT_ANNOTATION_KEYS.includes(key);
}

export function buildMetadataCsv(runIds) {
  const idSet = runIds ? new Set(runIds) : null;
  const rows = readAll()
    .filter((r) => !idSet || idSet.has(r.run_id))
    .map((r) => Object.fromEntries(METADATA_COLUMNS.map((c) => [c, r[c]])));
  return rowsToCsv(rows);
}

/**
 * All rows of one annotation table for the given runs.
 * Returns null when the table was never imported, so the caller can say so.
 */
export function buildAnnotationCsv(key, runIds) {
  const table = resolveTableName(key);
  if (!table || !tableExists(table)) return null;

  let rows = [];
  for (const ids of chunk(runIds, CHUNK_SIZE)) {
    if (ids.length === 0) continue;
    const placeholders = ids.map(() => "?").join(",");
    rows = rows.concat(
      db.prepare(`SELECT * FROM ${table} WHERE run_id IN (${placeholders})`).all(...ids)
    );
  }

  // Drop the internal rowid column.
  return rowsToCsv(rows.map(({ id, ...rest }) => rest));
}

/** Every run id in the dataset — used when the request selects nothing. */
export function allRunIds() {
  return readAll().map((r) => r.run_id);
}
