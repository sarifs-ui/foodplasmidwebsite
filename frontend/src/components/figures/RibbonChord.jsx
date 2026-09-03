import { useMemo, useState } from "react";
import { ArrowRight, Waves } from "lucide-react";

import { useApi } from "../../api/useApi.js";
import { flowClassColor } from "../../domain/annotations.js";
import { categoryColor, categoryLabel } from "../../domain/categories.js";
import { arcPath, buildChordLayout, polar, ribbonPath } from "../../lib/geometry.js";
import { COLORS, FONT_MONO } from "../../theme/tokens.js";
import { FigureFrame } from "../ui/index.jsx";

// The viewBox leaves room for radial labels, the longest of which
// ("Fermented Fruits and Vegetables") extends about 160px past LABEL_R.
const WIDTH = 1000;
const HEIGHT = 960;
const CX = 500;
const CY = 470;
const R = 230;
const OUTER_R = 245;
const LABEL_R = 258;

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
export function RibbonChord({ onSelectCategory }) {
  const { data, error, loading } = useApi("/api/stats/annotation-flow");
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [hoveredClass, setHoveredClass] = useState(null);
  const [selected, setSelected] = useState(null);

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

        return (
          <>
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="w-full"
              style={{ maxHeight: "75vh" }}
              role="img"
              aria-label={`Chord diagram linking ${sourceBlocks.length} food categories to ${targetBlocks.length} functional feature classes.`}
            >
              <desc>
                Food categories occupy the lower arc of the ring and functional feature
                classes the upper arc. Ribbon thickness reflects the relative prevalence of
                that class within the category.
              </desc>

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

              {sourceBlocks.map((block) => {
                const isActive = activeCategory === block.key;
                const place = labelPlacement((block.a0 + block.a1) / 2);
                return (
                  <g key={block.key}>
                    <path
                      d={arcPath(CX, CY, R, OUTER_R, block.a0, block.a1)}
                      fill={block.color}
                      opacity={activeCategory && !isActive ? 0.3 : 1}
                      style={{ cursor: "pointer", transition: "opacity .25s" }}
                      onMouseEnter={() => setHoveredCategory(block.key)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      onClick={() =>
                        setSelected(
                          selected?.kind === "category" && selected.key === block.key
                            ? null
                            : { kind: "category", key: block.key }
                        )
                      }
                    >
                      <title>{block.label}</title>
                    </path>
                    <text
                      x={place.x}
                      y={place.y}
                      transform={place.transform}
                      textAnchor={place.anchor}
                      dominantBaseline="middle"
                      style={{
                        fontSize: 10,
                        fill: isActive ? COLORS.ink : COLORS.inkSoft,
                        fontWeight: isActive ? 700 : 400,
                        pointerEvents: "none",
                      }}
                    >
                      {block.label}
                    </text>
                  </g>
                );
              })}

              {targetBlocks.map((block) => {
                const isActive = activeClass === block.key;
                const place = labelPlacement((block.a0 + block.a1) / 2);
                return (
                  <g key={block.key}>
                    <path
                      d={arcPath(CX, CY, R, OUTER_R, block.a0, block.a1)}
                      fill={block.color}
                      opacity={activeClass && !isActive ? 0.3 : 1}
                      style={{ cursor: "pointer", transition: "opacity .25s" }}
                      onMouseEnter={() => setHoveredClass(block.key)}
                      onMouseLeave={() => setHoveredClass(null)}
                      onClick={() =>
                        setSelected(
                          selected?.kind === "class" && selected.key === block.key
                            ? null
                            : { kind: "class", key: block.key }
                        )
                      }
                    >
                      <title>{block.label}</title>
                    </path>
                    <text
                      x={place.x}
                      y={place.y}
                      transform={place.transform}
                      textAnchor={place.anchor}
                      dominantBaseline="middle"
                      style={{
                        fontSize: 10,
                        fill: isActive ? COLORS.ink : COLORS.inkSoft,
                        fontWeight: isActive ? 700 : 400,
                        pointerEvents: "none",
                      }}
                    >
                      {block.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div
              className="mt-2 pt-3 flex flex-wrap items-center justify-between gap-3"
              style={{ borderTop: `1px solid ${COLORS.line}` }}
            >
              {activeCategory ? (
                <>
                  <span className="text-xs" style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}>
                    {categoryLabel(activeCategory)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectCategory?.(activeCategory)}
                    className="inline-flex items-center gap-1 text-xs font-semibold"
                    style={{ color: COLORS.orange }}
                  >
                    See {categoryLabel(activeCategory)} samples <ArrowRight size={12} />
                  </button>
                </>
              ) : (
                <span className="text-xs" style={{ color: COLORS.inkSoft }}>
                  Hover an arc to isolate its ribbons; click to keep the selection.
                </span>
              )}
            </div>
          </>
        );
      }}
    </FigureFrame>
  );
}
