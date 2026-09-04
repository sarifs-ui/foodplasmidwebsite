import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Globe2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";

import { useApi } from "../../api/useApi.js";
import { categoryColor, categoryLabel } from "../../domain/categories.js";
import { COLORS, FONT_MONO, clamp } from "../../theme/tokens.js";
import { FigureFrame, SegmentedControl } from "../ui/index.jsx";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const MODE_OPTIONS = [
  { value: "count", label: "Samples" },
  { value: "contigs", label: "Plasmid contigs" },
  { value: "category", label: "Dominant category" },
];

const NO_DATA_FILL = "#ECECEA";
const BORDER = "#FFFFFF";
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

/**
 * Sequential teal ramp, light to dark, built on the project's #006060 base so
 * the map sits in the same colour family as the rest of the site.
 *
 * The stops are evenly spaced and interpolated in RGB, matching how
 * matplotlib's LinearSegmentedColormap.from_list treats the same list.
 */
const RAMP = ["#DCF0EC", "#A9DED4", "#6FC5B8", "#3AA79C", "#12897F", "#006060", "#00393B"];

const RAMP_RGB = RAMP.map((hex) => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
]);

/** Sample the ramp at t in [0, 1]. */
function rampColor(t) {
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (RAMP_RGB.length - 1);
  const i = Math.min(RAMP_RGB.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const [r1, g1, b1] = RAMP_RGB[i];
  const [r2, g2, b2] = RAMP_RGB[i + 1];
  const mix = (a, b) => Math.round(a + (b - a) * f);
  return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
}

/**
 * Counts span three orders of magnitude (1 to ~1,200 samples; up to ~1.1M
 * contigs), so position on the ramp is assigned on a log scale — a linear one
 * would leave everything except the top few countries at the palest tone.
 */
function tealScale(value, maxValue) {
  if (!value) return NO_DATA_FILL;
  return rampColor(Math.log1p(value) / Math.log1p(maxValue || 1));
}

/**
 * Global sample distribution.
 *
 * Countries are matched to the atlas by ISO 3166-1 numeric code. Matching on
 * display names used to drop 12 countries whose spelling differed between the
 * two sources — including the United States, the third-largest contributor.
 */
export function WorldMap({ onSelectCountry }) {
  const { data, error, loading } = useApi("/api/stats/map");
  const [mode, setMode] = useState("count");
  const [position, setPosition] = useState({ coordinates: [0, 20], zoom: 1 });
  const [hovered, setHovered] = useState(null);
  const [locked, setLocked] = useState(null);
  const containerRef = useRef(null);

  const valueField = mode === "contigs" ? "contigs" : "count";

  const { byNumeric, maxValue } = useMemo(() => {
    const map = new Map();
    let max = 0;
    for (const row of data || []) {
      if (row.numeric) map.set(row.numeric, row);
      max = Math.max(max, row[valueField] || 0);
    }
    return { byNumeric: map, maxValue: max };
  }, [data, valueField]);

  // Countries present in the data that the 110m geometry has no shape for
  // (city-states and small territories). Called out rather than dropped.
  const unmapped = useMemo(
    () => (data || []).filter((row) => !row.numeric || !row.known),
    [data]
  );

  const setZoom = useCallback((next) => {
    setPosition((prev) => ({ ...prev, zoom: clamp(next, MIN_ZOOM, MAX_ZOOM) }));
  }, []);

  // React attaches onWheel passively, so preventDefault() inside a JSX handler
  // is ignored and the page scrolls instead. A manual non-passive listener is
  // the only way to own the gesture.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      setPosition((prev) => ({
        ...prev,
        zoom: clamp(prev.zoom * (event.deltaY > 0 ? 0.85 : 1.15), MIN_ZOOM, MAX_ZOOM),
      }));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  const active = hovered || locked;

  return (
    <FigureFrame
      icon={Globe2}
      title="Global Sample Distribution"
      loading={loading}
      error={error}
      className="lg:col-span-2"
    >
      {() => (
        <>
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <SegmentedControl
              options={MODE_OPTIONS}
              value={mode}
              onChange={setMode}
              label="Map colouring"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoom(position.zoom * 1.5)}
                aria-label="Zoom in"
                className="p-1.5 rounded-md"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }}
              >
                <ZoomIn size={13} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(position.zoom / 1.5)}
                aria-label="Zoom out"
                className="p-1.5 rounded-md"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }}
              >
                <ZoomOut size={13} />
              </button>
              <button
                type="button"
                onClick={() => setPosition({ coordinates: [0, 20], zoom: 1 })}
                aria-label="Reset map view"
                className="p-1.5 rounded-md"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }}
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </div>

          <div ref={containerRef} style={{ cursor: "grab" }}>
            <ComposableMap
              projectionConfig={{ scale: 147 }}
              width={800}
              height={400}
              style={{ width: "100%", height: "auto" }}
              role="img"
              aria-label={`World map showing sample counts for ${byNumeric.size} countries.`}
            >
              <ZoomableGroup
                zoom={position.zoom}
                center={position.coordinates}
                onMoveEnd={(next) => setPosition(next)}
                maxZoom={MAX_ZOOM}
                minZoom={MIN_ZOOM}
              >
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const row = byNumeric.get(geo.id);
                      const isActive = active && row && active.code === row.code;
                      const fill = !row
                        ? NO_DATA_FILL
                        : mode === "category"
                          ? categoryColor(row.category)
                          : tealScale(row[valueField], maxValue);
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={fill}
                          stroke={BORDER}
                          strokeWidth={(isActive ? 1.2 : 0.4) / position.zoom}
                          tabIndex={row ? 0 : -1}
                          role={row ? "button" : undefined}
                          aria-label={
                            row
                              ? `${row.label}: ${row.count} samples, ${row.contigs.toLocaleString("en-US")} plasmid contigs, mostly ${categoryLabel(row.category)}`
                              : undefined
                          }
                          onMouseEnter={() => row && setHovered(row)}
                          onMouseLeave={() => setHovered(null)}
                          onFocus={() => row && setHovered(row)}
                          onBlur={() => setHovered(null)}
                          onClick={() => row && setLocked(locked?.code === row.code ? null : row)}
                          onKeyDown={(event) => {
                            if (row && (event.key === "Enter" || event.key === " ")) {
                              event.preventDefault();
                              setLocked(locked?.code === row.code ? null : row);
                            }
                          }}
                          style={{
                            default: { outline: "none" },
                            hover: { outline: "none", cursor: row ? "pointer" : "default" },
                            pressed: { outline: "none" },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>
          </div>

          {mode !== "category" && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px]" style={{ color: COLORS.inkSoft }}>
                1
              </span>
              {/* Stops are placed on the same log scale as the map itself. */}
              <div
                className="h-2 flex-1 rounded-full"
                style={{
                  background: `linear-gradient(to right, ${RAMP.join(", ")})`,
                }}
              />
              <span className="text-[10px]" style={{ color: COLORS.inkSoft }}>
                {maxValue.toLocaleString("en-US")}
                {mode === "contigs" ? " contigs" : " samples"}
              </span>
            </div>
          )}

          <div
            className="mt-3 pt-3 flex flex-wrap items-center justify-between gap-3 min-h-[42px]"
            style={{ borderTop: `1px solid ${COLORS.line}` }}
          >
            {active ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <strong className="text-sm" style={{ color: COLORS.darkTeal }}>
                    {active.label}
                  </strong>
                  <span
                    className="text-xs"
                    style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}
                  >
                    {active.count.toLocaleString("en-US")} samples ·{" "}
                    {active.contigs.toLocaleString("en-US")} contigs
                  </span>
                  {active.category && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs text-white"
                      style={{ backgroundColor: categoryColor(active.category) }}
                    >
                      {categoryLabel(active.category)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectCountry?.(active.code)}
                    className="inline-flex items-center gap-1 text-xs font-semibold"
                    style={{ color: COLORS.orange }}
                  >
                    See {active.label} samples <ArrowRight size={12} />
                  </button>
                  {locked && (
                    <button
                      type="button"
                      onClick={() => setLocked(null)}
                      className="text-xs"
                      style={{ color: COLORS.inkSoft }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </>
            ) : (
              <span className="text-xs" style={{ color: COLORS.inkSoft }}>
                Hover or click a country for its sample counts.
                {unmapped.length > 0 &&
                  ` ${unmapped.map((u) => u.label).join(", ")} ${
                    unmapped.length === 1 ? "is" : "are"
                  } in the data but too small to draw at this map resolution.`}
              </span>
            )}
          </div>
        </>
      )}
    </FigureFrame>
  );
}
