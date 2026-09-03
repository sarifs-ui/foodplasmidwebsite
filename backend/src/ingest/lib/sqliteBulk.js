/**
 * Bulk-load helpers for the annotation database.
 *
 * The import is a throwaway build step, so durability pragmas are traded for
 * speed: a crash mid-import just means running it again.
 */
export function applyImportPragmas(db) {
  db.pragma("journal_mode = OFF");
  db.pragma("synchronous = OFF");
  db.pragma("temp_store = MEMORY");
  db.pragma("cache_size = -262144"); // 256 MB
}

/**
 * Insert rows in batched transactions.
 *
 * `rows` may be a plain array or an async iterable, so the same helper serves
 * both the small files (read fully) and the 5.5M-row one (streamed). Awaiting
 * each flush lets the stream apply backpressure against the synchronous
 * better-sqlite3 writes.
 */
export async function bulkLoad(db, table, columns, rows, { batchSize = 50_000, onProgress } = {}) {
  const placeholders = columns.map(() => "?").join(", ");
  const stmt = db.prepare(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`
  );
  const flush = db.transaction((batch) => {
    for (const row of batch) stmt.run(row);
  });

  let batch = [];
  let total = 0;

  for await (const row of rows) {
    batch.push(row);
    if (batch.length >= batchSize) {
      flush(batch);
      total += batch.length;
      batch = [];
      onProgress?.(total);
    }
  }
  if (batch.length) {
    flush(batch);
    total += batch.length;
    onProgress?.(total);
  }

  return total;
}

/**
 * Create a table from a column spec.
 *
 * `id INTEGER PRIMARY KEY` is a rowid alias — the same effect as AUTOINCREMENT
 * without the sqlite_sequence bookkeeping, which matters at 5.5M inserts.
 */
export function createTable(db, table, columnDefs) {
  db.exec(`DROP TABLE IF EXISTS ${table}`);
  db.exec(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY, ${columnDefs.join(", ")})`);
}

/** Indexes are created after loading — markedly faster than maintaining them during insert. */
export function createIndexes(db, statements) {
  for (const sql of statements) db.exec(sql);
}

export function recordImport(db, { table, sourceFile, rowCount }) {
  db.prepare(
    `INSERT INTO import_meta (table_name, source_file, row_count, imported_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(table_name) DO UPDATE SET
       source_file = excluded.source_file,
       row_count   = excluded.row_count,
       imported_at = excluded.imported_at`
  ).run(table, sourceFile, rowCount, new Date().toISOString());
}
