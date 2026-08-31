// NOTE: rawDataLinks.json elle güncellenen statik bir dosya (kategori/
// ülke bazlı Zenodo zip'leri yüklendikçe doldurulacak). Bu controller onu
// her istekte diskten TAZE okuyor (require/import cache'lemiyor) — böylece
// dosyayı güncelleyip sunucuyu yeniden başlatmadan (ya da bir sonraki
// deploy'da) değişiklik yansır.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LINKS_PATH = path.join(__dirname, "..", "config", "rawDataLinks.json");

// GET /api/raw-data/links
export function getRawDataLinks(req, res) {
  try {
    const raw = fs.readFileSync(LINKS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    res.json({
      byCategory: parsed.byCategory || {},
      byCountry: parsed.byCountry || {},
    });
  } catch (err) {
    res.status(500).json({ error: `rawDataLinks.json okunamadı: ${err.message}` });
  }
}
