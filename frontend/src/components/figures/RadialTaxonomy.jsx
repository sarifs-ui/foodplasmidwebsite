import { useMemo, useState } from "react";
import { GitBranch, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

import { useApi } from "../../api/useApi.js";
import {
  CATEGORY_LEGEND_ORDER,
  categoryColor,
  categoryShortLabel,
} from "../../domain/categories.js";
import { phylumColor } from "../../domain/phyla.js";
import { arcPath, polar } from "../../lib/geometry.js";
import { COLORS, FONT_MONO, clamp } from "../../theme/tokens.js";
import { FigureFrame } from "../ui/index.jsx";

const SIZE = 900;
const CX = SIZE / 2;
const CY = SIZE / 2;
/** Radius of the empty circle the root branches emerge from. */
const ROOT_R = 62;
/** Radius at which every leaf branch terminates. */
const LEAF_R = 250;
/** Phylum dot sits on the leaf tip; the bar ring starts just outside it. */
const DOT_R = 3.4;
const BAR_R0 = 262;
const BAR_LEN = 96;
const LABEL_R = BAR_R0 + BAR_LEN + 8;
/** Leaves fill 88% of their angular slot, leaving the white gutters of the reference. */
const BAR_FILL = 0.88;
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const TREE_STROKE = "#1a1a1a";

/**
 * Radial cladogram of plasmid host taxonomy.
 *
 * Laid out to match the published reference figure: a plain dark rectangular
 * dendrogram from phylum to family, a phylum-coloured dot on each leaf tip, and
 * a stacked bar per family showing which food categories it occurs in.
 *
 * Genus and species are excluded — they multiply the leaf count without adding
 * resolution the ring can show.
 */
export function RadialTaxonomy() {
  const { data, error, loading } = useApi("/api/stats/taxonomy");
  const [zoom, setZoom] = useState(1);

  const nodes = data?.nodes;
  const leaves = useMemo(() => (nodes || []).filter((n) => n.level === 3), [nodes]);
  const phylumNodes = useMemo(() => (nodes || []).filter((n) => n.level === 0), [nodes]);

  /** Leaves are spread evenly; every parent sits at the mean of its children. */
  const angleById = useMemo(() => {
    if (!nodes || leaves.length === 0) return {};
    const childrenOf = {};
    for (const node of nodes) {
      if (node.parentId) (childrenOf[node.parentId] ||= []).push(node.id);
    }
    const step = 360 / leaves.length;
    const angles = {};
    leaves.forEach((leaf, i) => {
      angles[leaf.id] = i * step + step / 2;
    });
    for (const level of [2, 1, 0]) {
      for (const node of nodes.filter((n) => n.level === level)) {
        const kids = childrenOf[node.id] || [];
        if (kids.length) {
          angles[node.id] = kids.reduce((sum, k) => sum + angles[k], 0) / kids.length;
        }
      }
    }
    return angles;
  }, [nodes, leaves]);

  /**
   * Everything is derived once. Rebuilding roughly a thousand SVG elements on
   * every interaction made the figure stutter.
   */
  const rendered = useMemo(() => {
    if (!nodes || leaves.length === 0) return null;

    // A rectangular dendrogram: each rank sits on its own radius, so a branch is
    // an arc at the parent's radius followed by a radial line out to the child.
    const depth = 3;
    const radiusFor = (level) => ROOT_R + ((LEAF_R - ROOT_R) * level) / depth;

    const byId = new Map(nodes.map((n) => [n.id, n]));
    const childrenOf = new Map();
    for (const node of nodes) {
      if (!node.parentId) continue;
      if (!childrenOf.has(node.parentId)) childrenOf.set(node.parentId, []);
      childrenOf.get(node.parentId).push(node);
    }

    const branches = [];

    // Root spokes: from the inner circle out to each phylum.
    for (const phylum of nodes.filter((n) => n.level === 0)) {
      const angle = angleById[phylum.id];
      const [x0, y0] = polar(CX, CY, ROOT_R, angle);
      const [x1, y1] = polar(CX, CY, radiusFor(0), angle);
      branches.push({ id: `root-${phylum.id}`, d: `M ${x0},${y0} L ${x1},${y1}` });
    }

    // For every internal node: one arc spanning its children, plus a radial
    // segment out to each child.
    for (const [parentId, kids] of childrenOf) {
      const parent = byId.get(parentId);
      if (!parent) continue;
      const rParent = radiusFor(parent.level);
      const rChild = radiusFor(parent.level + 1);
      const childAngles = kids.map((k) => angleById[k.id]).filter((a) => a !== undefined);
      if (childAngles.length === 0) continue;

      const a0 = Math.min(...childAngles);
      const a1 = Math.max(...childAngles);
      if (a1 > a0) {
        const [sx, sy] = polar(CX, CY, rParent, a0);
        const [ex, ey] = polar(CX, CY, rParent, a1);
        const large = a1 - a0 > 180 ? 1 : 0;
        branches.push({
          id: `arc-${parentId}`,
          d: `M ${sx},${sy} A ${rParent},${rParent} 0 ${large} 1 ${ex},${ey}`,
        });
      }
      for (const kid of kids) {
        const angle = angleById[kid.id];
        if (angle === undefined) continue;
        const [sx, sy] = polar(CX, CY, rParent, angle);
        const [ex, ey] = polar(CX, CY, rChild, angle);
        branches.push({ id: `br-${kid.id}`, d: `M ${sx},${sy} L ${ex},${ey}` });
      }
    }

    const barWidth = (360 / leaves.length) * BAR_FILL;

    const tips = leaves.map((leaf) => {
      const angle = angleById[leaf.id];
      const [x, y] = polar(CX, CY, LEAF_R, angle);
      return { id: leaf.id, x, y, phylum: leaf.phylumId?.replace(/^p:/, "") || "" };
    });

    const bars = leaves.flatMap((leaf) => {
      const angle = angleById[leaf.id];
      if (angle === undefined || !leaf.composition) return [];
      const a0 = angle - barWidth / 2;
      let offset = 0;
      return Object.entries(leaf.composition)
        .filter(([, fraction]) => fraction > 0)
        // Stack in legend order so every family reads the same way outward.
        .sort(
          (a, b) =>
            CATEGORY_LEGEND_ORDER.findIndex((c) => c.key === a[0]) -
            CATEGORY_LEGEND_ORDER.findIndex((c) => c.key === b[0])
        )
        .map(([category, fraction]) => {
          const r0 = BAR_R0 + offset * BAR_LEN;
          const r1 = r0 + fraction * BAR_LEN;
          offset += fraction;
          return {
            key: `${leaf.id}-${category}`,
            category,
            leafLabel: leaf.label,
            fraction,
            d: arcPath(CX, CY, r0, r1, a0, a0 + barWidth),
          };
        });
    });

    const labels = leaves.map((leaf) => {
      const angle = angleById[leaf.id];
      const [x, y] = polar(CX, CY, LABEL_R, angle);
      const flipped = angle > 180;
      return {
        id: leaf.id,
        label: leaf.label,
        count: leaf.count,
        x,
        y,
        transform: `rotate(${flipped ? angle + 90 : angle - 90}, ${x}, ${y})`,
        anchor: flipped ? "end" : "start",
      };
    });

    return { branches, tips, bars, labels };
  }, [nodes, leaves, angleById]);

  const usedCategories = useMemo(() => {
    const used = new Set();
    for (const leaf of leaves) {
      for (const [category, fraction] of Object.entries(leaf.composition || {})) {
        if (fraction > 0) used.add(category);
      }
    }
    return CATEGORY_LEGEND_ORDER.filter((c) => used.has(c.key));
  }, [leaves]);

  const usedPhyla = useMemo(
    () => phylumNodes.map((p) => p.label).sort((a, b) => a.localeCompare(b)),
    [phylumNodes]
  );

  // Zoom keeps the figure centred; there is no panning and nothing is clickable,
  // so the view can never end up somewhere the reader cannot get back from.
  const viewSize = SIZE / zoom;
  const viewOrigin = (SIZE - viewSize) / 2;

  return (
    <FigureFrame
      icon={GitBranch}
      title="Plasmid Host Cladogram"
      description="Phylum to family. Each leaf carries a stacked bar showing the food categories that family occurs in; the dot on each tip is coloured by phylum."
      loading={loading}
      error={error}
      className="lg:col-span-2"
    >
      {(isFullscreen) => {
        if (!rendered) {
          return (
            <p className="text-xs py-8 text-center" style={{ color: COLORS.inkSoft }}>
              No taxonomy data is available.
            </p>
          );
        }

        return (
          <>
            <div className="flex items-center justify-end gap-1 mb-2">
              <button
                type="button"
                onClick={() => setZoom((z) => clamp(z * 1.4, MIN_ZOOM, MAX_ZOOM))}
                aria-label="Zoom in"
                className="p-1.5 rounded-md"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }}
              >
                <ZoomIn size={13} />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => clamp(z / 1.4, MIN_ZOOM, MAX_ZOOM))}
                aria-label="Zoom out"
                className="p-1.5 rounded-md"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }}
              >
                <ZoomOut size={13} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                aria-label="Reset zoom"
                className="p-1.5 rounded-md"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }}
              >
                <RotateCcw size={13} />
              </button>
            </div>

            {/* Category legend left, phylum legend right, chart between them —
                the layout of the reference figure. */}
            <div
              className={`flex gap-4 ${isFullscreen ? "flex-1 min-h-0" : ""}`}
              style={{ alignItems: "flex-start" }}
            >
              <Legend
                title="Category"
                items={usedCategories.map((c) => ({
                  key: c.key,
                  label: c.short,
                  color: c.color,
                }))}
              />

              <div className="flex-1 min-w-0">
                <svg
                  viewBox={`${viewOrigin} ${viewOrigin} ${viewSize} ${viewSize}`}
                  className="w-full"
                  style={{ maxHeight: isFullscreen ? "100%" : "78vh" }}
                  role="img"
                  aria-label={`Radial cladogram of ${leaves.length} bacterial families across ${usedPhyla.length} phyla, each annotated with its food-category composition.`}
                >
                  <desc>
                    A circular dendrogram of plasmid host taxonomy from phylum to family.
                    Each tip is marked with a phylum-coloured dot and followed by a stacked
                    bar split by food category.
                  </desc>

                  {rendered.branches.map((branch) => (
                    <path
                      key={branch.id}
                      d={branch.d}
                      fill="none"
                      stroke={TREE_STROKE}
                      strokeWidth={1.1}
                      strokeLinecap="round"
                    />
                  ))}

                  {rendered.tips.map((tip) => (
                    <circle
                      key={tip.id}
                      cx={tip.x}
                      cy={tip.y}
                      r={DOT_R}
                      fill={phylumColor(tip.phylum, usedPhyla.indexOf(tip.phylum))}
                    />
                  ))}

                  {rendered.bars.map((bar) => (
                    <path key={bar.key} d={bar.d} fill={categoryColor(bar.category)}>
                      <title>{`${bar.leafLabel} · ${categoryShortLabel(bar.category)} · ${(bar.fraction * 100).toFixed(1)}%`}</title>
                    </path>
                  ))}

                  {rendered.labels.map((label) => (
                    <text
                      key={label.id}
                      x={label.x}
                      y={label.y}
                      transform={label.transform}
                      textAnchor={label.anchor}
                      dominantBaseline="middle"
                      style={{ fontSize: 8, fontWeight: 700, fill: "#111" }}
                    >
                      {label.label}
                    </text>
                  ))}
                </svg>
              </div>

              <Legend
                title="Phylum"
                items={usedPhyla.map((name, i) => ({
                  key: name,
                  label: name,
                  color: phylumColor(name, i),
                }))}
              />
            </div>
          </>
        );
      }}
    </FigureFrame>
  );
}

/** Vertical legend column, as in the reference figure. */
function Legend({ title, items }) {
  return (
    <div className="shrink-0 w-[132px] pt-1">
      <div
        className="text-[10px] uppercase tracking-wide mb-1.5"
        style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}
      >
        {title}
      </div>
      <ul className="space-y-[3px] list-none p-0 m-0">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-start gap-1.5 text-[9.5px] leading-tight"
            style={{ color: COLORS.ink }}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-[2px] shrink-0 mt-[1px]"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
