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

const NO_DATA_FILL = "#EDF1F5";
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

/** Sequential light-to-dark blue. */
const BLUE_LIGHT = { h: 205, s: 72, l: 92 };
const BLUE_DARK = { h: 218, s: 88, l: 22 };

/**
 * Counts span three orders of magnitude (1 to ~1,200 samples; up to ~1.2M
 * contigs), so intensity is assigned on a log scale — a linear ramp would leave
 * everything except the top few countries at the palest tone.
 */
function blueScale(value, maxValue) {
  if (!value) return NO_DATA_FILL;
  const t = Math.min(1, Math.log1p(value) / Math.log1p(maxValue || 1));
  const h = BLUE_LIGHT.h + (BLUE_DARK.h - BLUE_LIGHT.h) * t;
  const sat = BLUE_LIGHT.s + (BLUE_DARK.s - BLUE_LIGHT.s) * t;
  const l = BLUE_LIGHT.l + (BLUE_DARK.l - BLUE_LIGHT.l) * t;
  return `hsl(${h.toFixed(1)}, ${sat.toFixed(1)}%, ${l.toFixed(1)}%)`;
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
                          : blueScale(row[valueField], maxValue);
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={fill}
                          stroke="#fff"
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
                  background: `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1]
                    .map((t) => blueScale(Math.expm1(t * Math.log1p(maxValue)), maxValue))
                    .join(", ")})`,
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
