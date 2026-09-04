import { useMemo, useState } from "react";
import { ArrowRight, RotateCcw, Waves, ZoomIn, ZoomOut } from "lucide-react";

import { useApi } from "../../api/useApi.js";
import { annotationLabel, flowClassAnnotation, flowClassColor } from "../../domain/annotations.js";
import { categoryColor, categoryLabel } from "../../domain/categories.js";
import { arcPath, buildChordLayout, polar, ribbonPath } from "../../lib/geometry.js";
import { usePanZoom } from "../../lib/usePanZoom.js";
import { COLORS, FONT_MONO } from "../../theme/tokens.js";
import { FigureFrame } from "../ui/index.jsx";

// The ring is sized to fill the viewBox, leaving only the margin the radial
// labels need — the longest ("Fermented Fruits and Vegetables") extends about
// 165px past LABEL_R at this font size.
const WIDTH = 1000;
const HEIGHT = 1000;
const CX = 500;
const CY = 500;
const R = 292;
const OUTER_R = 310;
const LABEL_R = 320;

/**
 * Labels follow their radius, flipped on the lower half of the ring so they
 * stay upright. Horizontal labels collided badly where many small arcs sit
 * close together.
 *
 * The angle is normalised first: target arcs are laid out over -80..80, and a
 * raw negative angle would fail the flip test and render upside down.
 */
function labelPlacement(rawAngle) {
  const angle = ((rawAngle % 360) + 360) % 360;
  const [x, y] = polar(CX, CY, LABEL_R, angle);
  const flipped = angle > 180;
  return {
    x,
    y,
    transform: `rotate(${flipped ? angle + 90 : angle - 90}, ${x}, ${y})`,
    anchor: flipped ? "end" : "start",
  };
}

/**
 * Food category to functional feature class.
 *
 * Values come from the published chord matrix rather than being recounted from
 * the gene tables: three of its six classes (heat resistance, heavy-metal
 * resistance, virulence) have no per-gene source file, so recomputing would
 * silently drop half the figure.
 */
export function RibbonChord({ onSelectCategory, onSelectAnnotation }) {
  const { data, error, loading } = useApi("/api/stats/annotation-flow");
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [hoveredClass, setHoveredClass] = useState(null);
  const [selected, setSelected] = useState(null);
  const { containerRef, viewBox, zoomBy, reset, dragging, panHandlers } = usePanZoom({
    width: WIDTH,
    height: HEIGHT,
    maxZoom: 8,
  });

  const layout = useMemo(() => {
    if (!data) return null;
    const sources = data.categories.map((c) => ({
      ...c,
      label: categoryLabel(c.key),
      color: categoryColor(c.key),
    }));
    const targets = data.classes.map((c, i) => ({
      ...c,
      color: flowClassColor(c.key, i),
    }));
    return buildChordLayout(sources, targets);
  }, [data]);

  return (
    <FigureFrame
      icon={Waves}
      title="Category to Functional Annotation Flow"
      description="Ribbon width is power-compressed so every category stays visible despite hundred-fold differences in sample count; hover a ribbon for its true value. Ribbons are coloured by feature class."
      loading={loading}
      error={error}
      className="lg:col-span-2"
    >
      {() => {
        if (!layout || layout.ribbons.length === 0) {
          return (
            <p className="text-xs py-8 text-center" style={{ color: COLORS.inkSoft }}>
              No annotation-flow data is available.
            </p>
          );
        }

        const { sourceBlocks, targetBlocks, ribbons } = layout;
        const activeCategory = hoveredCategory || (selected?.kind === "category" ? selected.key : null);
        const activeClass = hoveredClass || (selected?.kind === "class" ? selected.key : null);
        // The footer follows the click, not the cursor: driven by hover it
        // disappeared the moment you moved towards the link it offered.
        const selectionLabel =
          selected?.kind === "category"
            ? categoryLabel(selected.key)
            : targetBlocks.find((t) => t.key === selected?.key)?.label || selected?.key;
        const annotationKey =
          selected?.kind === "class" ? flowClassAnnotation(selected.key) : null;

        return (
          <>
            <div className="flex items-center justify-end gap-1 mb-1">
              <button
                type="button"
                onClick={() => zoomBy(1.4)}
                aria-label="Zoom in"
                className="p-1.5 rounded-md"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }}
              >
                <ZoomIn size={13} />
              </button>
              <button
                type="button"
                onClick={() => zoomBy(1 / 1.4)}
                aria-label="Zoom out"
                className="p-1.5 rounded-md"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }}
              >
                <ZoomOut size={13} />
              </button>
              <button
                type="button"
                onClick={reset}
                aria-label="Reset view"
                className="p-1.5 rounded-md"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }}
              >
                <RotateCcw size={13} />
              </button>
            </div>

            <div ref={containerRef} {...panHandlers}>
            <svg
              viewBox={viewBox}
              className="w-full"
              style={{ maxHeight: "88vh" }}
              role="img"
              aria-label={`Chord diagram linking ${sourceBlocks.length} food categories to ${targetBlocks.length} functional feature classes.`}
            >
              <desc>
                Food categories occupy the lower arc of the ring and functional feature
                classes the upper arc. Ribbon thickness reflects the relative prevalence of
                that class within the category.
              </desc>

              <g style={{ pointerEvents: dragging ? "none" : "auto" }}>
              {ribbons.map((ribbon, i) => {
                const dimmed =
                  (activeCategory && activeCategory !== ribbon.sourceKey) ||
                  (activeClass && activeClass !== ribbon.targetKey);
                const highlighted =
                  activeCategory === ribbon.sourceKey || activeClass === ribbon.targetKey;
                return (
                  <path
                    key={i}
                    d={ribbonPath(
                      CX,
                      CY,
                      R,
                      ribbon.srcA0,
                      ribbon.srcA1,
                      ribbon.tgtA0,
                      ribbon.tgtA1
                    )}
                    fill={ribbon.color}
                    opacity={dimmed ? 0.05 : highlighted ? 0.85 : 0.45}
                    style={{ transition: "opacity .25s" }}
                  >
                    <title>
                      {`${categoryLabel(ribbon.sourceKey)} → ${
                        targetBlocks.find((t) => t.key === ribbon.targetKey)?.label
                      }: ${ribbon.value.toFixed(2)} per sample`}
                    </title>
                  </path>
                );
              })}

              {[
                { kind: "category", blocks: sourceBlocks, active: activeCategory, setHovered: setHoveredCategory },
                { kind: "class", blocks: targetBlocks, active: activeClass, setHovered: setHoveredClass },
              ].map(({ kind, blocks, active, setHovered }) =>
                blocks.map((block) => {
                  const isActive = active === block.key;
                  const isSelected = selected?.kind === kind && selected.key === block.key;
                  const place = labelPlacement((block.a0 + block.a1) / 2);
                  // The label is as much a target as the arc: several arcs are
                  // only a couple of pixels wide, and the label is what a
                  // reader is actually pointing at.
                  const handlers = {
                    onMouseEnter: () => setHovered(block.key),
                    onMouseLeave: () => setHovered(null),
                    onClick: () => setSelected(isSelected ? null : { kind, key: block.key }),
                    style: { cursor: "pointer" },
                  };
                  return (
                    <g key={`${kind}:${block.key}`}>
                      <path
                        d={arcPath(CX, CY, R, OUTER_R, block.a0, block.a1)}
                        fill={block.color}
                        opacity={active && !isActive ? 0.3 : 1}
                        {...handlers}
                        style={{ ...handlers.style, transition: "opacity .25s" }}
                      >
                        <title>{block.label}</title>
                      </path>
                      <text
                        x={place.x}
                        y={place.y}
                        transform={place.transform}
                        textAnchor={place.anchor}
                        dominantBaseline="middle"
                        {...handlers}
                        style={{
                          ...handlers.style,
                          fontSize: 10,
                          fill: isActive ? COLORS.ink : COLORS.inkSoft,
                          fontWeight: isActive || isSelected ? 700 : 400,
                          textDecoration: isSelected ? "underline" : "none",
                        }}
                      >
                        {block.label}
                      </text>
                    </g>
                  );
                })
              )}
              </g>
            </svg>
            </div>

            <div
              className="mt-2 pt-3 flex flex-wrap items-center justify-between gap-3"
              style={{ borderTop: `1px solid ${COLORS.line}` }}
            >
              {selected ? (
                <>
                  <span className="text-xs" style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}>
                    Selected:{" "}
                    <strong style={{ color: COLORS.darkTeal }}>{selectionLabel}</strong>
                  </span>
                  {selected.kind === "category" ? (
                    <button
                      type="button"
                      onClick={() => onSelectCategory?.(selected.key)}
                      className="inline-flex items-center gap-1 text-xs font-semibold"
                      style={{ color: COLORS.orange }}
                    >
                      See {selectionLabel} samples <ArrowRight size={12} />
                    </button>
                  ) : annotationKey ? (
                    <button
                      type="button"
                      onClick={() => onSelectAnnotation?.(annotationKey)}
                      className="inline-flex items-center gap-1 text-xs font-semibold"
                      style={{ color: COLORS.orange }}
                    >
                      Open {annotationLabel(annotationKey)} records <ArrowRight size={12} />
                    </button>
                  ) : (
                    <span className="text-xs" style={{ color: COLORS.inkSoft }}>
                      Aggregate class only — no gene-level table in this release.
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xs" style={{ color: COLORS.inkSoft }}>
                  Hover an arc to isolate its ribbons; click a category or feature class to
                  keep it selected and get a link to its records. Scroll to zoom, drag to
                  pan.
                </span>
              )}
            </div>
          </>
        );
      }}
    </FigureFrame>
  );
}
