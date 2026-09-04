import { deflateRawSync } from "node:zlib";
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

/** CSV rows serialised per chunk handed to the archive stream. */
const ROWS_PER_BLOCK = 2_000;

/** Rows read from each table to estimate its size in the archive. */
const SAMPLE_ROWS = 4_000;

/**
 * Hard ceiling on rows written per annotation table.
 *
 * This used to be 1M, which silently truncated pfam_ko — the largest table, at
 * 5.5M rows — so "Metadata + annotations" returned an archive that looked
 * complete but was missing four fifths of one file. The ceiling now sits well
 * above the whole dataset and exists only as a runaway guard; a deployment
 * with more data can raise it with EXPORT_MAX_ROWS_PER_TABLE.
 */
export const MAX_ROWS_PER_TABLE =
  Number.parseInt(process.env.EXPORT_MAX_ROWS_PER_TABLE ?? "", 10) || 20_000_000;

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

/** `runIds` of null means every sample, throughout this module. */
export function buildMetadataCsv(runIds) {
  const idSet = runIds ? new Set(runIds) : null;
  const rows = readAll()
    .filter((r) => !idSet || idSet.has(r.run_id))
    .map((r) => Object.fromEntries(METADATA_COLUMNS.map((c) => [c, r[c]])));
  return rowsToCsv(rows);
}

/**
 * Rows of one table, either for a list of runs or — when `runIds` is null —
 * the whole table.
 *
 * The whole-table case matters: a "download everything" export used to send
 * all 4,690 ids back through `WHERE run_id IN (...)` in chunks, which turns a
 * sequential scan into millions of scattered index lookups. Reading pfam_ko
 * that way took over a minute; scanning it takes about three seconds.
 */
function* iterateRows(table, runIds) {
  if (!runIds) {
    yield* db.prepare(`SELECT * FROM ${table}`).iterate();
    return;
  }
  for (const ids of chunk(runIds, CHUNK_SIZE)) {
    if (ids.length === 0) continue;
    const placeholders = ids.map(() => "?").join(",");
    const statement = db.prepare(`SELECT * FROM ${table} WHERE run_id IN (${placeholders})`);
    yield* statement.iterate(...ids);
  }
}

/** Serialise one row; shared by the stream and the size estimate. */
function csvLine(headers, row) {
  return headers.map((h) => escapeCsvValue(row[h])).join(",");
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
    // Rows are handed to the stream in blocks: yielding one short string per
    // row costs a microtask and a stream write each, which on a 5.5M-row table
    // dominates everything else the export does.
    let block = [];

    for (const row of iterateRows(table, runIds)) {
      // Drop the internal rowid column.
      const { id, ...rest } = row;
      if (!headers) {
        headers = Object.keys(rest);
        block.push(headers.map(escapeCsvValue).join(","));
      }
      block.push(csvLine(headers, rest));
      written += 1;
      if (written >= maxRows) {
        block.push(`# truncated at ${maxRows} rows`);
        break;
      }
      if (block.length >= ROWS_PER_BLOCK) {
        yield `${block.join("\n")}\n`;
        block = [];
      }
    }

    if (block.length > 0) {
      yield `${block.join("\n")}\n`;
    } else if (!headers) {
      // No matching rows: still write the header, so an empty table reads as a
      // table with no rows rather than as an empty file.
      const columns = db
        .prepare(`SELECT * FROM ${table} LIMIT 0`)
        .columns()
        .map((c) => c.name)
        .filter((name) => name !== "id");
      yield `${columns.map(escapeCsvValue).join(",")}\n`;
    }
  }

  return Readable.from(generate());
}

/**
 * Deflated size of `text` over its raw size.
 *
 * Measured rather than assumed: the tables compress very differently — the
 * taxonomy table repeats a handful of lineages and shrinks about tenfold,
 * while pfam_ko's term lists do not.
 */
function compressionRatio(text) {
  const raw = Buffer.byteLength(text);
  if (raw === 0) return 1;
  return deflateRawSync(Buffer.from(text), { level: 6 }).length / raw;
}

/**
 * Roughly how many bytes one table will add to the archive.
 *
 * A sample of rows is serialised and compressed, and the result scaled by the
 * table's row count. The archive is built while it is streamed, so its real
 * size is not known until it has been sent — this exists purely so the browser
 * can show a percentage instead of a byte counter that means nothing without a
 * total.
 */
export function estimateAnnotationBytes(key, runIds, rows) {
  const table = resolveTableName(key);
  if (!table || !tableExists(table) || !rows) return 0;

  const lines = [];
  let headers = null;
  let sampled = 0;
  for (const row of iterateRows(table, runIds)) {
    const { id, ...rest } = row;
    if (!headers) {
      headers = Object.keys(rest);
      lines.push(headers.map(escapeCsvValue).join(","));
    }
    lines.push(csvLine(headers, rest));
    sampled += 1;
    if (sampled >= SAMPLE_ROWS) break;
  }
  if (sampled === 0) return 0;

  const sample = `${lines.join("\n")}\n`;
  const bytesPerRow = Buffer.byteLength(sample) / sampled;
  return Math.round(rows * bytesPerRow * compressionRatio(sample));
}

/** Estimated size of the whole archive, for the progress readout. */
export function estimateArchiveBytes({ metadataCsv, tables, runIds }) {
  let total = metadataCsv ? Math.round(Buffer.byteLength(metadataCsv) * compressionRatio(metadataCsv)) : 0;
  for (const { key, rows } of tables) {
    total += estimateAnnotationBytes(key, runIds, Math.min(rows ?? 0, MAX_ROWS_PER_TABLE));
  }
  return total;
}

/** Total rows a table holds, for the manifest. */
export function countAnnotationRows(key, runIds) {
  const table = resolveTableName(key);
  if (!table || !tableExists(table)) return null;
  if (!runIds) return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  let total = 0;
  for (const ids of chunk(runIds, CHUNK_SIZE)) {
    if (ids.length === 0) continue;
    const placeholders = ids.map(() => "?").join(",");
    total += db
      .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE run_id IN (${placeholders})`)
      .get(...ids).n;
  }
  return total;
}

/** How many samples an export covers; `runIds` of null means all of them. */
export function countSamples(runIds) {
  return runIds ? runIds.length : readAll().length;
}
