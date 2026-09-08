import fs from "node:fs";
import path from "node:path";

import { SAMPLES_PATH } from "../config/paths.js";
import { datasetExists, datasetPath } from "./lib/datasets.js";
import { loadSamples } from "./sources/metadata.js";

/**
 * Build backend/data/gfpr.json from metadata.csv.
 *
 * Runs on `npm install` via postinstall, so a missing source file warns and
 * exits 0 rather than failing the install.
 */
export function importMetadata() {
  if (!datasetExists("metadata")) {
    console.warn(`[skipped] Source file not found: ${datasetPath("metadata")}`);
    console.warn("          The sample table will be empty.");
    return null;
  }

  const { records, stats } = loadSamples();

  fs.mkdirSync(path.dirname(SAMPLES_PATH), { recursive: true });
  fs.writeFileSync(SAMPLES_PATH, JSON.stringify(records), "utf-8");

  const totalContigs = records.reduce((sum, r) => sum + r.plasmid_contig_counts, 0);
  const categories = new Set(records.map((r) => r.category).filter(Boolean));
  const countries = new Set(records.map((r) => r.country).filter(Boolean));

  console.log(`[import] metadata.csv -> ${SAMPLES_PATH}`);
  console.log(`         rows read        : ${stats.rowsRead}`);
  if (stats.footersDropped) {
    console.log(`         footer rows      : ${stats.footersDropped} dropped ("Total")`);
  }
  if (stats.missingRunId) {
    console.log(`         missing Run_ID   : ${stats.missingRunId} dropped`);
  }
  console.log(`         samples imported : ${stats.imported}`);
  console.log(`         categories       : ${categories.size}`);
  console.log(`         countries        : ${countries.size}`);
  console.log(`         plasmid contigs  : ${totalContigs.toLocaleString("en-US")}`);

  return { records, stats };
}

import { pathToFileURL } from "node:url";

// Allow `node src/ingest/importMetadata.js` as well as programmatic use.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  importMetadata();
}
