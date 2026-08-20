import { Router } from "express";
import { listSamples, getSampleById } from "../controllers/samplesController.js";
import { getFilterOptions } from "../controllers/filtersController.js";

const router = Router();

router.get("/", listSamples);
router.get("/filters", getFilterOptions);
router.get("/:id", getSampleById);

export default router;
