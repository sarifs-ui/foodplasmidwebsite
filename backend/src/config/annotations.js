/**
 * The single source of truth for the annotation types the API exposes.
 *
 * This list used to exist in three places with three different key sets (the
 * UI's display list, the export whitelist, and a label map rebuilt inside a
 * render body), which is how `acp` ended up missing from exports while being
 * plotted in a figure.
 *
 * `tier` records where the data lives:
 *   "A" — imported from a committed source CSV; always available.
 *   "C" — imported from one of the two heavy, gitignored files; optional.
 */
export const ANNOTATIONS = [
  {
    key: "amr",
    table: "amr",
    label: "AMR & Stress Response Genes",
    short: "AMR",
    tool: "AMRFinderPlus + RGI",
    labelColumn: "consensus_class",
    tier: "A",
  },
  {
    key: "cazyme",
    table: "cazyme",
    label: "CAZymes",
    short: "CAZyme",
    tool: "run_dbCAN",
    labelColumn: "family",
    tier: "A",
  },
  {
    key: "crispr_cas",
    table: "crispr_cas",
    label: "CRISPR-Cas Systems",
    short: "CRISPR-Cas",
    tool: "CRISPRCasTyper",
    // `type` is "Unknown" on rows where `subtype` is specific, so subtype is
    // the more informative label.
    labelColumn: "subtype",
    tier: "A",
  },
  {
    key: "amp",
    table: "amp",
    label: "Antimicrobial Peptides",
    short: "AMP",
    tool: "Macrel",
    labelColumn: "amp_family",
    tier: "A",
  },
  {
    key: "acp",
    table: "acp",
    label: "Anticancer Peptides",
    short: "ACP",
    tool: "Metapepticon",
    labelColumn: "sequence",
    tier: "A",
  },
  {
    key: "cgc",
    table: "cgc",
    label: "CAZyme Gene Clusters",
    short: "CGC",
    tool: "easy_CGC (run_dbCAN)",
    labelColumn: "recommend_results",
    tier: "A",
  },
  {
    key: "pfam_ko",
    table: "pfam_ko",
    label: "Pfam & KEGG KO",
    short: "Pfam/KO",
    tool: "eggNOG-mapper",
    labelColumn: "kofam",
    // The column holds a comma-separated term list rather than one value.
    multiValue: true,
    tier: "C",
  },
];

export const ANNOTATION_KEYS = ANNOTATIONS.map((a) => a.key);

/** Keys accepted by POST /api/downloads/export in `include.annotations`. */
export const EXPORT_ANNOTATION_KEYS = [...ANNOTATION_KEYS, "host_taxonomy"];

export function annotationByKey(key) {
  return ANNOTATIONS.find((a) => a.key === key) || null;
}

/**
 * Retired annotation types surfaced as explicitly unavailable.
 */
export const RETIRED_ANNOTATIONS = [];
