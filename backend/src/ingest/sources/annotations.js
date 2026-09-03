import {
  toFloatFlexible,
  toIntOrNull,
  toTextOrNull,
} from "../lib/coerce.js";

/**
 * Table definitions for the gene-level annotation database.
 *
 * Every table is keyed on `run_id`. The source files also carry
 * Category/Type/Country/Year columns, but those are pure duplicates of
 * metadata.csv (verified: only 6 of 121,794 cazyme rows disagree, which is
 * noise) so they are dropped — dropping `category` alone saves ~55 MB on the
 * pfam_ko table.
 */
export const ANNOTATION_TABLES = [
  {
    table: "amr",
    dataset: "amr",
    columns: [
      "run_id TEXT NOT NULL",
      "protein_id TEXT",
      "amr_class TEXT",
      "rgi_drug_class TEXT",
      "consensus_class TEXT",
      "match_type TEXT",
    ],
    insertColumns: [
      "run_id",
      "protein_id",
      "amr_class",
      "rgi_drug_class",
      "consensus_class",
      "match_type",
    ],
    map: (r) => [
      toTextOrNull(r.sample_id),
      toTextOrNull(r.id),
      toTextOrNull(r.AMR_Class),
      toTextOrNull(r.RGI_Drug_Class),
      toTextOrNull(r.Consensus_Class),
      toTextOrNull(r.Match_Type),
    ],
  },
  {
    table: "cazyme",
    dataset: "cazyme",
    columns: ["run_id TEXT NOT NULL", "class TEXT", "family TEXT", "count INTEGER"],
    insertColumns: ["run_id", "class", "family", "count"],
    map: (r) => [
      toTextOrNull(r.ID),
      toTextOrNull(r.Class),
      toTextOrNull(r.Family),
      toIntOrNull(r.count),
    ],
  },
  {
    table: "crispr_cas",
    dataset: "crisprCas",
    columns: [
      "run_id TEXT NOT NULL",
      "source TEXT",
      "contig TEXT",
      "type TEXT",
      "subtype TEXT",
      "confidence REAL",
    ],
    insertColumns: ["run_id", "source", "contig", "type", "subtype", "confidence"],
    map: (r) => [
      toTextOrNull(r.Sample_ID),
      toTextOrNull(r.Source),
      toTextOrNull(r.Contig),
      toTextOrNull(r.Type),
      toTextOrNull(r.Subtype),
      toFloatFlexible(r.Confidence),
    ],
  },
  {
    table: "amp",
    dataset: "amp",
    columns: [
      "run_id TEXT NOT NULL",
      "peptide_id TEXT",
      "amp_family TEXT",
      "amp_probability REAL",
      "hemolytic TEXT",
      "hemolytic_probability REAL",
    ],
    insertColumns: [
      "run_id",
      "peptide_id",
      "amp_family",
      "amp_probability",
      "hemolytic",
      "hemolytic_probability",
    ],
    map: (r) => [
      toTextOrNull(r.Sample_ID),
      toTextOrNull(r.Peptide_ID),
      toTextOrNull(r.AMP_family),
      toFloatFlexible(r.AMP_probability),
      toTextOrNull(r.Hemolytic),
      toFloatFlexible(r.Hemolytic_probability),
    ],
  },
  {
    table: "acp",
    dataset: "acp",
    columns: [
      "run_id TEXT NOT NULL",
      "sequence TEXT",
      "anticp2 REAL",
      "conacp REAL",
      "acpred REAL",
      "toxinpred TEXT",
    ],
    insertColumns: ["run_id", "sequence", "anticp2", "conacp", "acpred", "toxinpred"],
    map: (r) => [
      toTextOrNull(r.Run_ID),
      toTextOrNull(r.Sequence),
      toFloatFlexible(r.prediction_by_anticp2),
      toFloatFlexible(r.prediction_by_conacp),
      toFloatFlexible(r.prediction_by_acpred),
      toTextOrNull(r.prediction_by_toxinpred),
    ],
  },
  {
    table: "host_taxonomy",
    dataset: "hostTaxonomy",
    heavy: true,
    columns: [
      "run_id TEXT NOT NULL",
      "contig TEXT",
      "phylum TEXT",
      "class TEXT",
      "order_name TEXT",
      "family TEXT",
      "genus TEXT",
      "species TEXT",
    ],
    insertColumns: [
      "run_id",
      "contig",
      "phylum",
      "class",
      "order_name",
      "family",
      "genus",
      "species",
    ],
    map: (r) => [
      toTextOrNull(r.RunID),
      toTextOrNull(r.Contig),
      toTextOrNull(r.Phylum),
      toTextOrNull(r.Class),
      toTextOrNull(r.Order),
      toTextOrNull(r.Family),
      toTextOrNull(r.Genus),
      toTextOrNull(r.Species),
    ],
  },
  {
    table: "pfam_ko",
    dataset: "pfamKo",
    heavy: true,
    columns: ["run_id TEXT NOT NULL", "contig_id TEXT", "pfam TEXT", "kofam TEXT"],
    insertColumns: ["run_id", "contig_id", "pfam", "kofam"],
    map: (r) => [
      toTextOrNull(r.id),
      toTextOrNull(r.contig_id),
      toTextOrNull(r.pfam),
      toTextOrNull(r.kofam),
    ],
  },
];

export const ANNOTATION_INDEXES = [
  "CREATE INDEX idx_amr_run ON amr(run_id)",
  "CREATE INDEX idx_cazyme_run ON cazyme(run_id)",
  "CREATE INDEX idx_crispr_cas_run ON crispr_cas(run_id)",
  "CREATE INDEX idx_amp_run ON amp(run_id)",
  "CREATE INDEX idx_acp_run ON acp(run_id)",
];

export const HEAVY_INDEXES = {
  host_taxonomy: [
    "CREATE INDEX idx_host_taxonomy_run ON host_taxonomy(run_id)",
    "CREATE INDEX idx_host_taxonomy_family ON host_taxonomy(family)",
  ],
  pfam_ko: ["CREATE INDEX idx_pfam_ko_run ON pfam_ko(run_id)"],
};
