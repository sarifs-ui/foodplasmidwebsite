import { readAll } from "../config/store.js";

const distinctSorted = (arr) =>
  Array.from(new Set(arr.filter((v) => v !== null && v !== undefined))).sort();

// GET /api/samples/filters
export function getFilterOptions(req, res) {
  const data = readAll();
  res.json({
    categories: distinctSorted(data.map((r) => r.category)),
    types: distinctSorted(data.map((r) => r.type)),
    subtypes: distinctSorted(data.map((r) => r.sub_type)),
    countries: distinctSorted(data.map((r) => r.country)),
    years: distinctSorted(data.map((r) => r.year)),
    databaseOrigins: distinctSorted(data.map((r) => r.database_origin)),
  });
}
