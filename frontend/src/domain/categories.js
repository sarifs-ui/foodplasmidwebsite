/**
 * Food categories.
 *
 * Keys must match the `category` values the API returns verbatim.
 *
 * Colours are matplotlib's `tab20`, assigned in alphabetical order of key, so
 * the web figures are colour-identical to the published reference plots
 * generated from the same data.
 */
export const CATEGORIES = [
  { key: "alcohol", label: "Alcohol", short: "alcohol", color: "#1f77b4" },
  { key: "dairy", label: "Dairy", short: "dairy", color: "#aec7e8" },
  { key: "feed", label: "Feed", short: "feed", color: "#ff7f0e" },
  {
    key: "fermented_beverages",
    label: "Fermented Beverages",
    short: "ferm. beverages",
    color: "#ffbb78",
  },
  {
    key: "fermented_fruits_and_vegetables",
    label: "Fermented Fruits and Vegetables",
    short: "ferm. fruits and vegetables",
    color: "#2ca02c",
  },
  {
    key: "fermented_grains",
    label: "Fermented Grains",
    short: "ferm. grains",
    color: "#98df8a",
  },
  {
    key: "fermented_legumes",
    label: "Fermented Legumes",
    short: "ferm. legumes",
    color: "#d62728",
  },
  { key: "fermented_meat", label: "Fermented Meat", short: "ferm. meat", color: "#ff9896" },
  {
    key: "fermented_seeds",
    label: "Fermented Seeds",
    short: "ferm. seeds",
    color: "#9467bd",
  },
  {
    key: "fermented_tubers_and_roots",
    label: "Fermented Tubers and Roots",
    short: "ferm. tubers and roots",
    color: "#c5b0d5",
  },
  {
    key: "fruits_and_vegetables",
    label: "Fruits and Vegetables",
    short: "fruits and vegetables",
    color: "#8c564b",
  },
  { key: "meat", label: "Meat", short: "meat", color: "#c49c94" },
  { key: "other", label: "Other", short: "other", color: "#e377c2" },
  { key: "probiotics", label: "Probiotics", short: "probiotics", color: "#f7b6d2" },
  { key: "seafood", label: "Seafood", short: "seafood", color: "#7f7f7f" },
  { key: "supplement", label: "Supplement", short: "supplement", color: "#c7c7c7" },
  { key: "water", label: "Water", short: "water", color: "#bcbd22" },
];

/**
 * Legend order puts "other" last, matching the reference figure — the colour
 * assignment above stays strictly alphabetical.
 */
export const CATEGORY_LEGEND_ORDER = [
  ...CATEGORIES.filter((c) => c.key !== "other"),
  ...CATEGORIES.filter((c) => c.key === "other"),
];

const byKey = new Map(CATEGORIES.map((c) => [c.key, c]));

export function categoryColor(key) {
  return byKey.get(key)?.color || "#cccccc";
}

/** Fall back to a humanised form of the raw key rather than showing snake_case. */
export function categoryLabel(key) {
  const known = byKey.get(key);
  if (known) return known.label;
  if (!key) return "Unknown";
  return String(key)
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function categoryShortLabel(key) {
  return byKey.get(key)?.short || categoryLabel(key);
}
