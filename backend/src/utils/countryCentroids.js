// Ülke adı -> yaklaşık [lat, lon]. Gerçek bir centroid veritabanı değil,
// kaba ülke merkezi (mock centroid). Sample sayıları/kategoriler gerçek
// veriden gelir, sadece haritadaki nokta konumu yaklaşık.
export const COUNTRY_CENTROIDS = {
  "Italy": [42.0, 12.5],
  "Türkiye": [39.0, 35.0],
  "Turkey": [39.0, 35.0],
  "France": [46.5, 2.2],
  "Germany": [51.0, 10.5],
  "United Kingdom": [54.0, -2.0],
  "Netherlands": [52.3, 5.5],
  "Poland": [52.0, 19.5],
  "USA": [39.0, -98.0],
  "United States": [39.0, -98.0],
  "Mexico": [23.0, -102.0],
  "Brazil": [-10.0, -55.0],
  "China": [35.0, 103.0],
  "Japan": [36.0, 138.0],
  "South Korea": [36.0, 127.7],
  "India": [22.0, 79.0],
  "Thailand": [15.0, 101.0],
  "Vietnam": [16.0, 106.0],
  "Egypt": [26.8, 30.8],
  "Nigeria": [9.1, 8.7],
  "Kenya": [-1.0, 37.9],
  "Australia": [-25.0, 134.0],
  "Spain": [40.0, -4.0],
  "Greece": [39.0, 22.0],
  "Norway": [61.0, 8.5],
};

export function centroidFor(country) {
  return COUNTRY_CENTROIDS[country] || null;
}
