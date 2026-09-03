import { readRows } from "../../ingest/lib/csvSource.js";
import { datasetExists } from "../../ingest/lib/datasets.js";
import { COUNTRIES, centroidFor, countryName, countryNumeric } from "../../config/countries.js";
import { loadDerived } from "../../data/derivedStore.js";
import { memoize, readAll } from "../../data/sampleStore.js";

/** Headline counters for the overview tiles. */
export function getOverview() {
  return memoize("overview", (samples) => {
    const categories = new Set();
    const countries = new Set();
    const databaseOrigins = new Set();
    let totalPlasmidContigs = 0;
    let classified = 0;
    let unclassified = 0;

    for (const s of samples) {
      if (s.category) categories.add(s.category);
      if (s.country) countries.add(s.country);
      if (s.database_origin) databaseOrigins.add(s.database_origin);
      totalPlasmidContigs += s.plasmid_contig_counts || 0;
      classified += s.classified || 0;
      unclassified += s.unclassified || 0;
    }

    return {
      totalSamples: samples.length,
      categories: categories.size,
      countries: countries.size,
      hosts: loadDerived().taxonomy.familyCount,
      databaseOrigins: Array.from(databaseOrigins).sort(),
      totalPlasmidContigs,
      classifiedContigs: classified,
      unclassifiedContigs: unclassified,
    };
  });
}

/** Sample share per food category, with a running cumulative share. */
export function getCategoryShare() {
  return memoize("categoryShare", (samples) => {
    const counts = new Map();
    for (const s of samples) {
      if (!s.category) continue;
      counts.set(s.category, (counts.get(s.category) || 0) + 1);
    }
    const total = samples.length || 1;
    let running = 0;
    return Array.from(counts, ([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
      .map(({ key, count }) => {
        running += count;
        return {
          key,
          count,
          value: Number(((100 * count) / total).toFixed(1)),
          cumulative: Number(((100 * running) / total).toFixed(1)),
        };
      });
  });
}

/**
 * Category -> functional feature-class matrix for the chord figure.
 *
 * Served straight from chord.csv. That file is externally produced and is the
 * only source for three of its six classes (Heat Resistance, Heavy Metal
 * Resistance, Virulence), which have no underlying per-gene file, so it is
 * treated as a source rather than something to recompute.
 */
let chordCache = null;

export function getAnnotationFlow() {
  if (chordCache) return chordCache;
  if (!datasetExists("chord")) return [];

  const rows = readRows("chord");
  if (rows.length === 0) return [];

  // The first column is unnamed in the file and holds the category label.
  const headers = Object.keys(rows[0]);
  const labelColumn = headers[0];
  const classColumns = headers.slice(1);

  chordCache = rows
    .map((row) => {
      const values = {};
      for (const column of classColumns) {
        const n = Number.parseFloat(row[column]);
        values[toClassKey(column)] = Number.isFinite(n) ? n : 0;
      }
      return { key: String(row[labelColumn]).trim(), values };
    })
    .filter((entry) => entry.key && Object.values(entry.values).some((v) => v > 0));

  return chordCache;
}

/** "Heavy Metal Resistance" -> "heavy_metal_resistance" */
function toClassKey(label) {
  return String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

/** The class keys and display labels the chord figure should render. */
export function getAnnotationFlowClasses() {
  if (!datasetExists("chord")) return [];
  const rows = readRows("chord");
  if (rows.length === 0) return [];
  return Object.keys(rows[0])
    .slice(1)
    .map((label) => ({ key: toClassKey(label), label: label.trim() }));
}

/** Phylum -> Class -> Order -> Family tree, precomputed at build time. */
export function getTaxonomy() {
  const { taxonomy } = loadDerived();
  return { nodes: taxonomy.nodes, categories: taxonomy.categories };
}

/**
 * Per-country sample counts for the choropleth.
 *
 * `numeric` is the ISO 3166-1 numeric code the map joins on; `code` is the
 * alpha-3 the sample filter expects. Returning both is what makes the
 * "See {country} samples" link work.
 */
export function getMapData() {
  return memoize("map", (samples) => {
    const byCountry = new Map();

    for (const s of samples) {
      if (!s.country) continue;
      let entry = byCountry.get(s.country);
      if (!entry) {
        entry = { count: 0, contigs: 0, categories: new Map() };
        byCountry.set(s.country, entry);
      }
      entry.count += 1;
      entry.contigs += s.plasmid_contig_counts || 0;
      if (s.category) {
        entry.categories.set(s.category, (entry.categories.get(s.category) || 0) + 1);
      }
    }

    return Array.from(byCountry, ([code, entry]) => {
      let dominant = null;
      let max = 0;
      for (const [category, n] of entry.categories) {
        if (n > max) {
          max = n;
          dominant = category;
        }
      }
      const centroid = centroidFor(code);
      return {
        code,
        numeric: countryNumeric(code),
        label: countryName(code),
        known: Object.prototype.hasOwnProperty.call(COUNTRIES, code),
        lat: centroid ? centroid[0] : null,
        lon: centroid ? centroid[1] : null,
        count: entry.count,
        contigs: entry.contigs,
        category: dominant,
      };
    }).sort((a, b) => b.count - a.count);
  });
}

/**
 * Share of plasmid contigs per food category.
 *
 * Deliberately separate from category-share: a category can hold few samples
 * but many contigs (and vice versa), so the two distributions differ.
 */
export function getContigShare() {
  return memoize("contigShare", (samples) => {
    const counts = new Map();
    for (const s of samples) {
      if (!s.category) continue;
      counts.set(s.category, (counts.get(s.category) || 0) + (s.plasmid_contig_counts || 0));
    }
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;
    let running = 0;
    return Array.from(counts, ([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
      .map(({ key, count }) => {
        running += count;
        return {
          key,
          count,
          value: Number(((100 * count) / total).toFixed(1)),
          cumulative: Number(((100 * running) / total).toFixed(1)),
        };
      });
  });
}
