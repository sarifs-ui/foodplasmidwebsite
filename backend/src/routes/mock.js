import { Router } from "express";
import { readAll } from "../config/store.js";

const router = Router();

router.post("/analysis/run", (req, res) => {
  const data = readAll().filter((r) => r.category);
  const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, 10);

  res.json({
    mock: true,
    note: "Gerçek benzerlik motoru bağlanmadı. Sonuçlar rastgele seçilmiş gerçek örneklerdir.",
    matches: shuffled.map((r, i) => ({
      id: r.sample_id,
      category: r.category,
      type: r.type,
      host: r.host,
      country: r.country,
      similarity: +(97 - i * 2.4).toFixed(1),
    })),
    predictedOrigin: shuffled[0]
      ? { id: shuffled[0].sample_id, category: shuffled[0].category, type: shuffled[0].type, host: shuffled[0].host, country: shuffled[0].country }
      : null,
  });
});

router.post("/downloads/metadata-csv", (req, res) => {
  const { ids = [] } = req.body || {};
  res.json({ mock: true, note: "Gerçek CSV üretimi bağlanmadı.", requestedCount: ids.length });
});

router.post("/downloads/files", (req, res) => {
  const { ids = [], annotationKeys = [] } = req.body || {};
  res.json({
    mock: true,
    note: "Gerçek dosya/annotation çıktısı bağlanmadı.",
    requestedCount: ids.length,
    annotationKeys,
  });
});

router.post("/contact", (req, res) => {
  res.json({ mock: true, note: "Gerçek e-posta gönderimi bağlanmadı, mesaj sadece loglandı.", received: !!req.body });
});

export default router;
