import { readAll } from "../config/store.js";
import { centroidFor, countryName } from "../config/countries.js";
import { db, tableExists } from "../config/db.js";

const ANNOTATION_FIELD_MAP = {
  amr: "amr",
  cazyme: "cazyme",
  cgc: "cgc",
  crispr: "crispr_cas",
  amp: "amp",
  acp: "acp",
  pfam_kegg: "pfam_ko",
};

const ANNOTATION_TABLE_MAP = {
  amr:       { table: "amr",       idCol: "run_id" },
  cazyme:    { table: "cazyme",    idCol: "run_id" },
  cgc:       { table: "cgc",       idCol: "run_id" },
  crispr:    { table: "crispr_cas",idCol: "run_id" },
  amp:       { table: "amp",       idCol: "run_id" },
  acp:       { table: "acp",       idCol: "run_id" },
  pfam_kegg: { table: "pfam_ko",   idCol: "run_id" },
};

// GET /api/stats/overview
export function getOverview(req, res) {
  const data = readAll();

  const totalSamples = data.length;
  const categories = new Set(data.map((r) => r.category).filter(Boolean)).size;
  const countries = new Set(data.map((r) => r.country).filter(Boolean)).size;
  const databaseOrigins = Array.from(new Set(data.map((r) => r.database_origin).filter(Boolean))).sort();
  const totalPlasmidContigs = data.reduce((sum, r) => sum + (Number(r.plasmid_contig_counts) || 0), 0);

  let hosts;
  if (tableExists("host_taxonomy")) {
    try {
      const row = db
        .prepare(
          `SELECT COUNT(DISTINCT species) as cnt FROM host_taxonomy WHERE species IS NOT NULL AND species != 'Unclassified'`
        )
        .get();
      hosts = row ? row.cnt : 0;
    } catch {
      hosts = new Set(data.map((r) => r.host).filter(Boolean)).size;
    }
  } else {
    hosts = new Set(data.map((r) => r.host).filter(Boolean)).size;
  }

  res.json({ totalSamples, categories, hosts, countries, databaseOrigins, totalPlasmidContigs });
}

// GET /api/stats/category-share
export function getCategoryShare(req, res) {
  const data = readAll();
  const total = data.length || 1;

  const counts = {};
  for (const r of data) {
    if (!r.category) continue;
    counts[r.category] = (counts[r.category] || 0) + 1;
  }

  const result = Object.entries(counts)
    .map(([key, count]) => ({ key, value: Math.round((count / total) * 1000) / 10 }))
    .sort((a, b) => b.value - a.value);

  res.json(result);
}

// GET /api/stats/annotation-flow
export function getAnnotationFlow(req, res) {
  const data = readAll();

  const catToRunIds = {};
  for (const r of data) {
    if (!r.category) continue;
    if (r.run_id) {
      if (!catToRunIds[r.category]) catToRunIds[r.category] = [];
      catToRunIds[r.category].push(r.run_id);
    }
  }

  const targetKeys = Object.keys(ANNOTATION_TABLE_MAP);
  const byCategory = {};
  const allCategories = new Set(Object.keys(catToRunIds));

  for (const cat of allCategories) {
    byCategory[cat] = Object.fromEntries(targetKeys.map((k) => [k, 0]));

    for (const targetKey of targetKeys) {
      const { table, idCol } = ANNOTATION_TABLE_MAP[targetKey];
      if (!tableExists(table)) continue;

      const ids = catToRunIds[cat] || [];
      if (ids.length === 0) continue;

      try {
        const CHUNK = 900;
        let distinctCount = 0;
        for (let i = 0; i < ids.length; i += CHUNK) {
          const chunk = ids.slice(i, i + CHUNK);
          const placeholders = chunk.map(() => "?").join(",");
          const row = db
            .prepare(`SELECT COUNT(DISTINCT ${idCol}) as cnt FROM ${table} WHERE ${idCol} IN (${placeholders})`)
            .get(...chunk);
          distinctCount += row ? row.cnt : 0;
        }
        byCategory[cat][targetKey] = distinctCount;
      } catch {
        // ignore
      }
    }
  }

  const result = Object.entries(byCategory)
    .map(([key, values]) => {
      const total = Object.values(values).reduce((a, b) => a + b, 0);
      if (total === 0) return null;
      return { key, values };
    })
    .filter(Boolean);

  res.json(result);
}

// GET /api/stats/taxonomy
export function getTaxonomy(req, res) {
  if (!tableExists("host_taxonomy")) {
    return res.status(503).json({
      error:
        "host_taxonomy tablosu henüz oluşturulmadı — backend'de 'npm run " +
        "import-annotations' komutu çalıştırılmalı (hotspot.tsv'den içe aktarılıyor).",
    });
  }

  const rows = db
    .prepare(
      `SELECT phylum, class, order_name, family, COUNT(DISTINCT run_id) as sampleCount
       FROM host_taxonomy
       WHERE phylum IS NOT NULL
       GROUP BY phylum, class, order_name, family`
    )
    .all();

  const UNCLASSIFIED = "Unclassified";
  const nodesById = new Map();

  function ensureNode(id, level, label, parentId, phylumId, countDelta) {
    let node = nodesById.get(id);
    if (!node) {
      node = { id, level, label, parentId, phylumId, count: 0 };
      nodesById.set(id, node);
    }
    node.count += countDelta;
    return node;
  }

  for (const r of rows) {
    const phylum = r.phylum || UNCLASSIFIED;
    const cls = r.class || UNCLASSIFIED;
    const order = r.order_name || UNCLASSIFIED;
    const family = r.family || UNCLASSIFIED;
    const n = r.sampleCount;

    const phylumId = `p:${phylum}`;
    const classId = `${phylumId}|c:${cls}`;
    const orderId = `${classId}|o:${order}`;
    const familyId = `${orderId}|f:${family}`;

    ensureNode(phylumId, 0, phylum, null, phylumId, n);
    ensureNode(classId, 1, cls, phylumId, phylumId, n);
    ensureNode(orderId, 2, order, classId, phylumId, n);
    ensureNode(familyId, 3, family, orderId, phylumId, n);
  }

  res.json(Array.from(nodesById.values()));
}

// GET /api/stats/map
export function getMapData(req, res) {
  const data = readAll();

  const byCountry = {};
  for (const r of data) {
    if (!r.country) continue;
    if (!byCountry[r.country]) byCountry[r.country] = { count: 0, catCounts: {} };
    byCountry[r.country].count += 1;
    if (r.category) {
      byCountry[r.country].catCounts[r.category] = (byCountry[r.country].catCounts[r.category] || 0) + 1;
    }
  }

  const result = Object.entries(byCountry).map(([code, info]) => {
    const centroid = centroidFor(code);
    let dominantCategory = null;
    let max = 0;
    for (const [cat, c] of Object.entries(info.catCounts)) {
      if (c > max) {
        max = c;
        dominantCategory = cat;
      }
    }
    return {
      label: countryName(code),
      lat: centroid ? centroid[0] : null,
      lon: centroid ? centroid[1] : null,
      count: info.count,
      category: dominantCategory,
    };
  });

  res.json(result);
}

// GET /api/stats/country/:country
export function getCountryStats(req, res) {
  const { country } = req.params;
  const data = readAll();
  const countryRows = data.filter(
    (r) => r.country === country || countryName(r.country) === country
  );

  if (countryRows.length === 0) {
    return res.status(404).json({ error: "Country not found" });
  }

  const runIds = countryRows.map((r) => r.run_id).filter(Boolean);
  if (runIds.length === 0) {
    return res.json({ dominantAnnotations: {} });
  }

  const dominantAnnotations = {};
  const CHUNK = 900;
  const idsChunk = runIds.slice(0, CHUNK);
  const placeholders = idsChunk.map(() => "?").join(",");

  // For host taxonomy (species)
  if (tableExists("host_taxonomy")) {
    try {
      const rows = db
        .prepare(
          `SELECT species, COUNT(*) as cnt FROM host_taxonomy 
           WHERE run_id IN (${placeholders}) AND species IS NOT NULL AND species != 'Unclassified' 
           GROUP BY species ORDER BY cnt DESC LIMIT 1`
        )
        .all(...idsChunk);
      if (rows.length > 0) {
        dominantAnnotations["taxonomy"] = { label: rows[0].species, count: rows[0].cnt };
      }
    } catch {}
  }

  const targetKeys = Object.keys(ANNOTATION_TABLE_MAP);
  for (const targetKey of targetKeys) {
    const { table } = ANNOTATION_TABLE_MAP[targetKey];
    if (!tableExists(table)) continue;

    let labelCol = "class";
    if (table === "amr") labelCol = "class";
    if (table === "cazyme") labelCol = "family";
    if (table === "cgc") labelCol = "gene_annotation";
    if (table === "crispr_cas") labelCol = "type";
    if (table === "amp") labelCol = "amp_family";
    if (table === "acp") labelCol = "sequence";
    if (table === "pfam_ko") labelCol = "kegg_ko";

    try {
      const rows = db
        .prepare(
          `SELECT ${labelCol} as label, COUNT(*) as cnt FROM ${table} 
           WHERE run_id IN (${placeholders}) AND ${labelCol} IS NOT NULL 
           GROUP BY ${labelCol} ORDER BY cnt DESC LIMIT 1`
        )
        .all(...idsChunk);
      if (rows.length > 0) {
        dominantAnnotations[targetKey] = { label: rows[0].label, count: rows[0].cnt };
      }
    } catch {}
  }

  res.json({ dominantAnnotations });
}
