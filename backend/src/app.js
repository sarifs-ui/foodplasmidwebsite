import express from "express";
import cors from "cors";
import morgan from "morgan";

import statsRoutes from "./routes/stats.js";
import samplesRoutes from "./routes/samples.js";
import mockRoutes from "./routes/mock.js";

export const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/stats", statsRoutes);
app.use("/api/samples", samplesRoutes);
app.use("/api/mock", mockRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));
