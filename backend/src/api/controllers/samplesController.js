import * as samplesService from "../services/samplesService.js";

export function list(req, res) {
  res.json(samplesService.listSamples(req.query));
}

export function filters(req, res) {
  res.json(samplesService.getFilterOptions());
}

export function detail(req, res) {
  const sample = samplesService.getSampleById(req.params.id);
  if (!sample) {
    return res.status(404).json({ error: `Sample not found: ${req.params.id}` });
  }
  res.json(sample);
}
