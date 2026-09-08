import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { ANNOTATIONS_DB_PATH } from "../config/paths.js";
import { readRows, streamRows } from "./lib/csvSource.js";
import { DATASETS, datasetExists, datasetPath } from "./lib/datasets.js";
import {
  applyImportPragmas,
  bulkLoad,
  createIndexes,
  createTable,
  recordImport,
} from "./lib/sqliteBulk.js";
import {
  ANNOTATION_INDEXES,
  ANNOTATION_TABLES,
  HEAVY_INDEXES,
} from "./sources/annotations.js";

/** Map raw parsed rows to insert tuples, skipping any row without a run id. */
async function* mapStream(rows, map) {
  for await (const row of rows) {
    const tuple = map(row);
    if (tuple[0]) yield tuple;
  }
}

function* mapArray(rows, map) {
  for (const row of rows) {
    const tuple = map(row);
    if (tuple[0]) yield tuple;
  }
}

export async function importAnnotations({ includeHeavy = true } = {}) {
  fs.mkdirSync(path.dirname(ANNOTATIONS_DB_PATH), { recursive: true });

  const db = new Database(ANNOTATIONS_DB_PATH);
  applyImportPragmas(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS import_meta (
      table_name  TEXT PRIMARY KEY,
      source_file TEXT,
      row_count   INTEGER,
      imported_at TEXT
    )
  `);

  const loaded = [];

  for (const spec of ANNOTATION_TABLES) {
    const { table, dataset, heavy, columns, insertColumns, map } = spec;
    const sourceFile = DATASETS[dataset].file;

    if (heavy && !includeHeavy) {
      console.log(`[skipped] ${table} — heavy tables disabled for this run`);
      continue;
    }
    if (!datasetExists(dataset)) {
      console.log(`[skipped] ${sourceFile} not found — ${table} table will be absent`);
      continue;
    }

    createTable(db, table, columns);

    const started = Date.now();
    const rows = spec.heavy && DATASETS[dataset].stream
      ? mapStream(streamRows(dataset), map)
      : mapArray(readRows(dataset), map);

    const count = await bulkLoad(db, table, insertColumns, rows, {
      onProgress: heavy
        ? (n) => process.stdout.write(`\r         ${table}: ${n.toLocaleString("en-US")} rows`)
        : undefined,
    });
    if (heavy) process.stdout.write("\r");

    createIndexes(db, HEAVY_INDEXES[table] || []);
    recordImport(db, { table, sourceFile, rowCount: count });
    loaded.push({ table, sourceFile, count });

    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(
      `[import] ${sourceFile} -> ${table}: ${count.toLocaleString("en-US")} rows (${secs}s)`
    );
  }

  // Light-table indexes are created together at the end; SQLite builds them
  // faster over a complete table than incrementally during insert.
  const lightTables = new Set(loaded.map((l) => l.table));
  createIndexes(
    db,
    ANNOTATION_INDEXES.filter((sql) => {
      const table = sql.match(/ON (\w+)\(/)?.[1];
      return table && lightTables.has(table);
    })
  );

  db.close();

  const sizeMb = (fs.statSync(ANNOTATIONS_DB_PATH).size / 1e6).toFixed(1);
  console.log(`[import] ${ANNOTATIONS_DB_PATH} — ${loaded.length} tables, ${sizeMb} MB`);

  return loaded;
}

import { pathToFileURL } from "node:url";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const includeHeavy = !process.argv.includes("--light");
  importAnnotations({ includeHeavy }).catch((err) => {
    console.error("[import] failed:", err.message);
    process.exitCode = 1;
  });
}
