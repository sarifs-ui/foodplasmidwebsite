import "dotenv/config";

import { app } from "./app.js";
import { readAll } from "./data/sampleStore.js";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  const sampleCount = readAll().length;
  console.log(`GFPR backend listening on http://localhost:${PORT}`);
  if (sampleCount === 0) {
    console.warn('No samples loaded — run "npm run import-data".');
  } else {
    console.log(`${sampleCount.toLocaleString("en-US")} samples loaded.`);
  }
});
