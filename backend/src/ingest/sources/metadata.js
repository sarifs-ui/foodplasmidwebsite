import { readRows } from "../lib/csvSource.js";
import {
  toFermentedFlag,
  toIntOrNull,
  toTextOrNull,
  toYear,
} from "../lib/coerce.js";

/**
 * metadata.csv ends with a `Total,,,,3904895,2313058,1591837,,,,,,,` footer
 * row. Importing it would double every headline statistic, so it is dropped
 * explicitly and reported rather than filtered away silently.
 */
function isFooterRow(row) {
  return String(row.Project_ID || "").trim().toLowerCase() === "total";
}

/**
 * Build the sample table.
 *
 * `Run_ID` is the primary key throughout the project: it is the only
 * identifier every annotation file joins on (verified at 100% coverage), and
 * it is populated even for the cFMD samples that have no BioSample accession.
 */
export function loadSamples() {
  const rows = readRows("metadata");

  const footers = rows.filter(isFooterRow);
  const records = [];
  let missingRunId = 0;

  for (const row of rows) {
    if (isFooterRow(row)) continue;

    const runId = toTextOrNull(row.Run_ID);
    if (!runId) {
      missingRunId += 1;
      continue;
    }

    const year = toYear(row.Year);

    records.push({
      run_id: runId,
      project_id: toTextOrNull(row.Project_ID),
      biosample_id: toTextOrNull(row.Sample_ID),
      sample_acc: toTextOrNull(row.Sample_acc),
      plasmid_contig_counts: toIntOrNull(row.Plasmid_contig_counts) ?? 0,
      classified: toIntOrNull(row.Classified) ?? 0,
      unclassified: toIntOrNull(row.Unclassified) ?? 0,
      category: toTextOrNull(row.Category),
      type: toTextOrNull(row.Type),
      sub_type: toTextOrNull(row.Sub_type),
      fermented: toFermentedFlag(row["Fermented(F)/Non_Fermented(NF)"]),
      country: toTextOrNull(row.Country),
      year: year.label,
      year_start: year.start,
      database_origin: toTextOrNull(row.Database_origin),
    });
  }

  return {
    records,
    stats: {
      rowsRead: rows.length,
      footersDropped: footers.length,
      missingRunId,
      imported: records.length,
    },
  };
}
