import { Readable } from "node:stream";

import { EXPORT_ANNOTATION_KEYS, annotationByKey } from "../../config/annotations.js";
import { db, tableExists } from "../../data/annotationsDb.js";
import { readAll } from "../../data/sampleStore.js";
import { escapeCsvValue, rowsToCsv } from "../../utils/csv.js";

/**
 * SQLite caps the number of bound parameters per statement, so long id lists
 * are queried in chunks.
 */
const CHUNK_SIZE = 400;

/**
 * Hard ceiling on rows written per annotation table.
 *
 * Without one, a single request could ask for every row of pfam_ko (5.5M) and
 * the response would be ~275 MB of CSV. The cap is generous enough for real
 * per-sample exports and bounds what one request can cost.
 */
export const MAX_ROWS_PER_TABLE = 1_000_000;

/** Ceiling on how many samples one export may cover. */
export const MAX_RUN_IDS = 5_000;

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
 * Stream one annotation table as CSV for the given runs.
 *
 * Rows are pulled with SQLite's row-at-a-time iterator and serialised straight
 * into the archive. The previous version accumulated every row into one array
 * (growing it with `concat` inside the chunk loop, so O(n^2) copying) and then
 * joined the whole result into a single string — a full-table export peaked at
 * roughly 2.3 GB of resident memory, which two concurrent requests could turn
 * into an out-of-memory kill.
 *
 * Returns null when the table was never imported, so the caller can say so.
 */
export function streamAnnotationCsv(key, runIds, { maxRows = MAX_ROWS_PER_TABLE } = {}) {
  const table = resolveTableName(key);
  if (!table || !tableExists(table)) return null;

  async function* generate() {
    let headers = null;
    let written = 0;

    for (const ids of chunk(runIds, CHUNK_SIZE)) {
      if (ids.length === 0) continue;
      const placeholders = ids.map(() => "?").join(",");
      const statement = db.prepare(
        `SELECT * FROM ${table} WHERE run_id IN (${placeholders})`
      );

      for (const row of statement.iterate(...ids)) {
        // Drop the internal rowid column.
        const { id, ...rest } = row;
        if (!headers) {
          headers = Object.keys(rest);
          yield `${headers.map(escapeCsvValue).join(",")}\n`;
        }
        yield `${headers.map((h) => escapeCsvValue(rest[h])).join(",")}\n`;
        written += 1;
        if (written >= maxRows) {
          yield `# truncated at ${maxRows} rows\n`;
          return;
        }
      }
    }

    if (!headers) yield "";
  }

  return Readable.from(generate());
}

/** Every run id in the dataset — used when the request selects nothing. */
export function allRunIds() {
  return readAll().map((r) => r.run_id);
}
