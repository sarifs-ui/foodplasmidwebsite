import { readAll } from "../config/store.js";
import { centroidFor, countryName } from "../config/countries.js";

// Annotation sütunları artık metin listesi ("AMINOGLYCOSIDE, TETRACYCLINE").
// Hit sayısı bu listenin eleman sayısından hesaplanıyor — samplesController
// ile aynı mantık.
function hitCount(text) {
  if (!text) return 0;
  return text.split(",").map((s) => s.trim()).filter(Boolean).length;
}

// Frontend'deki (RibbonChord) hedef anahtarlar backend alan adlarıyla
// birebir aynı değil ("crispr" -> "crispr_cas", "pfam_kegg" -> "pfam_ko").
// Bu eşleme tek yerde tutuluyor ki iki taraf da tutarlı kalsın.
const ANNOTATION_FIELD_MAP = {
  amr: "amr",
  cazyme: "cazyme",
  cgc: "cgc",
  crispr: "crispr_cas",
  amp: "amp",
  acp: "acp",
  pfam_kegg: "pfam_ko",
};

// GET /api/stats/overview
export function getOverview(req, res) {
  const data = readAll();

  const totalSamples = data.length;
  const categories = new Set(data.map((r) => r.category).filter(Boolean)).size;
  const hosts = new Set(data.map((r) => r.host).filter(Boolean)).size;
  const countries = new Set(data.map((r) => r.country).filter(Boolean)).size;
  const databaseOrigins = Array.from(new Set(data.map((r) => r.database_origin).filter(Boolean))).sort();
  const totalPlasmidContigs = data.reduce((sum, r) => sum + (Number(r.plasmid_contig_counts) || 0), 0);

  res.json({ totalSamples, categories, hosts, countries, databaseOrigins, totalPlasmidContigs });
}

// GET /api/stats/category-share
// Kategori başına örnek sayısının toplam içindeki yüzdesi (1 ondalık).
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
// Figure A (chord diagram) için: her kategorinin her annotation tipinde
// kaç gerçek hit ürettiği. Değerler annotation metin listesinin uzunluğu
// toplanarak hesaplanıyor (mock değil, Excel'den gelen isim listesi).
export function getAnnotationFlow(req, res) {
  const data = readAll();
  const targetKeys = Object.keys(ANNOTATION_FIELD_MAP);

  const byCategory = {};
  for (const r of data) {
    if (!r.category) continue;
    if (!byCategory[r.category]) {
      byCategory[r.category] = Object.fromEntries(targetKeys.map((k) => [k, 0]));
    }
    for (const targetKey of targetKeys) {
      const field = ANNOTATION_FIELD_MAP[targetKey];
      byCategory[r.category][targetKey] += hitCount(r[field]);
    }
  }

  const result = Object.entries(byCategory).map(([key, values]) => ({ key, values }));
  res.json(result);
}

// GET /api/stats/map
// Ülke başına örnek sayısı (gerçek) + o ülkedeki en baskın kategori (gerçek)
// + yaklaşık merkez koordinat (mock centroid, countries.js'den).
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
