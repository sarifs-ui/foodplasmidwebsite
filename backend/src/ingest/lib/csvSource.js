import fs from "node:fs";
import zlib from "node:zlib";

import { parse } from "csv-parse";
import { parse as parseSync } from "csv-parse/sync";

import { DATASETS, resolveDatasetPath } from "./datasets.js";

/**
 * Shared csv-parse options.
 *
 * `bom: true` is unconditional — only cazyme.csv carries one, but stripping a
 * BOM that is not there is free, and missing one turns the first column name
 * into "﻿ID" so every lookup on it silently yields undefined.
 */
function optionsFor(key) {
  const spec = DATASETS[key];
  if (!spec) throw new Error(`Unknown dataset: ${key}`);
  return {
    delimiter: spec.delimiter,
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  };
}

/**
 * Read a whole dataset into memory, transparently decompressing a .gz file.
 * Only for the small (committed) sources.
 */
export function readRows(key) {
  const { path, gzipped } = resolveDatasetPath(key);
  const raw = fs.readFileSync(path);
  return parseSync(gzipped ? zlib.gunzipSync(raw) : raw, optionsFor(key));
}

/**
 * Stream a dataset row by row, transparently decompressing a .gz file.
 *
 * Used for the two heavy sources: merged_pfam_kofam.csv would need several GB
 * of heap if materialised, and reading it as one string exceeds V8's maximum
 * string length outright.
 */
export function streamRows(key) {
  const { path, gzipped } = resolveDatasetPath(key);
  const file = fs.createReadStream(path);
  const bytes = gzipped ? file.pipe(zlib.createGunzip()) : file;
  return bytes.pipe(parse(optionsFor(key)));
}
