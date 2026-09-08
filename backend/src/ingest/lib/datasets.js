import fs from "node:fs";

import { dataFile } from "../../config/paths.js";
import { resolveCompressed } from "./codec.js";

/**
 * Declarative description of every source file.
 *
 * The delimiter is declared per file rather than sniffed. An earlier version
 * guessed by counting tabs against semicolons, which silently mis-parsed every
 * comma-separated file into a single column.
 *
 * `heavy: true` marks the two files that are too large to commit. Everything
 * they contribute to the figures is precomputed into gfpr.derived.json, so the
 * site works without them.
 */
export const DATASETS = {
  metadata: {
    file: "metadata.csv",
    delimiter: ",",
    description: "Master sample table — the source of truth for every join.",
  },
  chord: {
    file: "chord.csv",
    delimiter: ",",
    description:
      "Published category x feature-class matrix. Externally produced and not " +
      "reproducible from the other files; treated as a source, not a derivative.",
  },
  amr: {
    file: "amr-rgi-consensus.csv",
    delimiter: ",",
    description: "AMRFinderPlus + RGI consensus resistance calls.",
  },
  cazyme: {
    // The only file carrying a UTF-8 BOM. `bom: true` is set globally anyway,
    // but it is recorded here because it is a property of this file.
    file: "cazyme.csv",
    delimiter: ";",
    description: "run_dbCAN carbohydrate-active enzyme families.",
  },
  amp: {
    file: "amp_all.csv",
    delimiter: ",",
    description: "Macrel antimicrobial peptide predictions (European decimals).",
  },
  crisprCas: {
    file: "cctyper.csv",
    delimiter: ",",
    description: "CRISPRCasTyper operon and array calls.",
  },
  acp: {
    file: "acp_all.csv",
    delimiter: ",",
    description: "Anticancer peptide predictions.",
  },
  cgc: {
    file: "cgc.tsv",
    delimiter: "\t",
    description:
      "CAZyme Gene Clusters (CGC) with genomic coordinates and enzyme annotations.",
  },
  hostTaxonomy: {
    file: "family_assigned.csv",
    delimiter: ",",
    heavy: true,
    // Column holding the run id in the source file. The export reads these two
    // files directly when their tables are not in the database, and needs to
    // know which column to filter on.
    runIdColumn: "RunID",
    description:
      "Contig-level host taxonomy. Pre-filtered to family-assigned contigs, so " +
      "it is NOT a complete census of a run's contigs — see buildDerived.js.",
  },
  pfamKo: {
    file: "merged_pfam_kofam.csv",
    delimiter: ",",
    heavy: true,
    stream: true,
    runIdColumn: "id",
    description:
      "Pfam/KOfam terms per contig (~5.5M rows). Quoted, comma-containing " +
      "fields mean this must go through a real CSV parser, never a line split.",
  },
};

/**
 * Locate a dataset on disk.
 *
 * The committed sources are stored compressed — zstd for anything written now,
 * though .br and .gz are still recognised so a checkout part-way through the
 * migration keeps working. A plain, uncompressed file takes precedence, so a
 * contributor can drop one in without renaming.
 *
 * The codec travels with the path: nothing downstream has to know which format
 * a file is in, and no file is ever expanded onto disk.
 */
export function resolveDatasetPath(key) {
  const spec = DATASETS[key];
  if (!spec) throw new Error(`Unknown dataset: ${key}`);
  const plain = dataFile(spec.file);
  const found = resolveCompressed(plain, (p) => fs.existsSync(p));
  if (found) return found;
  return { path: plain, codec: null, missing: true };
}

export function datasetPath(key) {
  return resolveDatasetPath(key).path;
}

export function datasetExists(key) {
  return !resolveDatasetPath(key).missing;
}

/** Dataset keys whose source file is small enough to commit. */
export const LIGHT_DATASETS = Object.keys(DATASETS).filter((k) => !DATASETS[k].heavy);

/** Dataset keys that are gitignored and optional at runtime. */
export const HEAVY_DATASETS = Object.keys(DATASETS).filter((k) => DATASETS[k].heavy);
