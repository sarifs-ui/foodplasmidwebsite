import { readAll } from "../config/store.js";
import { db, tableExists } from "../config/db.js";

// GET /api/samples?category=&type=&subtype=&country=&year=&fermented=&q=&hostTaxonomy=&page=&pageSize=
export function listSamples(req, res) {
  const { category, type, subtype, country, year, fermented, q, hostTaxonomy } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 25));

  const toArray = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
  const catList = toArray(category);
  const typeList = toArray(type);
  const subtypeList = toArray(subtype);
  const countryList = toArray(country);
  const yearList = toArray(year).map(String);

  let data = readAll();

  if (catList.length) data = data.filter((r) => catList.includes(r.category));
  if (typeList.length) data = data.filter((r) => typeList.includes(r.type));
  if (subtypeList.length) data = data.filter((r) => subtypeList.includes(r.sub_type));
  if (countryList.length) data = data.filter((r) => countryList.includes(r.country));
  if (yearList.length) data = data.filter((r) => yearList.includes(String(r.year)));
  if (fermented === "true" || fermented === "1") data = data.filter((r) => r.fermented === true);
  if (fermented === "false" || fermented === "0") data = data.filter((r) => r.fermented === false);

  // hostTaxonomy filtresi: host_taxonomy tablosunda phylum/class/order/family/genus/species
  // eşleşen run_id'leri bul, sonra o ID'lerle kesişim yap.
  if (hostTaxonomy && tableExists("host_taxonomy")) {
    try {
      const needle = `%${hostTaxonomy}%`;
      const rows = db
        .prepare(
          `SELECT DISTINCT run_id FROM host_taxonomy
           WHERE phylum LIKE ? OR class LIKE ? OR order_name LIKE ?
              OR family LIKE ? OR genus LIKE ? OR species LIKE ?`
        )
        .all(needle, needle, needle, needle, needle, needle);
      const matchedIds = new Set(rows.map((r) => r.run_id));
      data = data.filter((r) => matchedIds.has(r.run_id) || matchedIds.has(r.sample_id));
    } catch {
      // host_taxonomy yoksa veya hata olursa filtre uygulanmaz
    }
  }

  if (q) {
    const needle = q.toLowerCase();
    data = data.filter((r) =>
      [r.sample_id, r.category, r.type, r.sub_type, r.host, r.country]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle))
    );
  }

  const total = data.length;
  const start = (page - 1) * pageSize;
  const pageRows = data.slice(start, start + pageSize).map((r) => ({
    id: r.sample_id,
    category: r.category,
    country: r.country,
    type: r.type,
    subtype: r.sub_type,
    host: r.host,
    year: r.year,
    fermented: r.fermented,
    sizeContigs: r.plasmid_contig_counts,
  }));

  res.json({ total, page, pageSize, results: pageRows });
}


// Annotation hit'lerini SQLite DB'den run_id kullanarak çeker.
// Her annotation tipi için ayrı bir tablo sorgusu yapılır.
function getAnnotationsFromDb(runId) {
  if (!runId) return [];

  const annotationDefs = [
    {
      key: "amr",
      table: "amr",
      labelCol: "class",
      idCol: "run_id",
      condition: `type IN ('AMR', 'STRESS')`,
    },
    {
      key: "cazyme",
      table: "cazyme",
      labelCol: "family",
      idCol: "run_id",
      condition: null,
    },
    {
      key: "cgc",
      table: "cgc",
      labelCol: "gene_annotation",
      idCol: "run_id",
      condition: null,
    },
    {
      key: "crispr_cas",
      table: "crispr_cas",
      labelCol: "type",
      idCol: "run_id",
      condition: null,
    },
    {
      key: "amp",
      table: "amp",
      labelCol: "amp_family",
      idCol: "run_id",
      condition: null,
    },
    {
      key: "acp",
      table: "acp",
      labelCol: "sequence",
      idCol: "run_id",
      condition: null,
    },
    {
      key: "pfam_ko",
      table: "pfam_ko",
      labelCol: "kegg_ko",
      idCol: "run_id",
      condition: null,
    },
  ];

  return annotationDefs.map(({ key, table, labelCol, idCol, condition }) => {
    if (!tableExists(table)) return { key, count: 0, hits: [] };
    try {
      const whereClause = condition
        ? `WHERE ${idCol} = ? AND ${condition}`
        : `WHERE ${idCol} = ?`;
      const rows = db
        .prepare(`SELECT ${labelCol} FROM ${table} ${whereClause} LIMIT 200`)
        .all(runId);
      const hits = rows
        .map((r) => r[labelCol])
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i); // deduplicate

      let extra = {};
      if (key === "cgc") {
        try {
          const cgcGenes = db
            .prepare(
              `SELECT cgc_num, gene_type, contig_id, gene_start, gene_stop, gene_strand, gene_annotation, recommend_results, substrate, cazy_category, category, cluster_start, cluster_end, length_bp 
               FROM cgc WHERE run_id = ? 
               ORDER BY COALESCE(cluster_start, gene_start, 0), gene_start ASC LIMIT 200`
            )
            .all(runId);
          extra.cgcGenes = cgcGenes;
        } catch {
          extra.cgcGenes = [];
        }
      }

      return { key, count: rows.length, hits, ...extra };
    } catch {
      return { key, count: 0, hits: [] };
    }
  });
}

// GET /api/samples/:id
// Annotation hit'leri artık SQLite gfpr.db'den run_id ile çekiliyor.
export function getSampleById(req, res) {
  const row = readAll().find((r) => r.sample_id === req.params.id || r.run_id === req.params.id);
  if (!row) return res.status(404).json({ error: "Sample not found" });

  // run_id ile SQLite'tan gerçek anotasyonları çek
  const annotations = getAnnotationsFromDb(row.run_id);

  // host bilgisi boşsa host_taxonomy tablosundan tamamlamayı dene
  let host = row.host;
  if (!host && tableExists("host_taxonomy")) {
    try {
      const taxRow = db
        .prepare(
          `SELECT species, genus, family FROM host_taxonomy 
           WHERE run_id = ? AND species IS NOT NULL AND species != 'Unclassified' 
           LIMIT 1`
        )
        .get(row.run_id);
      if (taxRow) {
        host = taxRow.species || taxRow.genus || taxRow.family;
      }
    } catch {}
  }

  res.json({
    id: row.sample_id,
    projectId: row.project_id,
    sampleAcc: row.sample_acc,
    runId: row.run_id,
    category: row.category,
    type: row.type,
    subtype: row.sub_type,
    fermented: row.fermented,
    country: row.country,
    year: row.year,
    databaseOrigin: row.database_origin,
    host: host,
    plasmidContigCounts: row.plasmid_contig_counts,
    classified: row.classified,
    unclassified: row.unclassified,
    hotspot: row.hotspot,
    annotations,
  });
}
