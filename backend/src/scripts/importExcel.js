// Kullanım: npm run import-data  (backend/ içinden)
//
// ÖNEMLİ: AMR / AMP / CAzyme / CGC / crispr-cas / Pfam-KO / ACP sütunları
// gerçek veride "kaç tane" diye bir SAYI değil, virgülle ayrılmış İSİM
// LİSTESİ (ör. "AMINOGLYCOSIDE, TETRACYCLINE" ya da "GH13, GH23, GT2").
// Bunlar TEXT olarak olduğu gibi saklanıyor; "kaç hit var" bilgisi
// controller tarafında bu listenin eleman sayısından hesaplanıyor.
import XLSX from "xlsx";
import path from "node:path";
import "dotenv/config";
import { readAll, writeAll, DB_FILE_PATH } from "../config/store.js";

const EXCEL_PATH = process.env.EXCEL_PATH || "./data/raw/all_data.xlsx";
const SHEET_NAME = process.env.EXCEL_SHEET_NAME || null;

const HEADER_MAP = {
  projectid: "project_id",
  sampleid: "sample_id",
  sampleacc: "sample_acc",
  runid: "run_id",
  plasmidcontigcounts: "plasmid_contig_counts",
  classified: "classified",
  unclassified: "unclassified",
  category: "category",
  type: "type",
  subtype: "sub_type",
  fermentedfnonfermentednf: "fermented_raw",
  country: "country",
  year: "year",
  databaseorigin: "database_origin",
  host: "host",
  amr: "amr",
  amp: "amp",
  cazyme: "cazyme",
  cgc: "cgc",
  crisprcas: "crispr_cas",
  acp: "acp",
  pfamko: "pfam_ko",
  hotspot: "hotspot",
};

function normalizeHeader(h) {
  return String(h)
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function toIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toFermentedFlag(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().toUpperCase();
  if (["F", "FERMENTED", "1", "TRUE", "YES"].includes(s)) return true;
  if (["NF", "NON_FERMENTED", "NON-FERMENTED", "0", "FALSE", "NO"].includes(s)) return false;
  return null;
}

// Sadece bunlar gerçek sayı sütunu — geri kalan her şey (annotation
// sütunları dahil) metin olarak saklanıyor.
const INT_FIELDS = ["plasmid_contig_counts", "classified", "unclassified", "year"];

// Boş / "-" / "N/A" gibi değerleri null'a çeviriyoruz ki controller
// tarafında "liste boş" ile "veri yok" ayrımı net olsun.
function toTextOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s || s === "-" || s.toUpperCase() === "N/A") return null;
  return s;
}

function run() {
  const resolvedPath = path.resolve(EXCEL_PATH);
  console.log(`Okunuyor: ${resolvedPath}`);

  const wb = XLSX.readFile(resolvedPath);
  const sheetName = SHEET_NAME || wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet bulunamadı: "${sheetName}". Mevcut sheet'ler: ${wb.SheetNames.join(", ")}`);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  if (rows.length === 0) {
    console.warn("Uyarı: sheet boş görünüyor.");
    return;
  }

  const rawHeaders = Object.keys(rows[0]);
  const headerToField = {};
  const unmapped = [];
  for (const raw of rawHeaders) {
    const norm = normalizeHeader(raw);
    if (HEADER_MAP[norm]) headerToField[raw] = HEADER_MAP[norm];
    else unmapped.push(raw);
  }
  if (unmapped.length) {
    console.warn("Eşlenemeyen sütunlar (yok sayılacak):", unmapped);
  }

  const newRecords = rows
    .map((row) => {
      const rec = {
        project_id: null, sample_id: null, sample_acc: null, run_id: null,
        plasmid_contig_counts: null, classified: null, unclassified: null,
        category: null, type: null, sub_type: null, fermented: null,
        country: null, year: null, database_origin: null, host: null,
        amr: null, amp: null, cazyme: null, cgc: null, crispr_cas: null,
        acp: null, pfam_ko: null, hotspot: null,
      };
      for (const [raw, field] of Object.entries(headerToField)) {
        const val = row[raw];
        if (field === "fermented_raw") rec.fermented = toFermentedFlag(val);
        else if (INT_FIELDS.includes(field)) rec[field] = toIntOrNull(val);
        else if (field === "category" || field === "type" || field === "sub_type" || field === "country" || field === "database_origin" || field === "host") {
          rec[field] = val === null ? null : String(val).trim();
        } else {
          // amr, amp, cazyme, cgc, crispr_cas, acp, pfam_ko, hotspot -> metin listesi
          rec[field] = toTextOrNull(val);
        }
      }
      return rec;
    })
    .filter((r) => r.sample_id);

  const existing = readAll();
  const bySampleId = new Map(existing.map((r) => [r.sample_id, r]));
  for (const rec of newRecords) bySampleId.set(rec.sample_id, rec);
  const merged = Array.from(bySampleId.values());

  writeAll(merged);
  console.log(`Bitti: ${newRecords.length} satır işlendi, toplam ${merged.length} kayıt "${DB_FILE_PATH}" içine yazıldı.`);
}

run();
