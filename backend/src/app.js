import express from "express";
import cors from "cors";
import morgan from "morgan";

import statsRoutes from "./routes/stats.js";
import samplesRoutes from "./routes/samples.js";
import mockRoutes from "./routes/mock.js";
import downloadsRoutes from "./routes/downloads.js";
import rawDataRoutes from "./routes/rawData.js";

export const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/stats", statsRoutes);
app.use("/api/samples", samplesRoutes);
// NOTE: mock.js'teki /api/mock/analysis/* ve /api/mock/downloads/*
// artık kullanılmıyor (Analysis sayfası kaldırıldı, gerçek indirme artık
// /api/downloads/export'ta) — zararsız ölü kod olarak bırakıldı, silmek
// istersen mock.js'i düzenleyebilirsin. /api/mock/contact hâlâ
// ContactPage tarafından kullanılıyor, o yüzden mock.js'in tamamı kalmalı.
app.use("/api/mock", mockRoutes);
app.use("/api/downloads", downloadsRoutes);
app.use("/api/raw-data", rawDataRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));
