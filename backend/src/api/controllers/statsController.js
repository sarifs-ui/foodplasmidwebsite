import * as statsService from "../services/statsService.js";

export function overview(req, res) {
  res.json(statsService.getOverview());
}

export function categoryShare(req, res) {
  res.json(statsService.getCategoryShare());
}

export function annotationFlow(req, res) {
  res.json({
    classes: statsService.getAnnotationFlowClasses(),
    categories: statsService.getAnnotationFlow(),
  });
}

export function taxonomy(req, res) {
  const data = statsService.getTaxonomy();
  if (data.nodes.length === 0) {
    return res.status(503).json({
      error:
        "Taxonomy data is unavailable. Run \"npm run import-annotations\" and " +
        '"npm run build-derived" to regenerate gfpr.derived.json.',
    });
  }
  res.json(data);
}

export function map(req, res) {
  res.json(statsService.getMapData());
}

export function contigShare(req, res) {
  res.json(statsService.getContigShare());
}
