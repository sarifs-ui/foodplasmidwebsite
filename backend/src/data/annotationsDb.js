import fs from "node:fs";

import Database from "better-sqlite3";

import { ANNOTATIONS_DB_PATH } from "../config/paths.js";

/**
 * Read-only handle on the optional annotation database.
 *
 * This is opened strictly read-only. The previous version claimed to be
 * read-only but opened read-write and ran `PRAGMA journal_mode = WAL`, which
 * is a write — that is how gfpr.db-shm/-wal ended up committed to the repo,
 * and it forced the container's data directory to be writable.
 *
 * When the file is absent every caller degrades through `tableExists()`.
 */
let db = null;

if (fs.existsSync(ANNOTATIONS_DB_PATH)) {
  try {
    db = new Database(ANNOTATIONS_DB_PATH, { readonly: true, fileMustExist: true });
  } catch (err) {
    console.warn(`[db] Could not open ${ANNOTATIONS_DB_PATH}: ${err.message}`);
    db = null;
  }
} else {
  console.warn(
    `[db] ${ANNOTATIONS_DB_PATH} not found — gene-level annotation hits will be unavailable.`
  );
}

export { db };

export function hasDb() {
  return db !== null;
}

export function tableExists(name) {
  if (!db) return false;
  try {
    return !!db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
      .get(name);
  } catch {
    return false;
  }
}

/** Row counts recorded at import time, for /api/health and diagnostics. */
export function importSummary() {
  if (!tableExists("import_meta")) return [];
  try {
    return db
      .prepare("SELECT table_name, source_file, row_count, imported_at FROM import_meta")
      .all();
  } catch {
    return [];
  }
}
