import "dotenv/config";
import { app } from "./app.js";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`GFPR backend http://localhost:${PORT} üzerinde çalışıyor`);
  console.log(`Veri import edilmediyse: npm run import-data`);
});
