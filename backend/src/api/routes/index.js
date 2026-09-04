import { Router } from "express";

import { rateLimit } from "../middleware/rateLimit.js";

import * as contactController from "../controllers/contactController.js";
import * as downloadsController from "../controllers/downloadsController.js";
import * as rawDataController from "../controllers/rawDataController.js";
import * as samplesController from "../controllers/samplesController.js";
import * as statsController from "../controllers/statsController.js";
import { hasDb, importSummary } from "../../data/annotationsDb.js";
import { hasDerived } from "../../data/derivedStore.js";
import { readAll } from "../../data/sampleStore.js";

const router = Router();

// Reads are cheap and cached; the ceiling only exists to blunt scraping floods.
const readLimit = rateLimit({ name: "read", windowMs: 60_000, max: 300 });
// Each export can touch hundreds of thousands of rows and stream tens of MB.
const exportLimit = rateLimit({ name: "export", windowMs: 60_000, max: 5 });
// The contact form writes to the server log; keep it useless for spamming.
const contactLimit = rateLimit({ name: "contact", windowMs: 600_000, max: 5 });

router.use(readLimit);

router.get("/health", (req, res) => {
  res.json({
    ok: true,
    samples: readAll().length,
    derived: hasDerived(),
    annotationsDb: hasDb(),
    tables: importSummary(),
  });
});

// Stats
router.get("/stats/overview", statsController.overview);
router.get("/stats/category-share", statsController.categoryShare);
router.get("/stats/contig-share", statsController.contigShare);
router.get("/stats/annotation-flow", statsController.annotationFlow);
router.get("/stats/taxonomy", statsController.taxonomy);
router.get("/stats/map", statsController.map);

// Samples — /filters must be declared before /:id so it is not captured by it.
router.get("/samples", samplesController.list);
router.get("/samples/filters", samplesController.filters);
router.get("/samples/:id", samplesController.detail);

// Downloads
router.post("/downloads/export", exportLimit, downloadsController.exportArchive);
router.get("/raw-data/links", rawDataController.links);

// Contact
router.post("/contact", contactLimit, contactController.submit);

export default router;
