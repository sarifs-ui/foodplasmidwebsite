import fs from "node:fs";
import zlib from "node:zlib";

import { DERIVED_PATH } from "../config/paths.js";

/** The artifact is committed gzipped; an uncompressed file wins if present. */
function resolvePath() {
  if (fs.existsSync(DERIVED_PATH)) return { path: DERIVED_PATH, gzipped: false };
  const gz = `${DERIVED_PATH}.gz`;
  if (fs.existsSync(gz)) return { path: gz, gzipped: true };
  return null;
}

/**
 * Loader for gfpr.derived.json — the committed artifact holding everything the
 * two heavy source files contribute to the figures (taxonomy tree, host per
 * run, top Pfam/KO terms).
 *
 * It is committed so that a bare `git clone` renders every figure without
 * anyone downloading 388 MB of CSVs first. Parsed once, keyed on mtime+size.
 */
let cache = null;
let cacheToken = "";

const EMPTY = Object.freeze({
  generatedAt: null,
  sources: {},
  taxonomy: { nodes: [], categories: [], familyCount: 0 },
  hostByRun: {},
  pfamKoCountsByRun: {},
  functional: { topPfamByCategory: {}, topKoByCategory: {}, runsByCategory: {} },
});

function currentToken() {
  const resolved = resolvePath();
  if (!resolved) return "missing";
  try {
    const stat = fs.statSync(resolved.path);
    return `${resolved.path}:${stat.mtimeMs}:${stat.size}`;
  } catch {
    return "missing";
  }
}

export function loadDerived() {
  const token = currentToken();
  if (cache && token === cacheToken) return cache;

  if (token === "missing") {
    cache = EMPTY;
    cacheToken = token;
    return cache;
  }

  const resolved = resolvePath();
  try {
    const raw = fs.readFileSync(resolved.path);
    const text = resolved.gzipped ? zlib.gunzipSync(raw) : raw;
    cache = Object.freeze({ ...EMPTY, ...JSON.parse(text.toString("utf-8")) });
  } catch (err) {
    console.warn(`[derived] Could not read ${resolved.path}: ${err.message}`);
    cache = EMPTY;
  }
  cacheToken = token;
  return cache;
}

export function hasDerived() {
  return loadDerived().generatedAt !== null;
}

export function hostForRun(runId) {
  return loadDerived().hostByRun[runId] ?? null;
}
