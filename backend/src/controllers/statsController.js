import { readAll } from "../config/store.js";
import { centroidFor, countryName } from "../config/countries.js";
// NOTE: getOverview/getCategoryShare/getAnnotationFlow/getMapData
// (yukarıdaki fonksiyonlar) BİLEREK değiştirilmedi, hâlâ eski gfpr.json
// tabanlı veriyi kullanıyorlar. getTaxonomy (en alttaki YENİ fonksiyon) ise
// bambaşka bir kaynaktan, config/db.js'teki SQLite host_taxonomy
// tablosundan (hotspot.tsv'den import edilen) okuyor — importAllData.js
// çalıştırılmadıysa bu tablo yok olabilir, o durumu da ele alıyor.
import { db, tableExists } from "../config/db.js";

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
// NOTE: "hosts" sayısı önce SQLite host_taxonomy tablosundan (hotspot.tsv'ın
// Species sütunu) çekilmeye çalışılır — bu veriler filogen*etik sınıflandırmayı
// kapsıyor ve daha doğru. Tablo yoksa Excel'deki (gfpr.json) host alanına
// düşer.
export function getOverview(req, res) {
  const data = readAll();

  const totalSamples = data.length;
  const categories = new Set(data.map((r) => r.category).filter(Boolean)).size;
  const countries = new Set(data.map((r) => r.country).filter(Boolean)).size;
  const databaseOrigins = Array.from(new Set(data.map((r) => r.database_origin).filter(Boolean))).sort();
  const totalPlasmidContigs = data.reduce((sum, r) => sum + (Number(r.plasmid_contig_counts) || 0), 0);

  // Host tür sayısı: host_taxonomy tablosu varsa oradan (species seviyesi),
  // yoksa gfpr.json'daki host alanından say.
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
// kaç FARKLI ID ile çalıştığı (COUNT DISTINCT). Genişlik bu sayıya göre
// belirlenir; cazyme tablosu run_id sütunuyla indexlendi.
export function getAnnotationFlow(req, res) {
  const data = readAll();

  // Kategori başına run_id ve sample_id listesi oluştur
  const catToRunIds = {};
  const catToSampleIds = {};
  for (const r of data) {
    if (!r.category) continue;
    if (r.run_id) {
      if (!catToRunIds[r.category]) catToRunIds[r.category] = [];
      catToRunIds[r.category].push(r.run_id);
    }
    if (r.sample_id) {
      if (!catToSampleIds[r.category]) catToSampleIds[r.category] = [];
      catToSampleIds[r.category].push(r.sample_id);
    }
  }

  // Her annotation tipi için hangi tablo, hangi id sütunu kullanılacak
  const annotationTableMap = {
    amr:       { table: "amr",       idCol: "sample_id" },
    cazyme:    { table: "cazyme",    idCol: "run_id"    }, // cazyme run_id ile indexlendi
    cgc:       { table: "cgc",       idCol: "sample_id" },
    crispr:    { table: "crispr_cas",idCol: "sample_id" },
    amp:       { table: "amp",       idCol: "sample_id" },
    acp:       { table: "acp",       idCol: "sample_id" },
    pfam_kegg: { table: "pfam_ko",   idCol: "sample_id" },
  };

  const targetKeys = Object.keys(annotationTableMap);

  // Kategori başına annotation tiplerini COUNT DISTINCT ile say
  const byCategory = {};
  const allCategories = new Set([...Object.keys(catToRunIds), ...Object.keys(catToSampleIds)]);

  for (const cat of allCategories) {
    byCategory[cat] = Object.fromEntries(targetKeys.map((k) => [k, 0]));

    for (const targetKey of targetKeys) {
      const { table, idCol } = annotationTableMap[targetKey];
      if (!tableExists(table)) continue;

      // cazyme için run_id listesi, diğerleri için sample_id listesi
      const ids = idCol === "run_id" ? (catToRunIds[cat] || []) : (catToSampleIds[cat] || []);
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
        // tablo yoksa veya hata olursa 0 bırak
      }
    }
  }

  // Ham distinct sayıları dön (normalize edilmiyor) — frontend genişliği buna göre hesaplar
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
// NOTE: RadialTaxonomy figürü (frontend) için Phylum->Class->Order->
// Family hiyerarşisi (4 seviye — mock CLADO_NODES'un takip ettiği aynı
// derinlik). Genus/Species BİLEREK dahil edilmedi: gerçek veride bunlar
// çok sayıda benzersiz değer üretip ağacı okunmaz hale getirebilir; Family
// seviyesi görsel için yeterli çözünürlük sağlıyor. Kaynak: SQLite
// host_taxonomy tablosu (hotspot.tsv'den import edildi, importAllData.js).
// Eksik/boş rütbe değerleri (Excel'de "-") "Unclassified" olarak
// gruplanıyor ki ağaç kopmasın. Dönüş şekli, mock CLADO_NODES ile birebir
// aynı ({ id, level, label, parentId, phylumId }) + ekstra "count" alanı
// (frontend şu an kullanmıyor ama ileride örnek sayısı göstermek
// istenirse hazır).
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
      `SELECT phylum, class, order_name, family, COUNT(DISTINCT sample_id) as sampleCount
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
