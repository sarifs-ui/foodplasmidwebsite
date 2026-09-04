import archiver from "archiver";

import {
  MAX_ROWS_PER_TABLE,
  MAX_RUN_IDS,
  buildMetadataCsv,
  countAnnotationRows,
  countSamples,
  estimateArchiveBytes,
  isExportableKey,
  streamAnnotationCsv,
} from "../services/exportService.js";

/**
 * A plain-text inventory of what the archive holds.
 *
 * Written first, so anyone opening the zip can see the row count behind every
 * file — and, if a table ever hits the row ceiling, that it did.
 */
function buildManifest({ runIds, wantMetadata, tables, sampleCount }) {
  const rowCount = (n) => `${n} row${n === 1 ? "" : "s"}`;
  const lines = [
    "GFPR export",
    `Generated: ${new Date().toISOString()}`,
    `Samples: ${sampleCount}${runIds ? " (selected)" : " (entire catalogue)"}`,
    "",
    "Files:",
  ];
  if (wantMetadata) lines.push(`  metadata.csv — ${rowCount(sampleCount)}`);
  for (const { key, rows } of tables) {
    if (rows === null) {
      lines.push(`  annotations/${key}.csv — NOT AVAILABLE in this deployment`);
    } else if (rows > MAX_ROWS_PER_TABLE) {
      lines.push(
        `  annotations/${key}.csv — ${MAX_ROWS_PER_TABLE} of ${rows} rows (TRUNCATED at the per-table ceiling)`
      );
    } else {
      lines.push(`  annotations/${key}.csv — ${rowCount(rows)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

/**
 * POST /api/downloads/export
 * Body: { runIds: string[], include: { metadata: boolean, annotations: string[] } }
 *
 * An empty `runIds` means "everything". The client is expected to send the ids
 * it actually wants; it is not inferred from any server-side filter state.
 */
export async function exportArchive(req, res) {
  const rawIds = Array.isArray(req.body?.runIds)
    ? req.body.runIds
    : Array.isArray(req.body?.sampleIds) // accepted for backwards compatibility
      ? req.body.sampleIds
      : [];

  // Only well-formed string ids reach the query layer.
  const requestedIds = rawIds.filter((id) => typeof id === "string" && id.length <= 64);

  if (requestedIds.length > MAX_RUN_IDS) {
    return res.status(400).json({
      error: `Too many samples requested (max ${MAX_RUN_IDS}). Narrow the selection and try again.`,
    });
  }

  const wantMetadata = req.body?.include?.metadata !== false;
  const requestedAnnotations = Array.isArray(req.body?.include?.annotations)
    ? req.body.include.annotations.filter(isExportableKey)
    : [];

  if (!wantMetadata && requestedAnnotations.length === 0) {
    return res.status(400).json({
      error: "Nothing selected — enable metadata or choose at least one annotation table.",
    });
  }

  // null means "the whole catalogue": the query layer then reads each table
  // sequentially instead of looking up every run id one by one, which is the
  // difference between three seconds and over a minute on the largest table.
  const runIds = requestedIds.length > 0 ? requestedIds : null;
  const sampleCount = countSamples(runIds);

  // Counted once, then reused by the manifest and the size estimate.
  const tables = requestedAnnotations.map((key) => ({
    key,
    rows: countAnnotationRows(key, runIds),
  }));
  const metadataCsv = wantMetadata ? buildMetadataCsv(runIds) : null;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="gfpr-export.zip"');
  // The archive is compressed as it is sent, so there is no Content-Length to
  // give. This estimate is what lets the UI show a percentage; it is explicitly
  // approximate, and the client clamps it.
  res.setHeader(
    "X-Export-Estimated-Bytes",
    String(estimateArchiveBytes({ metadataCsv, tables, runIds }))
  );
  res.setHeader("Access-Control-Expose-Headers", "X-Export-Estimated-Bytes");

  // Level 6 is zlib's default. Level 9 costs several times the CPU on a
  // multi-hundred-MB export for about a percent of size.
  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("error", (err) => {
    // Headers are already sent by this point; closing the stream is all that is left.
    console.error("[export] archive error:", err);
    res.end();
  });
  archive.pipe(res);

  archive.append(buildManifest({ runIds, wantMetadata, tables, sampleCount }), {
    name: "MANIFEST.txt",
  });

  if (metadataCsv !== null) {
    archive.append(metadataCsv, { name: "metadata.csv" });
  }

  for (const key of requestedAnnotations) {
    const stream = streamAnnotationCsv(key, runIds);
    if (stream === null) {
      archive.append(
        `The "${key}" table is not present in this deployment.\n` +
          `Run "npm run import-annotations" with the full source data to include it.\n`,
        { name: `annotations/${key}_UNAVAILABLE.txt` }
      );
      continue;
    }
    // Appended as a stream so rows are compressed as they are read rather than
    // held in memory.
    archive.append(stream, { name: `annotations/${key}.csv` });
  }

  await archive.finalize();
}
