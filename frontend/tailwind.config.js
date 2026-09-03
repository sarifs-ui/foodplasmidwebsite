/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Mirrors src/theme/tokens.js so the palette is reachable both as
      // utility classes and as JS values for computed SVG fills.
      colors: {
        gfpr: {
          darkTeal: "#006060",
          medTeal: "#539E9E",
          lightTeal: "#B8DADA",
          orange: "#EB7F00",
          yellow: "#FFBF3D",
          deepOrange: "#B35900",
          berry: "#7A3B49",
          paper: "#F6FAF9",
          paperAlt: "#EDF5F4",
          paperWarm: "#FDF3E8",
          ink: "#0C2B2B",
          inkSoft: "#3E5C5C",
          line: "#CFE3E1",
        },
      },
      fontFamily: {
        sans: ["Calibri", "Segoe UI", "Arial", "Helvetica", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SF Mono", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
