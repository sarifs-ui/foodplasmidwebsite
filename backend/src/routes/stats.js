import { Router } from "express";
import { getOverview, getCategoryShare, getAnnotationFlow, getMapData, getTaxonomy } from "../controllers/statsController.js";

const router = Router();

router.get("/overview", getOverview);
router.get("/category-share", getCategoryShare);
router.get("/annotation-flow", getAnnotationFlow);
router.get("/map", getMapData);
router.get("/taxonomy", getTaxonomy);

export default router;
