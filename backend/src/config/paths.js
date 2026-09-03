import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Every filesystem path in the backend is derived from this one root, so that
 * behaviour does not depend on the process working directory.
 */
export const BACKEND_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

export const REPO_ROOT = path.resolve(BACKEND_ROOT, "..");

/** Directory holding the source CSVs shipped with (or downloaded into) the repo. */
export const DATA_DIR = path.resolve(BACKEND_ROOT, process.env.DATA_DIR || "data");

/** Sample/metadata table produced by `npm run import-data`. */
export const SAMPLES_PATH = path.resolve(
  BACKEND_ROOT,
  process.env.SAMPLES_PATH || "data/gfpr.json"
);

/**
 * Precomputed figure payloads produced by `npm run build-derived`.
 * Committed to the repo so the site works from a bare clone.
 */
export const DERIVED_PATH = path.resolve(
  BACKEND_ROOT,
  process.env.DERIVED_PATH || "data/gfpr.derived.json"
);

/** Optional gene-level annotation database produced by `npm run import-annotations`. */
export const ANNOTATIONS_DB_PATH = path.resolve(
  BACKEND_ROOT,
  process.env.ANNOTATIONS_DB_PATH || "data/gfpr.db"
);

/** Built frontend served by the API on the same port. */
export const FRONTEND_DIST = path.resolve(REPO_ROOT, "frontend", "dist");

/** Resolve a file inside the data directory. */
export function dataFile(name) {
  return path.resolve(DATA_DIR, name);
}
