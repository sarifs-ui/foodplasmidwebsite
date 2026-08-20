import { Router } from "express";
import { getOverview, getCategoryShare, getAnnotationFlow, getMapData } from "../controllers/statsController.js";

const router = Router();

router.get("/overview", getOverview);
router.get("/category-share", getCategoryShare);
router.get("/annotation-flow", getAnnotationFlow);
router.get("/map", getMapData);

export default router;
