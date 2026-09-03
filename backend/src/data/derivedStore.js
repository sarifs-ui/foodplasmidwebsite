import fs from "node:fs";

import { DERIVED_PATH } from "../config/paths.js";

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
  try {
    const stat = fs.statSync(DERIVED_PATH);
    return `${stat.mtimeMs}:${stat.size}`;
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

  try {
    const parsed = JSON.parse(fs.readFileSync(DERIVED_PATH, "utf-8"));
    cache = Object.freeze({ ...EMPTY, ...parsed });
  } catch (err) {
    console.warn(`[derived] Could not read ${DERIVED_PATH}: ${err.message}`);
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
