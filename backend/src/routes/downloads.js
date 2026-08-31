import { Router } from "express";
import { exportDownload } from "../controllers/downloadsController.js";

const router = Router();

router.post("/export", exportDownload);

export default router;
