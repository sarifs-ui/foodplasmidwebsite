import fs from "node:fs";

import { SAMPLES_PATH } from "../config/paths.js";

/**
 * In-memory cache over the sample table.
 *
 * The previous implementation re-read and re-parsed the whole ~1 MB file on
 * every call, and several endpoints called it more than once per request. The
 * cache is keyed on the file's mtime+size so re-running an import while the
 * server is up still takes effect without a restart.
 */
let cache = null;
let cacheToken = "";
let runIndex = null;
const memos = new Map();

function currentToken() {
  try {
    const stat = fs.statSync(SAMPLES_PATH);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return "missing";
  }
}

export function readAll() {
  const token = currentToken();
  if (cache && token === cacheToken) return cache;

  let parsed = [];
  try {
    parsed = JSON.parse(fs.readFileSync(SAMPLES_PATH, "utf-8") || "[]");
    if (!Array.isArray(parsed)) parsed = [];
  } catch {
    parsed = [];
  }

  cache = Object.freeze(parsed);
  cacheToken = token;
  runIndex = new Map(parsed.map((r) => [r.run_id, r]));
  memos.clear();
  return cache;
}

/** O(1) lookup by run id — the primary key across the whole dataset. */
export function byRunId(runId) {
  readAll();
  return runIndex.get(runId) ?? null;
}

/**
 * Compute a derived value once per underlying-file version.
 * Used for the aggregates that several endpoints recompute per request.
 */
export function memoize(key, compute) {
  const data = readAll();
  const hit = memos.get(key);
  if (hit && hit.token === cacheToken) return hit.value;
  const value = compute(data);
  memos.set(key, { token: cacheToken, value });
  return value;
}

export function isEmpty() {
  return readAll().length === 0;
}
