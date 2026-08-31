import { Router } from "express";
import { getRawDataLinks } from "../controllers/rawDataController.js";

const router = Router();

router.get("/links", getRawDataLinks);

export default router;
