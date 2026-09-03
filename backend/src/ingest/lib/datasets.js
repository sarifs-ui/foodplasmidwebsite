import fs from "node:fs";

import { dataFile } from "../../config/paths.js";

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
  hostTaxonomy: {
    file: "family_assigned.csv",
    delimiter: ",",
    heavy: true,
    description:
      "Contig-level host taxonomy. Pre-filtered to family-assigned contigs, so " +
      "it is NOT a complete census of a run's contigs — see buildDerived.js.",
  },
  pfamKo: {
    file: "merged_pfam_kofam.csv",
    delimiter: ",",
    heavy: true,
    stream: true,
    description:
      "Pfam/KOfam terms per contig (~5.5M rows). Quoted, comma-containing " +
      "fields mean this must go through a real CSV parser, never a line split.",
  },
};

export function datasetPath(key) {
  const spec = DATASETS[key];
  if (!spec) throw new Error(`Unknown dataset: ${key}`);
  return dataFile(spec.file);
}

export function datasetExists(key) {
  return fs.existsSync(datasetPath(key));
}

/** Dataset keys whose source file is small enough to commit. */
export const LIGHT_DATASETS = Object.keys(DATASETS).filter((k) => !DATASETS[k].heavy);

/** Dataset keys that are gitignored and optional at runtime. */
export const HEAVY_DATASETS = Object.keys(DATASETS).filter((k) => DATASETS[k].heavy);
