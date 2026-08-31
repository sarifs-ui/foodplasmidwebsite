// NOTE: Harici bir CSV kütüphanesi eklemeye gerek yok, indirdiğimiz
// veri basit (virgül/tırnak/yeni satır içerebilecek metin alanları var
// ama nadiren) — bu küçük stringifier yeterli ve bağımlılık eklemiyor.

function escapeCsvValue(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// rows: array of plain objects. Sütun sırası ilk satırın anahtar sırasıyla
// belirlenir. Boş dizi verilirse sadece "" (boş içerik) döner.
export function rowsToCsv(rows) {
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvValue(row[h])).join(","));
  }
  return lines.join("\n");
}
