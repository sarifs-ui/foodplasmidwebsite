/**
 * Design tokens.
 *
 * These are mirrored into tailwind.config.js as `theme.extend.colors`, so the
 * same palette is reachable as utility classes (`text-gfpr-darkTeal`) and as
 * JS values where a colour has to be computed (SVG fills, gradients).
 */
export const COLORS = {
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
};

export const FONT_BODY = "Calibri, 'Segoe UI', Arial, Helvetica, sans-serif";
export const FONT_DISPLAY = FONT_BODY;
/** IBM Plex Mono — used for identifiers, table values and statistics. */
export const FONT_MONO = "'IBM Plex Mono', ui-monospace, 'SF Mono', Consolas, monospace";

/** Shared surface style for cards, so the same border/background is not retyped. */
export const CARD_SURFACE = {
  backgroundColor: "#fff",
  border: `1px solid ${COLORS.line}`,
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
