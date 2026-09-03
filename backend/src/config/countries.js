/**
 * Country reference table.
 *
 * Samples carry ISO 3166-1 alpha-3 codes ("ITA", "USA"). This maps each code to
 * three things the API and the map figure need:
 *
 *   name     — display label
 *   numeric  — ISO 3166-1 numeric, zero-padded to three digits. This is the
 *              join key for the world-atlas TopoJSON the map renders, whose
 *              features are keyed `id: "840"`. Joining on *names* used to
 *              silently drop countries whose spelling differed between the two
 *              sources ("USA" vs "United States of America", "Türkiye" vs
 *              "Turkey") — 161 samples across 12 countries.
 *   centroid — approximate [lat, lon] country centre. Rough values for
 *              labelling only, not a survey-grade centroid database.
 *
 * Adding a country is a one-line change; no code needs to know about it.
 */
export const COUNTRIES = {
  ALA: { name: "Åland Islands", numeric: "248", centroid: [60.2, 20.0] },
  ARE: { name: "United Arab Emirates", numeric: "784", centroid: [24.0, 54.0] },   // not present in current data
  ARG: { name: "Argentina", numeric: "032", centroid: [-34.0, -64.0] },   // not present in current data
  AUS: { name: "Australia", numeric: "036", centroid: [-25.0, 134.0] },
  AUT: { name: "Austria", numeric: "040", centroid: [47.5, 14.5] },
  BEL: { name: "Belgium", numeric: "056", centroid: [50.6, 4.5] },
  BEN: { name: "Benin", numeric: "204", centroid: [9.5, 2.3] },
  BFA: { name: "Burkina Faso", numeric: "854", centroid: [12.3, -1.6] },
  BGD: { name: "Bangladesh", numeric: "050", centroid: [24.0, 90.0] },   // not present in current data
  BGR: { name: "Bulgaria", numeric: "100", centroid: [42.7, 25.5] },
  BOL: { name: "Bolivia", numeric: "068", centroid: [-16.3, -64.0] },
  BRA: { name: "Brazil", numeric: "076", centroid: [-10.0, -55.0] },
  CAN: { name: "Canada", numeric: "124", centroid: [56.0, -106.0] },
  CHE: { name: "Switzerland", numeric: "756", centroid: [46.8, 8.2] },
  CHL: { name: "Chile", numeric: "152", centroid: [-30.0, -71.0] },   // not present in current data
  CHN: { name: "China", numeric: "156", centroid: [35.0, 103.0] },
  COL: { name: "Colombia", numeric: "170", centroid: [4.0, -72.0] },
  CRI: { name: "Costa Rica", numeric: "188", centroid: [10.0, -84.0] },   // not present in current data
  CZE: { name: "Czechia", numeric: "203", centroid: [49.8, 15.5] },   // not present in current data
  DEU: { name: "Germany", numeric: "276", centroid: [51.0, 10.5] },
  DNK: { name: "Denmark", numeric: "208", centroid: [56.0, 10.0] },
  DZA: { name: "Algeria", numeric: "012", centroid: [28.0, 3.0] },   // not present in current data
  ECU: { name: "Ecuador", numeric: "218", centroid: [-1.8, -78.2] },
  EGY: { name: "Egypt", numeric: "818", centroid: [26.8, 30.8] },   // not present in current data
  ESP: { name: "Spain", numeric: "724", centroid: [40.0, -4.0] },
  EST: { name: "Estonia", numeric: "233", centroid: [58.6, 25.0] },
  ETH: { name: "Ethiopia", numeric: "231", centroid: [9.1, 40.5] },
  FIN: { name: "Finland", numeric: "246", centroid: [64.0, 26.0] },
  FRA: { name: "France", numeric: "250", centroid: [46.5, 2.2] },
  GBR: { name: "United Kingdom", numeric: "826", centroid: [54.0, -2.0] },
  GHA: { name: "Ghana", numeric: "288", centroid: [7.9, -1.0] },
  GRC: { name: "Greece", numeric: "300", centroid: [39.0, 22.0] },
  HKG: { name: "Hong Kong", numeric: "344", centroid: [22.3, 114.2] },
  HRV: { name: "Croatia", numeric: "191", centroid: [45.1, 15.2] },
  HUN: { name: "Hungary", numeric: "348", centroid: [47.2, 19.5] },
  IDN: { name: "Indonesia", numeric: "360", centroid: [-2.5, 118.0] },
  IND: { name: "India", numeric: "356", centroid: [22.0, 79.0] },
  IRL: { name: "Ireland", numeric: "372", centroid: [53.4, -8.0] },
  ISL: { name: "Iceland", numeric: "352", centroid: [64.9, -18.6] },
  ISR: { name: "Israel", numeric: "376", centroid: [31.5, 34.8] },
  ITA: { name: "Italy", numeric: "380", centroid: [42.0, 12.5] },
  JPN: { name: "Japan", numeric: "392", centroid: [36.0, 138.0] },
  KEN: { name: "Kenya", numeric: "404", centroid: [-1.0, 37.9] },
  KOR: { name: "South Korea", numeric: "410", centroid: [36.0, 127.7] },
  MAR: { name: "Morocco", numeric: "504", centroid: [32.0, -6.0] },
  MEX: { name: "Mexico", numeric: "484", centroid: [23.0, -102.0] },
  MNG: { name: "Mongolia", numeric: "496", centroid: [46.9, 103.8] },
  MYS: { name: "Malaysia", numeric: "458", centroid: [4.2, 101.9] },
  NGA: { name: "Nigeria", numeric: "566", centroid: [9.1, 8.7] },
  NLD: { name: "Netherlands", numeric: "528", centroid: [52.3, 5.5] },
  NOR: { name: "Norway", numeric: "578", centroid: [61.0, 8.5] },
  NZL: { name: "New Zealand", numeric: "554", centroid: [-41.0, 174.0] },
  PAK: { name: "Pakistan", numeric: "586", centroid: [30.0, 70.0] },   // not present in current data
  PER: { name: "Peru", numeric: "604", centroid: [-10.0, -76.0] },   // not present in current data
  PHL: { name: "Philippines", numeric: "608", centroid: [13.0, 122.0] },
  POL: { name: "Poland", numeric: "616", centroid: [52.0, 19.5] },   // not present in current data
  PRT: { name: "Portugal", numeric: "620", centroid: [39.5, -8.0] },
  ROU: { name: "Romania", numeric: "642", centroid: [45.9, 25.0] },   // not present in current data
  RUS: { name: "Russia", numeric: "643", centroid: [61.5, 105.3] },
  SAU: { name: "Saudi Arabia", numeric: "682", centroid: [24.0, 45.0] },
  SGP: { name: "Singapore", numeric: "702", centroid: [1.35, 103.8] },
  SRB: { name: "Serbia", numeric: "688", centroid: [44.0, 21.0] },   // not present in current data
  SVK: { name: "Slovakia", numeric: "703", centroid: [48.7, 19.5] },   // not present in current data
  SWE: { name: "Sweden", numeric: "752", centroid: [62.0, 15.0] },
  THA: { name: "Thailand", numeric: "764", centroid: [15.0, 101.0] },   // not present in current data
  TUN: { name: "Tunisia", numeric: "788", centroid: [34.0, 9.0] },
  TUR: { name: "Türkiye", numeric: "792", centroid: [39.0, 35.0] },
  TWN: { name: "Taiwan", numeric: "158", centroid: [23.7, 121.0] },
  UKR: { name: "Ukraine", numeric: "804", centroid: [49.0, 32.0] },   // not present in current data
  URY: { name: "Uruguay", numeric: "858", centroid: [-33.0, -56.0] },   // not present in current data
  USA: { name: "United States of America", numeric: "840", centroid: [39.0, -98.0] },
  VNM: { name: "Vietnam", numeric: "704", centroid: [16.0, 106.0] },   // not present in current data
  ZAF: { name: "South Africa", numeric: "710", centroid: [-29.0, 24.0] },
};

export function countryName(code) {
  return COUNTRIES[code]?.name || code;
}

export function countryNumeric(code) {
  return COUNTRIES[code]?.numeric || null;
}

export function centroidFor(code) {
  return COUNTRIES[code]?.centroid || null;
}

export function isKnownCountry(code) {
  return Object.prototype.hasOwnProperty.call(COUNTRIES, code);
}
