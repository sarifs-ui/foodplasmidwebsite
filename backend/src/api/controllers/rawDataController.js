import fs from "node:fs";
import path from "node:path";

import { BACKEND_ROOT } from "../../config/paths.js";

const LINKS_PATH = path.resolve(BACKEND_ROOT, "src", "config", "rawDataLinks.json");

/**
 * GET /api/raw-data/links
 *
 * rawDataLinks.json is a hand-maintained registry of Zenodo archive URLs. It is
 * re-read from disk on every request (rather than imported) so the file can be
 * updated without restarting the server.
 */
export function links(req, res) {
  try {
    const parsed = JSON.parse(fs.readFileSync(LINKS_PATH, "utf-8"));
    res.json({
      byCategory: parsed.byCategory || {},
      byCountry: parsed.byCountry || {},
    });
  } catch (err) {
    res.status(500).json({ error: `Could not read rawDataLinks.json: ${err.message}` });
  }
}
