// Kullanım: npm run import-annotations  (backend/ içinden)
//
// NOTE: Bu script backend/data/ altındaki ham TSV/CSV dosyalarını
// okuyup backend/data/gfpr.db (SQLite) içine, her anotasyon tipi için ayrı
// bir tabloya aktarır. Ana samples/metadata verisiyle (gfpr.json, ayrı bir
// sistem) HİÇ ilgisi yok — o tarafa dokunulmuyor.
//
// BEKLENEN DOSYA YERLEŞİMİ (backend/data/ altında):
//   combined_amr.tsv           (TAB ayraçlı)
//   cazyme.tsv                 (NOKTALI VİRGÜL ayraçlı)
//   cgc.tsv                    (TAB ayraçlı) — master_gene_table_cgc.tsv de kabul edilir
//   cctyper.tsv                (TAB ayraçlı)
//   macrel_amp.tsv             (NOKTALI VİRGÜL ayraçlı)
//   hotspot.tsv                (ayraç otomatik tespit edilir, tab/`;`)
//   pfam_ko/*.tsv               (17 kategori dosyası, TAB ayraçlı, HEPSİ
//                                aynı şemada — tek "pfam_ko" tablosunda
//                                birleştirilir)
//
// NOT: backend/data/raw/ içinde SADECE all_data.xlsx var (metadata Excel);
// anotasyon TSV'leri bir üst dizin olan backend/data/ içindedir.
// Her tabloda sample_id sütununda INDEX var — bir sample_id'nin BİRDEN
// FAZLA satırı olması normal (bir plazmidin birden fazla geni/hit'i var).
//
// Bir dosya bulunamazsa script o tabloyu ATLAR ve uyarı basar, tamamen
// durmaz — böylece elindeki dosyalarla kısmi bir import da yapabilirsin.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { parse } from "csv-parse/sync";
import { db } from "../config/db.js";

// NOTE: Anotasyon TSV dosyaları (combined_amr, cazyme, hotspot vb.) ve
// pfam_ko/ klasörü backend/data/ içindedir. backend/data/raw/ içinde yalnızca
// metadata Excel'i (all_data.xlsx) bulunur. RAW_DATA_DIR env değişkeni ile
// geçersiz kılınabilir.
const RAW_DIR = path.resolve(process.env.RAW_DATA_DIR || "./data");

// ----------------------------------------------------------------------
// Küçük yardımcılar
// ----------------------------------------------------------------------

function readDelimited(filePath, delimiter) {
  const content = fs.readFileSync(filePath, "utf-8");
  return parse(content, {
    delimiter,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true, // bazı satırlar eksik/fazla sütunlu olabilir (örn. cgc.tsv'de boş Gene Type)
    trim: true,
  });
}

// hotspot.tsv'nin ayracı teyit edilmediği için: dosyanın ilk satırına bakıp
// tab mı yoksa ; mi daha çok geçiyor, ona göre karar veriyoruz.
function detectDelimiter(filePath) {
  const firstLine = fs.readFileSync(filePath, "utf-8").split("\n")[0] || "";
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  return tabCount >= semiCount ? "\t" : ";";
}

// "0,594" ya da bozuk kopyalanmış "0\t594" gibi görünen ondalık değerleri
// sayıya çevirir. Gerçek dosyada muhtemelen normal bir "0.594" ya da "0,594"
// olacaktır; hem nokta hem virgülü destekliyoruz. Parse edilemezse null
// döner (import'u durdurmaz, o satırın o alanı boş kalır).
function toFloatFlexible(v) {
  if (v === undefined || v === null || v === "") return null;
  const cleaned = String(v).trim().replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toTextOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" || s === "-" ? null : s;
}

// NOTE: cgc.tsv'deki "Gene Strand" sütununda "-" EKSİK VERİ değil,
// "eksi zincir" (minus strand) anlamına gelen GEÇERLİ bir biyolojik
// değerdir ("+" ile birlikte). toTextOrNull'ın "-" ı null'a çeviren genel
// davranışı burada YANLIŞ olur — strand bilgisini sessizce siler. Bu
// yüzden Gene Strand için ayrı, "-" ı KORUYAN bir dönüştürücü kullanılıyor
// (sadece gerçekten boş string'i null yapar).
function toTextKeepDash(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function fileExists(p) {
  return fs.existsSync(p);
}

// Bir tabloyu (varsa) silip yeniden oluşturan + insert eden genel akış.
// columns: [{ dbName, sqlType }] — insert sırası bu diziyle birebir aynı.
function loadTable(tableName, columns, rows, sampleIdColumn = "sample_id") {
  db.exec(`DROP TABLE IF EXISTS ${tableName}`);
  const colDefs = columns.map((c) => `${c.dbName} ${c.sqlType}`).join(", ");
  db.exec(`CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${colDefs})`);
  db.exec(`CREATE INDEX idx_${tableName}_sample_id ON ${tableName}(${sampleIdColumn})`);

  const placeholders = columns.map(() => "?").join(", ");
  const insert = db.prepare(
    `INSERT INTO ${tableName} (${columns.map((c) => c.dbName).join(", ")}) VALUES (${placeholders})`
  );
  const insertMany = db.transaction((allRows) => {
    for (const row of allRows) insert.run(...row);
  });
  insertMany(rows);

  console.log(`  -> ${tableName}: ${rows.length} satır yazıldı`);
}

// ----------------------------------------------------------------------
// 1) combined_amr.tsv -> amr
// ----------------------------------------------------------------------
function importAmr() {
  const filePath = path.join(RAW_DIR, "combined_amr.tsv");
  if (!fileExists(filePath)) { console.warn("[atlandı] combined_amr.tsv bulunamadı"); return; }
  const raw = readDelimited(filePath, "\t");
  const columns = [
    { dbName: "sample_id", sqlType: "TEXT" },
    { dbName: "protein_id", sqlType: "TEXT" },
    { dbName: "type", sqlType: "TEXT" },
    { dbName: "subtype", sqlType: "TEXT" },
    { dbName: "class", sqlType: "TEXT" },
  ];
  const rows = raw.map((r) => [
    toTextOrNull(r.sample_id),
    toTextOrNull(r.id_proteinid),
    toTextOrNull(r.Type),
    toTextOrNull(r.Subtype),
    toTextOrNull(r.Class),
  ]);
  loadTable("amr", columns, rows);
}

// ----------------------------------------------------------------------
// 2) cazyme.tsv -> cazyme (metadata sütunları BİLEREK atlanıyor, ana
//    samples tablosunda zaten var — tekrar tutup tutarsızlık riski
//    almıyoruz)
// ----------------------------------------------------------------------
// NOTE: cazyme.tsv'deki ID sütunu run_id formatında (ERR…/SRR…).
// Tabloda bu değer "run_id" sütununa yazılıyor; sorgularda da run_id
// üzerinden join yapılıyor (sample_id değil).
function importCazyme() {
  const filePath = path.join(RAW_DIR, "cazyme.tsv");
  if (!fileExists(filePath)) { console.warn("[atlandı] cazyme.tsv bulunamadı"); return; }
  const raw = readDelimited(filePath, ";");
  const columns = [
    { dbName: "run_id", sqlType: "TEXT" },
    { dbName: "class", sqlType: "TEXT" },
    { dbName: "family", sqlType: "TEXT" },
    { dbName: "count", sqlType: "INTEGER" },
  ];
  const rows = raw.map((r) => [
    toTextOrNull(r.ID),
    toTextOrNull(r.Class),
    toTextOrNull(r.Family),
    toIntOrNull(r.count),
  ]);
  loadTable("cazyme", columns, rows, "run_id");
}

// ----------------------------------------------------------------------
// 3) master_gene_table_cgc.tsv -> cgc (konum bilgisi burada)
// ----------------------------------------------------------------------
function importCgc() {
  // cgc.tsv veya master_gene_table_cgc.tsv — hangisi varsa onu kullan
  let filePath = path.join(RAW_DIR, "cgc.tsv");
  if (!fileExists(filePath)) filePath = path.join(RAW_DIR, "master_gene_table_cgc.tsv");
  if (!fileExists(filePath)) { console.warn("[atlandı] cgc.tsv / master_gene_table_cgc.tsv bulunamadı"); return; }
  const raw = readDelimited(filePath, "\t");
  const columns = [
    { dbName: "sample_id", sqlType: "TEXT" },
    { dbName: "cgc_num", sqlType: "TEXT" },
    { dbName: "gene_type", sqlType: "TEXT" },
    { dbName: "contig_id", sqlType: "TEXT" },
    { dbName: "protein_id", sqlType: "TEXT" },
    { dbName: "gene_start", sqlType: "INTEGER" },
    { dbName: "gene_stop", sqlType: "INTEGER" },
    { dbName: "gene_strand", sqlType: "TEXT" },
    { dbName: "gene_annotation", sqlType: "TEXT" },
    { dbName: "gene_id", sqlType: "TEXT" },
    { dbName: "recommend_results", sqlType: "TEXT" },
    { dbName: "substrate", sqlType: "TEXT" },
    { dbName: "tools_count", sqlType: "INTEGER" },
    { dbName: "cazy_category", sqlType: "TEXT" },
    { dbName: "category", sqlType: "TEXT" },
    { dbName: "cluster_start", sqlType: "INTEGER" },
    { dbName: "cluster_end", sqlType: "INTEGER" },
    { dbName: "length_bp", sqlType: "INTEGER" },
  ];
  const rows = raw.map((r) => [
    toTextOrNull(r.ID),
    toTextOrNull(r["CGC#"]),
    toTextOrNull(r["Gene Type"]),
    toTextOrNull(r["Contig ID"]),
    toTextOrNull(r["Protein ID"]),
    toIntOrNull(r["Gene Start"]),
    toIntOrNull(r["Gene Stop"]),
    toTextKeepDash(r["Gene Strand"]),
    toTextOrNull(r["Gene Annotation"]),
    toTextOrNull(r["Gene ID"]),
    toTextOrNull(r["Recommend Results"]),
    toTextOrNull(r["Substrate"]),
    toIntOrNull(r["#ofTools"]),
    toTextOrNull(r["CAZy_Category"]),
    toTextOrNull(r["Category"]),
    toIntOrNull(r["Cluster Start"]),
    toIntOrNull(r["Cluster End"]),
    toIntOrNull(r["Length (bp)"]),
  ]);
  loadTable("cgc", columns, rows);
}

// ----------------------------------------------------------------------
// 4) cctyper.tsv -> crispr_cas
// ----------------------------------------------------------------------
function importCrisprCas() {
  const filePath = path.join(RAW_DIR, "cctyper.tsv");
  if (!fileExists(filePath)) { console.warn("[atlandı] cctyper.tsv bulunamadı"); return; }
  const raw = readDelimited(filePath, "\t");
  const columns = [
    { dbName: "sample_id", sqlType: "TEXT" },
    { dbName: "source", sqlType: "TEXT" },
    { dbName: "contig", sqlType: "TEXT" },
    { dbName: "type", sqlType: "TEXT" },
    { dbName: "subtype", sqlType: "TEXT" },
    { dbName: "confidence", sqlType: "REAL" },
  ];
  const rows = raw.map((r) => [
    toTextOrNull(r.Sample_ID),
    toTextOrNull(r.Source),
    toTextOrNull(r.Contig),
    toTextOrNull(r.Type),
    toTextOrNull(r.Subtype),
    toFloatFlexible(r.Confidence),
  ]);
  loadTable("crispr_cas", columns, rows);
}

// ----------------------------------------------------------------------
// 5) macrel_amp.tsv -> amp (ondalık format bozuk olabilir, toFloatFlexible
//    kullanılıyor — hâlâ hatalı geliyorsa sonuçları kontrol et)
// ----------------------------------------------------------------------
function importAmp() {
  const filePath = path.join(RAW_DIR, "macrel_amp.tsv");
  if (!fileExists(filePath)) { console.warn("[atlandı] macrel_amp.tsv bulunamadı"); return; }
  const raw = readDelimited(filePath, ";");
  const columns = [
    { dbName: "sample_id", sqlType: "TEXT" },
    { dbName: "access", sqlType: "TEXT" },
    { dbName: "sequence", sqlType: "TEXT" },
    { dbName: "amp_family", sqlType: "TEXT" },
    { dbName: "amp_probability", sqlType: "REAL" },
    { dbName: "hemolytic", sqlType: "TEXT" },
    { dbName: "hemolytic_probability", sqlType: "REAL" },
  ];
  const rows = raw.map((r) => [
    toTextOrNull(r.ID),
    toTextOrNull(r.Access),
    toTextOrNull(r.Sequence),
    toTextOrNull(r.AMP_family),
    toFloatFlexible(r.AMP_probability),
    toTextOrNull(r.Hemolytic),
    toFloatFlexible(r.Hemolytic_probability),
  ]);
  loadTable("amp", columns, rows);
}

// ----------------------------------------------------------------------
// 6) pfam_ko/*.tsv (17 dosya) -> pfam_ko
//    Bazı dosyalar (ör. dairy.tsv ~617 MB) V8'in readFileSync string
//    limitini aşıyor (ERR_STRING_TOO_LONG). Bu yüzden readline ile
//    satır satır akışlı işleme yapıyoruz; 50.000 satırda bir SQLite
//    transaction ile toplu INSERT yapılıyor.
// ----------------------------------------------------------------------
async function importPfamKo() {
  const dirPath = path.join(RAW_DIR, "pfam_ko");
  if (!fs.existsSync(dirPath)) { console.warn("[atlandı] pfam_ko/ klasörü bulunamadı"); return; }
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".tsv"));
  if (files.length === 0) { console.warn("[atlandı] pfam_ko/ içinde .tsv dosyası yok"); return; }

  const columns = [
    { dbName: "sample_id", sqlType: "TEXT" },
    { dbName: "protein_id", sqlType: "TEXT" },
    { dbName: "eggnog_ogs", sqlType: "TEXT" },
    { dbName: "cog_category", sqlType: "TEXT" },
    { dbName: "description", sqlType: "TEXT" },
    { dbName: "preferred_name", sqlType: "TEXT" },
    { dbName: "gos", sqlType: "TEXT" },
    { dbName: "kegg_ko", sqlType: "TEXT" },
    { dbName: "pfams", sqlType: "TEXT" },
  ];

  // Tabloyu oluştur (varsa sıfırla)
  db.exec(`DROP TABLE IF EXISTS pfam_ko`);
  const colDefs = columns.map((c) => `${c.dbName} ${c.sqlType}`).join(", ");
  db.exec(`CREATE TABLE pfam_ko (id INTEGER PRIMARY KEY AUTOINCREMENT, ${colDefs})`);
  db.exec(`CREATE INDEX idx_pfam_ko_sample_id ON pfam_ko(sample_id)`);

  const placeholders = columns.map(() => "?").join(", ");
  const insertStmt = db.prepare(
    `INSERT INTO pfam_ko (${columns.map((c) => c.dbName).join(", ")}) VALUES (${placeholders})`
  );
  const insertBatch = db.transaction((batch) => {
    for (const row of batch) insertStmt.run(...row);
  });

  const BATCH_SIZE = 50_000;
  let totalRows = 0;

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    console.log(`  .. pfam_ko/${file} okunuyor... (${(fs.statSync(filePath).size / 1e6).toFixed(1)} MB)`);
    let fileRows = 0;
    let batch = [];
    let headers = null;

    await new Promise((resolve, reject) => {
      const rl = readline.createInterface({
        input: fs.createReadStream(filePath, { encoding: "utf-8" }),
        crlfDelay: Infinity,
      });

      rl.on("line", (line) => {
        if (!line.trim()) return;
        const parts = line.split("\t");
        if (!headers) {
          headers = parts; // ilk satır: başlık
          return;
        }
        const r = Object.fromEntries(headers.map((h, i) => [h, parts[i] ?? ""]));
        batch.push([
          toTextOrNull(r.run_id),
          toTextOrNull(r.query),
          toTextOrNull(r.eggnog_ogs),
          toTextOrNull(r.cog_category),
          toTextOrNull(r.description),
          toTextOrNull(r.preferred_name),
          toTextOrNull(r.GOs),
          toTextOrNull(r.KEGG_ko),
          toTextOrNull(r.PFAMs),
        ]);
        fileRows++;
        if (batch.length >= BATCH_SIZE) {
          insertBatch(batch);
          batch = [];
        }
      });

      rl.on("close", () => {
        if (batch.length > 0) insertBatch(batch);
        totalRows += fileRows;
        console.log(`     -> ${fileRows} satır işlendi`);
        resolve();
      });

      rl.on("error", reject);
    });
  }

  console.log(`  -> pfam_ko: toplam ${totalRows} satır yazıldı`);
}

// ----------------------------------------------------------------------
// 7) hotspot.tsv -> host_taxonomy (dosya adı "hotspot", TABLO ADI
//    host_taxonomy — mevcut samples.hotspot alanıyla KARIŞTIRMA, o alan
//    ayrı bir sistemde/JSON'da duruyor)
// ----------------------------------------------------------------------
function importHostTaxonomy() {
  const filePath = path.join(RAW_DIR, "hotspot.tsv");
  if (!fileExists(filePath)) { console.warn("[atlandı] hotspot.tsv bulunamadı"); return; }
  const delimiter = detectDelimiter(filePath);
  const raw = readDelimited(filePath, delimiter);
  const columns = [
    { dbName: "sample_id", sqlType: "TEXT" },
    { dbName: "contig", sqlType: "TEXT" },
    { dbName: "phylum", sqlType: "TEXT" },
    { dbName: "class", sqlType: "TEXT" },
    { dbName: "order_name", sqlType: "TEXT" },
    { dbName: "family", sqlType: "TEXT" },
    { dbName: "genus", sqlType: "TEXT" },
    { dbName: "species", sqlType: "TEXT" },
  ];
  const rows = raw.map((r) => [
    toTextOrNull(r.Klasor_ID),
    toTextOrNull(r.Contig),
    toTextOrNull(r.Phylum),
    toTextOrNull(r.Class),
    toTextOrNull(r.Order),
    toTextOrNull(r.Family),
    toTextOrNull(r.Genus),
    toTextOrNull(r.Species),
  ]);
  loadTable("host_taxonomy", columns, rows, "sample_id");
}

// ----------------------------------------------------------------------
// 8) acp.csv -> acp
// ----------------------------------------------------------------------
function importAcp() {
  const filePath = path.join(RAW_DIR, "acp.csv");
  if (!fileExists(filePath)) { console.warn("[atlandı] acp.csv bulunamadı"); return; }
  const raw = readDelimited(filePath, ",");
  const columns = [
    { dbName: "sample_id", sqlType: "TEXT" },
    { dbName: "sequence", sqlType: "TEXT" },
    { dbName: "anticp2", sqlType: "REAL" },
    { dbName: "conacp", sqlType: "REAL" },
    { dbName: "acpred", sqlType: "REAL" },
    { dbName: "toxinpred", sqlType: "TEXT" },
  ];
  const rows = raw.map((r) => [
    toTextOrNull(r.Run_ID),
    toTextOrNull(r.Sequence),
    toFloatFlexible(r.prediction_by_anticp2),
    toFloatFlexible(r.prediction_by_conacp),
    toFloatFlexible(r.prediction_by_acpred),
    toTextOrNull(r.prediction_by_toxinpred),
  ]);
  loadTable("acp", columns, rows);
}

// ----------------------------------------------------------------------
// Çalıştır
// ----------------------------------------------------------------------
async function run() {
  console.log(`Ham veri klasörü: ${RAW_DIR}`);
  console.log("AMR...");
  importAmr();
  console.log("CAZyme...");
  importCazyme();
  console.log("CGC...");
  importCgc();
  console.log("CRISPR-Cas (cctyper)...");
  importCrisprCas();
  console.log("AMP (macrel)...");
  importAmp();
  console.log("ACP (acp.csv)...");
  importAcp();
  console.log("Pfam/KO (eggNOG)... (büyük dosyalar, birkaç dakika sürebilir)");
  await importPfamKo();
  console.log("Host taxonomy (hotspot.tsv)...");
  importHostTaxonomy();
  console.log("Bitti.");
}

run().catch(console.error);

