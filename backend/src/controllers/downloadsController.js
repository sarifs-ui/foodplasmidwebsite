// NOTE: Bu controller iki farklı veri kaynağını birleştirir:
//   - metadata.csv       -> config/store.js (gfpr.json, mevcut sistem)
//   - annotations/*.csv  -> config/db.js (SQLite, yeni anotasyon tabloları)
// Her ikisi de sample_id üzerinden filtrelenip TEK bir zip içinde
// birleştiriliyor. Runtime'da hiçbir yere yazma yok, sadece okuma + stream.
import archiver from "archiver";
import { readAll } from "../config/store.js";
import { db, tableExists } from "../config/db.js";
import { rowsToCsv } from "../utils/csv.js";

// Frontend'in POST /api/downloads/export'a gönderebileceği annotation
// anahtarlarının KESİN listesi (EXPORT_ANNOTATION_KEYS ile birebir aynı
// tutulmalı — App.jsx'teki sabitle senkron kalsın diye burada da açıkça
// yazıldı, tek bir yerden import edilmiyor çünkü frontend/backend ayrı
// paketler).
const EXPORT_ANNOTATION_KEYS = ["amr", "cazyme", "cgc", "crispr_cas", "amp", "pfam_ko"];

// SQLite'ın tek sorguda kabul ettiği parametre sayısı sürüme göre değişir
// (eski sürümlerde varsayılan 999); büyük sample_id listelerinde "too many
// SQL variables" hatası almamak için sorguyu parçalara bölüyoruz.
const CHUNK_SIZE = 400;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Bir anotasyon tablosundan, verilen ID listesine ait TÜM satırları çeker.
// idColumn: tablonun filtreleme sütunu (çoğu tablo için "sample_id",
// cazyme tablosu için "run_id"). Tablo hiç import edilmemişse null döner.
function getAnnotationRows(tableName, sampleIds, idColumn = "sample_id") {
  if (!tableExists(tableName)) return null;
  let allRows = [];
  for (const idsChunk of chunk(sampleIds, CHUNK_SIZE)) {
    if (idsChunk.length === 0) continue;
    const placeholders = idsChunk.map(() => "?").join(",");
    const rows = db
      .prepare(`SELECT * FROM ${tableName} WHERE ${idColumn} IN (${placeholders})`)
      .all(...idsChunk);
    allRows = allRows.concat(rows);
  }
  // İç autoincrement "id" sütununu CSV'ye dahil etme.
  return allRows.map(({ id, ...rest }) => rest);
}

// Ana samples tablosundan (gfpr.json) sadece gerçek metadata sütunlarını
// seçiyoruz — eski "amr/amp/cazyme/..." virgüllü özet metin sütunlarını
// BİLEREK dışarıda bırakıyoruz, çünkü artık gerçek gen seviyeli karşılığı
// annotations/*.csv olarak ayrıca indirilebiliyor; ikisini birden
// metadata.csv'ye koymak veriyi iki kez, iki farklı biçimde tekrar ederdi.
const METADATA_COLUMNS = [
  "sample_id", "project_id", "sample_acc", "run_id", "category", "type",
  "sub_type", "fermented", "country", "year", "database_origin", "host",
  "plasmid_contig_counts", "classified", "unclassified", "hotspot",
];

function getMetadataRows(sampleIdSet) {
  const all = readAll();
  const filtered = sampleIdSet ? all.filter((r) => sampleIdSet.has(r.sample_id)) : all;
  return filtered.map((r) => {
    const out = {};
    for (const col of METADATA_COLUMNS) out[col] = r[col];
    return out;
  });
}

// POST /api/downloads/export
// Body: { sampleIds: string[], include: { metadata: boolean, annotations: string[] } }
export async function exportDownload(req, res) {
  const { sampleIds = [], include = {} } = req.body || {};
  const wantMetadata = !!include.metadata;
  const wantedAnnotations = Array.isArray(include.annotations)
    ? include.annotations.filter((k) => EXPORT_ANNOTATION_KEYS.includes(k))
    : [];

  if (!wantMetadata && wantedAnnotations.length === 0) {
    return res.status(400).json({
      error: "include.metadata veya include.annotations içinden en az biri seçilmeli",
    });
  }

  // NOTE: sampleIds boş dizi gelirse "tüm örnekler" anlamına geliyor —
  // frontend, hiçbir satır seçilmediğinde bunu "mevcut sonuç kümesinin
  // tamamı" niyetiyle gönderiyor. ÖNEMLİ SINIRLAMA: frontend şu an aktif
  // filtre parametrelerini (kategori/ülke/yıl vb.) export isteğine
  // eklemiyor, sadece checkbox ile seçilmiş ID'leri gönderiyor — yani boş
  // seçimde gerçekten TÜM veritabanı dönüyor, o anki filtrelenmiş sayfa
  // değil. Bunu değiştirmek istersen: frontend'e filtre parametrelerini de
  // body'ye eklet, burada samplesController'daki filtre mantığını (kategori/
  // tip/ülke/yıl/fermented) yeniden kullanarak sample_id listesini üret.
  const allMetadata = readAll();
  const effectiveIds = sampleIds.length > 0
    ? sampleIds
    : allMetadata.map((r) => r.sample_id);
  const idSet = new Set(effectiveIds);

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="gfpr-export.zip"');

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => {
    // Header'lar muhtemelen zaten gönderildi, stream'i kapatmaktan başka
    // yapılabilecek bir şey yok.
    console.error("Zip export hatası:", err);
    res.end();
  });
  archive.pipe(res);

  if (wantMetadata) {
    const rows = getMetadataRows(idSet);
    archive.append(rowsToCsv(rows), { name: "metadata.csv" });
  }

  // cazyme tablosu run_id ile indexlendi; export için run_id listesi gerekli.
  const effectiveRunIds = effectiveIds.length > 0
    ? allMetadata.filter((r) => idSet.has(r.sample_id)).map((r) => r.run_id).filter(Boolean)
    : allMetadata.map((r) => r.run_id).filter(Boolean);

  for (const key of wantedAnnotations) {
    // cazyme run_id, diğerleri sample_id sütunu ile filtrelenir.
    const isCazyme = key === "cazyme";
    const rows = getAnnotationRows(key, isCazyme ? effectiveRunIds : effectiveIds, isCazyme ? "run_id" : "sample_id");
    if (rows === null) {
      archive.append(
        `${key} tablosu henüz import edilmemiş. Backend'de ` +
          `"npm run import-annotations" komutunu çalıştırmayı unutmuş olabilirsin.\n`,
        { name: `annotations/${key}_EKSIK.txt` }
      );
      continue;
    }
    archive.append(rowsToCsv(rows), { name: `annotations/${key}.csv` });
  }

  await archive.finalize();
}
