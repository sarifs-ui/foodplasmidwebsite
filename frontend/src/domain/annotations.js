import { COLORS } from "../theme/tokens.js";

/**
 * Annotation types, mirroring backend/src/config/annotations.js.
 *
 * These keys are exactly what POST /api/downloads/export accepts in
 * `include.annotations`, so the display list and the export whitelist can no
 * longer drift apart — which is how anticancer peptides ended up plotted in a
 * figure but impossible to export.
 */
export const ANNOTATIONS = [
  { key: "amr", label: "AMR & Stress Response Genes", short: "AMR", tool: "AMRFinderPlus + RGI" },
  { key: "cazyme", label: "CAZymes", short: "CAZyme", tool: "run_dbCAN" },
  { key: "crispr_cas", label: "CRISPR-Cas Systems", short: "CRISPR-Cas", tool: "CRISPRCasTyper" },
  { key: "amp", label: "Antimicrobial Peptides", short: "AMP", tool: "Macrel" },
  { key: "acp", label: "Anticancer Peptides", short: "ACP", tool: "Metapepticon" },
  { key: "pfam_ko", label: "Pfam & KEGG KO", short: "Pfam/KO", tool: "eggNOG-mapper" },
];

export const EXPORT_ANNOTATION_KEYS = [...ANNOTATIONS.map((a) => a.key), "host_taxonomy"];

export const EXPORT_EXTRA_LABELS = {
  host_taxonomy: "Host Taxonomy",
};

const annotationByKey = new Map(ANNOTATIONS.map((a) => [a.key, a]));

export function annotationLabel(key) {
  return annotationByKey.get(key)?.label || EXPORT_EXTRA_LABELS[key] || key;
}

export function annotationShort(key) {
  return annotationByKey.get(key)?.short || EXPORT_EXTRA_LABELS[key] || key;
}

/**
 * Colours for the chord diagram's feature classes.
 *
 * The class list comes from the API (it is whatever chord.csv contains), so
 * this maps by key with a deterministic fallback for anything unrecognised.
 */
const FLOW_COLORS = {
  cazyme: COLORS.medTeal,
  amr: COLORS.deepOrange,
  heat_resistance: COLORS.yellow,
  heavy_metal_resistance: COLORS.berry,
  crispr_cas: COLORS.darkTeal,
  virulence: COLORS.orange,
};

const FALLBACK_COLORS = [
  COLORS.medTeal,
  COLORS.deepOrange,
  COLORS.yellow,
  COLORS.berry,
  COLORS.darkTeal,
  COLORS.orange,
  COLORS.lightTeal,
];

export function flowClassColor(key, index = 0) {
  return FLOW_COLORS[key] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

/**
 * Chord feature class -> annotation table, where one exists.
 *
 * Heat resistance, heavy-metal resistance and virulence are only present in
 * the published chord matrix: there is no gene-level table behind them, so a
 * link to their records would go nowhere and the figure says so instead.
 */
const FLOW_CLASS_ANNOTATION = {
  cazyme: "cazyme",
  amr: "amr",
  crispr_cas: "crispr_cas",
};

export function flowClassAnnotation(key) {
  return FLOW_CLASS_ANNOTATION[key] || null;
}
