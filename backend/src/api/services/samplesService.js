import { ANNOTATIONS, RETIRED_ANNOTATIONS } from "../../config/annotations.js";
import { countryName } from "../../config/countries.js";
import { db, tableExists } from "../../data/annotationsDb.js";
import { loadDerived } from "../../data/derivedStore.js";
import { byRunId, memoize, readAll } from "../../data/sampleStore.js";

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 25;
const MAX_HITS = 200;

function toArray(value) {
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

/** Shape a stored record for the samples table. */
function toListRow(record) {
  return {
    id: record.run_id,
    category: record.category,
    type: record.type,
    subtype: record.sub_type,
    country: record.country,
    countryName: countryName(record.country),
    year: record.year,
    fermented: record.fermented,
    sizeContigs: record.plasmid_contig_counts,
    host: loadDerived().hostByRun[record.run_id] ?? null,
  };
}

export function listSamples(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(query.pageSize, 10) || DEFAULT_PAGE_SIZE)
  );

  const categories = toArray(query.category);
  const types = toArray(query.type);
  const subtypes = toArray(query.subtype);
  const countries = toArray(query.country);
  const years = toArray(query.year).map(String);
  const origins = toArray(query.databaseOrigin);

  let data = readAll();

  if (categories.length) data = data.filter((r) => categories.includes(r.category));
  if (types.length) data = data.filter((r) => types.includes(r.type));
  if (subtypes.length) data = data.filter((r) => subtypes.includes(r.sub_type));
  if (countries.length) data = data.filter((r) => countries.includes(r.country));
  if (years.length) data = data.filter((r) => years.includes(String(r.year)));
  if (origins.length) data = data.filter((r) => origins.includes(r.database_origin));

  if (query.fermented === "true" || query.fermented === "1") {
    data = data.filter((r) => r.fermented === true);
  }
  if (query.fermented === "false" || query.fermented === "0") {
    data = data.filter((r) => r.fermented === false);
  }

  if (query.q) {
    const needle = String(query.q).toLowerCase();
    data = data.filter((r) =>
      [r.run_id, r.biosample_id, r.project_id, r.category, r.type, r.sub_type, r.country]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle))
    );
  }

  const total = data.length;
  const start = (page - 1) * pageSize;

  return {
    total,
    page,
    pageSize,
    results: data.slice(start, start + pageSize).map(toListRow),
  };
}

/** Distinct values for the filter chips. */
export function getFilterOptions() {
  return memoize("filters", (samples) => {
    const distinct = (field) =>
      Array.from(new Set(samples.map((r) => r[field]).filter(Boolean))).sort();

    return {
      categories: distinct("category"),
      types: distinct("type"),
      subtypes: distinct("sub_type"),
      countries: distinct("country"),
      years: Array.from(new Set(samples.map((r) => r.year).filter(Boolean))).sort((a, b) =>
        String(b).localeCompare(String(a))
      ),
      databaseOrigins: distinct("database_origin"),
    };
  });
}

/**
 * Gene-level annotation hits for one run.
 *
 * Every table is keyed on run_id, so this is one uniform query shape. When a
 * table is absent the entry is returned with `available: false` rather than a
 * misleading zero count — and for pfam/KO the count still comes from the
 * derived artifact, so it stays truthful without the heavy database.
 */
function getAnnotations(runId) {
  const derived = loadDerived();
  const pfamKoCounts = derived.pfamKoCountsByRun[runId];

  const entries = ANNOTATIONS.map((annotation) => {
    const base = {
      key: annotation.key,
      label: annotation.label,
      short: annotation.short,
      tool: annotation.tool,
    };

    if (!tableExists(annotation.table)) {
      // pfam/KO counts survive without the heavy table.
      if (annotation.key === "pfam_ko" && pfamKoCounts) {
        return {
          ...base,
          available: false,
          count: pfamKoCounts[1] || 0,
          hits: [],
          note: "Term list requires the full annotation database.",
        };
      }
      return { ...base, available: false, count: 0, hits: [] };
    }

    try {
      const { count } = db
        .prepare(`SELECT COUNT(*) AS count FROM ${annotation.table} WHERE run_id = ?`)
        .get(runId);

      const rows = db
        .prepare(
          `SELECT ${annotation.labelColumn} AS label FROM ${annotation.table}
            WHERE run_id = ? AND ${annotation.labelColumn} IS NOT NULL
            LIMIT ?`
        )
        .all(runId, MAX_HITS * 4);

      const labels = new Set();
      for (const row of rows) {
        if (annotation.multiValue) {
          for (const term of String(row.label).split(",")) {
            const t = term.trim();
            if (t && t !== "-") labels.add(t);
          }
        } else {
          labels.add(String(row.label));
        }
        if (labels.size >= MAX_HITS) break;
      }

      return { ...base, available: true, count, hits: Array.from(labels) };
    } catch {
      return { ...base, available: false, count: 0, hits: [] };
    }
  });

  // Surface retired annotation types explicitly rather than as silent zeros.
  for (const retired of RETIRED_ANNOTATIONS) {
    entries.push({ ...retired, available: false, count: 0, hits: [] });
  }

  return entries;
}

export function getSampleById(runId) {
  const record = byRunId(runId);
  if (!record) return null;

  return {
    id: record.run_id,
    runId: record.run_id,
    projectId: record.project_id,
    biosampleId: record.biosample_id,
    sampleAcc: record.sample_acc,
    category: record.category,
    type: record.type,
    subtype: record.sub_type,
    fermented: record.fermented,
    country: record.country,
    countryName: countryName(record.country),
    year: record.year,
    databaseOrigin: record.database_origin,
    plasmidContigCounts: record.plasmid_contig_counts,
    classified: record.classified,
    unclassified: record.unclassified,
    host: loadDerived().hostByRun[record.run_id] ?? null,
    annotations: getAnnotations(record.run_id),
  };
}
