// Veride ülkeler ISO3 kod olarak geliyor ("ITA", "TUR", "USA"...), tam isim
// değil. Bu dosya iki şeyi sağlıyor:
//  1) COUNTRY_NAMES: kod -> okunabilir isim (tabloda/haritada göstermek için)
//  2) COUNTRY_CENTROIDS: kod -> yaklaşık [lat, lon] (harita noktası için,
//     GERÇEK bir centroid veritabanı değil, kaba ülke merkezi = mock konum)
// Listede olmayan bir kod görürsen buraya bir satır eklemen yeterli — kodu
// değiştirmene gerek yok.
export const COUNTRY_NAMES = {
  ITA: "Italy", TUR: "Türkiye", FRA: "France", DEU: "Germany", GBR: "United Kingdom",
  NLD: "Netherlands", POL: "Poland", USA: "USA", MEX: "Mexico", BRA: "Brazil",
  CHN: "China", JPN: "Japan", KOR: "South Korea", IND: "India", THA: "Thailand",
  VNM: "Vietnam", EGY: "Egypt", NGA: "Nigeria", KEN: "Kenya", AUS: "Australia",
  ESP: "Spain", GRC: "Greece", NOR: "Norway", PRT: "Portugal", BEL: "Belgium",
  CHE: "Switzerland", AUT: "Austria", SWE: "Sweden", DNK: "Denmark", FIN: "Finland",
  IRL: "Ireland", CAN: "Canada", ARG: "Argentina", CHL: "Chile", ZAF: "South Africa",
  RUS: "Russia", UKR: "Ukraine", ROU: "Romania", HUN: "Hungary", CZE: "Czechia",
  SVK: "Slovakia", HRV: "Croatia", SRB: "Serbia", BGR: "Bulgaria", IDN: "Indonesia",
  MYS: "Malaysia", PHL: "Philippines", SGP: "Singapore", NZL: "New Zealand",
  ISR: "Israel", SAU: "Saudi Arabia", ARE: "United Arab Emirates", PAK: "Pakistan",
  BGD: "Bangladesh", ETH: "Ethiopia", MAR: "Morocco", TUN: "Tunisia", DZA: "Algeria",
  COL: "Colombia", PER: "Peru", ECU: "Ecuador", URY: "Uruguay", CRI: "Costa Rica",
};

export const COUNTRY_CENTROIDS = {
  ITA: [42.0, 12.5], TUR: [39.0, 35.0], FRA: [46.5, 2.2], DEU: [51.0, 10.5],
  GBR: [54.0, -2.0], NLD: [52.3, 5.5], POL: [52.0, 19.5], USA: [39.0, -98.0],
  MEX: [23.0, -102.0], BRA: [-10.0, -55.0], CHN: [35.0, 103.0], JPN: [36.0, 138.0],
  KOR: [36.0, 127.7], IND: [22.0, 79.0], THA: [15.0, 101.0], VNM: [16.0, 106.0],
  EGY: [26.8, 30.8], NGA: [9.1, 8.7], KEN: [-1.0, 37.9], AUS: [-25.0, 134.0],
  ESP: [40.0, -4.0], GRC: [39.0, 22.0], NOR: [61.0, 8.5], PRT: [39.5, -8.0],
  BEL: [50.6, 4.5], CHE: [46.8, 8.2], AUT: [47.5, 14.5], SWE: [62.0, 15.0],
  DNK: [56.0, 10.0], FIN: [64.0, 26.0], IRL: [53.4, -8.0], CAN: [56.0, -106.0],
  ARG: [-34.0, -64.0], CHL: [-30.0, -71.0], ZAF: [-29.0, 24.0], RUS: [61.5, 105.3],
  UKR: [49.0, 32.0], ROU: [45.9, 25.0], HUN: [47.2, 19.5], CZE: [49.8, 15.5],
  SVK: [48.7, 19.5], HRV: [45.1, 15.2], SRB: [44.0, 21.0], BGR: [42.7, 25.5],
  IDN: [-2.5, 118.0], MYS: [4.2, 101.9], PHL: [13.0, 122.0], SGP: [1.35, 103.8],
  NZL: [-41.0, 174.0], ISR: [31.5, 34.8], SAU: [24.0, 45.0], ARE: [24.0, 54.0],
  PAK: [30.0, 70.0], BGD: [24.0, 90.0], ETH: [9.1, 40.5], MAR: [32.0, -6.0],
  TUN: [34.0, 9.0], DZA: [28.0, 3.0], COL: [4.0, -72.0], PER: [-10.0, -76.0],
  ECU: [-1.8, -78.2], URY: [-33.0, -56.0], CRI: [10.0, -84.0],
};

export function centroidFor(code) {
  return COUNTRY_CENTROIDS[code] || null;
}

export function countryName(code) {
  return COUNTRY_NAMES[code] || code;
}
