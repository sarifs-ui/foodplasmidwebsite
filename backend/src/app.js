import fs from "node:fs";
import path from "node:path";

import cors from "cors";
import express from "express";
import morgan from "morgan";

import apiRouter from "./api/routes/index.js";
import { FRONTEND_DIST } from "./config/paths.js";

export const app = express();

// CORS matters only in development: `npm run dev` serves the UI from Vite on
// port 5173 and proxies /api here. In production both come from this server,
// so requests are same-origin and CORS never engages.
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api", apiRouter);

// Unknown /api paths must always return JSON. This has to precede the SPA
// fallback below, otherwise a typo'd endpoint would silently return index.html.
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// Single port: this server also serves the built frontend.
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));

  // The UI uses client-side routing, so any non-API path resolves to index.html
  // and lets the router take over.
  app.get("*", (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
} else {
  app.get("*", (req, res) => {
    res
      .status(503)
      .type("html")
      .send(
        `<h1>Frontend not built</h1>
         <p>Run <code>npm start</code> from the repository root (build + serve),
         or <code>npm run dev</code> for development.</p>
         <p>The API is running: <a href="/api/health">/api/health</a></p>`
      );
  });
}
