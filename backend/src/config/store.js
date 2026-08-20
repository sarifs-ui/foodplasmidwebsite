import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

const DATA_PATH = path.resolve(process.env.DB_PATH || "./data/gfpr.json");

function ensureFile() {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, "[]", "utf-8");
}
ensureFile();

export function readAll() {
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  try {
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

export function writeAll(records) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(records, null, 2), "utf-8");
}

export const DB_FILE_PATH = DATA_PATH;
