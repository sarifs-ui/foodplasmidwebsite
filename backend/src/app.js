import fs from "node:fs";
import path from "node:path";

import express from "express";
import morgan from "morgan";

import apiRouter from "./api/routes/index.js";
import { errorHandler, notFound } from "./api/middleware/errorHandler.js";
import { corsPolicy, securityHeaders } from "./api/middleware/security.js";
import { FRONTEND_DIST } from "./config/paths.js";

export const app = express();

// Do not advertise the framework.
app.disable("x-powered-by");

// Correct client IPs when deployed behind a reverse proxy, which the rate
// limiter keys on. Off by default: trusting these headers unconditionally
// would let any client spoof its address.
if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);

app.use(securityHeaders);
app.use(corsPolicy);
// 100 kB is ample for an id list and a contact message.
app.use(express.json({ limit: "100kb" }));
app.use(morgan("dev"));

app.use("/api", apiRouter);

// Unknown /api paths must always return JSON. This has to precede the SPA
// fallback below, otherwise a typo'd endpoint would silently return index.html.
app.use("/api", notFound);

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

// Last: turns any thrown error into JSON without leaking a stack trace.
app.use(errorHandler);
