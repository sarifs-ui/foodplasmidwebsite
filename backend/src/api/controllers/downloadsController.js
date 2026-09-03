import archiver from "archiver";

import {
  allRunIds,
  buildAnnotationCsv,
  buildMetadataCsv,
  isExportableKey,
} from "../services/exportService.js";

/**
 * POST /api/downloads/export
 * Body: { runIds: string[], include: { metadata: boolean, annotations: string[] } }
 *
 * An empty `runIds` means "everything". The client is expected to send the ids
 * it actually wants; it is not inferred from any server-side filter state.
 */
export async function exportArchive(req, res) {
  const requestedIds = Array.isArray(req.body?.runIds)
    ? req.body.runIds
    : Array.isArray(req.body?.sampleIds) // accepted for backwards compatibility
      ? req.body.sampleIds
      : [];

  const wantMetadata = req.body?.include?.metadata !== false;
  const requestedAnnotations = Array.isArray(req.body?.include?.annotations)
    ? req.body.include.annotations.filter(isExportableKey)
    : [];

  if (!wantMetadata && requestedAnnotations.length === 0) {
    return res.status(400).json({
      error: "Nothing selected — enable metadata or choose at least one annotation table.",
    });
  }

  const runIds = requestedIds.length > 0 ? requestedIds : allRunIds();

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="gfpr-export.zip"');

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => {
    // Headers are already sent by this point; closing the stream is all that is left.
    console.error("[export] archive error:", err);
    res.end();
  });
  archive.pipe(res);

  if (wantMetadata) {
    archive.append(buildMetadataCsv(runIds), { name: "metadata.csv" });
  }

  for (const key of requestedAnnotations) {
    const csv = buildAnnotationCsv(key, runIds);
    if (csv === null) {
      archive.append(
        `The "${key}" table is not present in this deployment.\n` +
          `Run "npm run import-annotations" with the full source data to include it.\n`,
        { name: `annotations/${key}_UNAVAILABLE.txt` }
      );
      continue;
    }
    archive.append(csv, { name: `annotations/${key}.csv` });
  }

  await archive.finalize();
}
