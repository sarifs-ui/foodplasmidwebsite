import fs from "node:fs";

import { parse } from "csv-parse";
import { parse as parseSync } from "csv-parse/sync";

import { DATASETS, datasetPath } from "./datasets.js";

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

/** Read a whole dataset into memory. Only for the small (committed) files. */
export function readRows(key) {
  const file = datasetPath(key);
  return parseSync(fs.readFileSync(file), optionsFor(key));
}

/**
 * Stream a dataset row by row.
 *
 * Used for the two heavy files: merged_pfam_kofam.csv would need several GB of
 * heap if materialised, and reading it as one string exceeds V8's maximum
 * string length outright.
 */
export function streamRows(key) {
  return fs.createReadStream(datasetPath(key)).pipe(parse(optionsFor(key)));
}
