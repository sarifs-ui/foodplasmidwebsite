/**
 * Phylum colours.
 *
 * Matplotlib's `tab20b` sampled at 13 points, matching the published reference
 * cladogram so the two figures can be read side by side. Any phylum not listed
 * falls back to the same palette by index, so new data still renders.
 */
const TAB20B_SAMPLED = [
  "#393b79",
  "#5254a3",
  "#9c9ede",
  "#637939",
  "#b5cf6b",
  "#cedb9c",
  "#bd9e39",
  "#e7ba52",
  "#843c39",
  "#ad494a",
  "#e7969c",
  "#7b4173",
  "#ce6dbd",
];

const PHYLUM_COLORS = {
  Actinomycetota: "#393b79",
  Bacillota: "#5254a3",
  Bacteroidota: "#9c9ede",
  Campylobacterota: "#637939",
  Chlamydiota: "#b5cf6b",
  Cyanobacteriota: "#cedb9c",
  Deinococcota: "#bd9e39",
  Fusobacteriota: "#e7ba52",
  Mycoplasmatota: "#843c39",
  Pseudomonadota: "#ad494a",
  Rhodothermota: "#e7969c",
  Spirochaetota: "#7b4173",
  Thermodesulfobacteriota: "#ce6dbd",
};

export function phylumColor(name, index = 0) {
  return PHYLUM_COLORS[name] || TAB20B_SAMPLED[index % TAB20B_SAMPLED.length];
}
