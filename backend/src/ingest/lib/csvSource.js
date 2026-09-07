import fs from "node:fs";

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
 * Read a whole dataset into memory, transparently decompressing whichever
 * format it is stored in. Only for the small (committed) sources.
 */
export function readRows(key) {
  const { path, codec } = resolveDatasetPath(key);
  const raw = fs.readFileSync(path);
  return parseSync(codec ? codec.sync(raw) : raw, optionsFor(key));
}

/**
 * Stream a dataset row by row, decompressing as it goes.
 *
 * Used for the two heavy sources: merged_pfam_kofam.csv would need several GB
 * of heap if materialised, and reading it as one string exceeds V8's maximum
 * string length outright.
 */
export function streamRows(key) {
  return decompressedStream(key).pipe(parse(optionsFor(key)));
}

/**
 * The dataset's bytes, decompressed but not parsed.
 *
 * The export uses this to copy a whole source file into the archive without
 * paying to parse and re-serialise several million rows.
 */
export function decompressedStream(key) {
  const { path, codec } = resolveDatasetPath(key);
  const file = fs.createReadStream(path);
  return codec ? file.pipe(codec.stream()) : file;
}
