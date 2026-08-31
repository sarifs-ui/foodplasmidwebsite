// NOTE: Bu backend'de İKİ ayrı veri kaynağı var, kasıtlı olarak
// birleştirilmedi:
//   1) config/store.js  -> gfpr.json (ana örnek/metadata tablosu, samples/
//      filters/stats uçları bunu kullanıyor, DOKUNULMADI).
//   2) config/db.js (BU DOSYA) -> backend/data/gfpr.db (SQLite), sadece
//      gen/hit seviyeli anotasyon tabloları (amr, cazyme, cgc, crispr_cas,
//      amp, pfam_ko) ve host_taxonomy için. Bu veri SADECE OKUNUYOR —
//      runtime'da hiç yazma yok, dosya scripts/importAllData.js ile
//      tek seferlik dolduruluyor ve deploy'a olduğu gibi dahil ediliyor.
// İki kaynağı ayrı tutmamızın sebebi: samples/filters/stats mevcut ve
// çalışıyordu, riske atmadan üstüne yeni bir katman ekliyoruz.
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import "dotenv/config";

const DB_PATH = path.resolve(process.env.ANNOTATIONS_DB_PATH || "./data/gfpr.db");

function ensureDir() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}
ensureDir();

// NOTE: fileMustExist:false -> ilk import scripti çalıştırılmadan önce
// backend başlatılırsa boş bir .db dosyası oluşturur (tablolar yok), o
// durumda downloads/taxonomy uçları "tablo yok" hatası dönebilir. Bu
// beklenen bir durum — README'de "önce import scriptini çalıştır" notu var.
export const db = new Database(DB_PATH, { fileMustExist: false });
db.pragma("journal_mode = WAL");

export const ANNOTATIONS_DB_FILE_PATH = DB_PATH;

// Bir tablonun var olup olmadığını kontrol eden küçük yardımcı — downloads
// ve taxonomy controller'ları, import scripti hiç çalıştırılmamışsa
// kullanıcıya "tablo yok" yerine anlamlı bir hata mesajı verebilsin diye.
export function tableExists(name) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(name);
  return !!row;
}
