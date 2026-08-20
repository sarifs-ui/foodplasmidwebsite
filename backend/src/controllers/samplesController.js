import { readAll } from "../config/store.js";

// GET /api/samples?category=&type=&subtype=&country=&year=&fermented=&q=&page=&pageSize=
export function listSamples(req, res) {
  const { category, type, subtype, country, year, fermented, q } = req.query;
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

// Metin listesini ("AMINOGLYCOSIDE, TETRACYCLINE") gerçek hit dizisine çevirir.
function toHitList(text) {
  if (!text) return [];
  return text.split(",").map((s) => s.trim()).filter(Boolean);
}

// GET /api/samples/:id
// Annotation hit'leri artık GERÇEK (Excel'deki metin listesinden geliyor) —
// eskisi gibi mock isim üretilmiyor. FASTA hâlâ mock (o veri elimizde yok).
export function getSampleById(req, res) {
  const row = readAll().find((r) => r.sample_id === req.params.id);
  if (!row) return res.status(404).json({ error: "Sample not found" });

  const annotationKeys = ["amr", "cazyme", "cgc", "crispr_cas", "amp", "acp", "pfam_ko"];
  const annotations = annotationKeys.map((key) => {
    const hits = toHitList(row[key]);
    return { key, count: hits.length, hits };
  });

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
    host: row.host,
    plasmidContigCounts: row.plasmid_contig_counts,
    classified: row.classified,
    unclassified: row.unclassified,
    hotspot: row.hotspot,
    annotations,
    fastaPreview: { mock: true, note: "Gerçek FASTA verisi bağlanmadı, bu alan mock." },
  });
}
