import { Router } from "express";

import * as contactController from "../controllers/contactController.js";
import * as downloadsController from "../controllers/downloadsController.js";
import * as rawDataController from "../controllers/rawDataController.js";
import * as samplesController from "../controllers/samplesController.js";
import * as statsController from "../controllers/statsController.js";
import { hasDb, importSummary } from "../../data/annotationsDb.js";
import { hasDerived } from "../../data/derivedStore.js";
import { readAll } from "../../data/sampleStore.js";

const router = Router();

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
router.post("/downloads/export", downloadsController.exportArchive);
router.get("/raw-data/links", rawDataController.links);

// Contact
router.post("/contact", contactController.submit);

export default router;
