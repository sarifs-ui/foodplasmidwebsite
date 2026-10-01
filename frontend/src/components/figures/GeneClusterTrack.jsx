import { useMemo, useState } from "react";
import { CARD_SURFACE, COLORS, FONT_BODY, FONT_MONO } from "../../theme/tokens.js";

const CATEGORY_COLORS = {
  GH: COLORS.darkTeal,
  GT: COLORS.orange,
  CE: COLORS.yellow,
  PL: COLORS.medTeal,
  CBM: COLORS.berry,
  AA: COLORS.deepOrange,
  TC: "#2E7D7D",
  Peptidase: "#C25927",
  TF: "#5C6F84",
  STP: "#845EC2",
  Sulfatase: "#008F7A",
};

const CATEGORY_FULL_NAMES = {
  GH: "Glycoside Hydrolase (GH)",
  GT: "GlycosylTransferase (GT)",
  CE: "Carbohydrate Esterase (CE)",
  PL: "Polysaccharide Lyase (PL)",
  CBM: "Carbohydrate-Binding Module (CBM)",
  AA: "Auxiliary Activity (AA)",
  TC: "Transporter (TC)",
  Peptidase: "Peptidase",
  TF: "Transcription Factor (TF)",
  STP: "Signal Transduction Protein (STP)",
  Sulfatase: "Sulfatase",
};

const UNANNOTATED_COLOR = "#94A3B8";

export function getGeneColor(gene, index = 0) {
  const cat = gene.cazyCategory || gene.category || gene.geneType;
  if (cat && CATEGORY_COLORS[cat]) {
    return CATEGORY_COLORS[cat];
  }
  if (!cat) {
    return UNANNOTATED_COLOR;
  }
  const fallback = [
    COLORS.darkTeal,
    COLORS.orange,
    COLORS.medTeal,
    COLORS.berry,
    COLORS.deepOrange,
    COLORS.yellow,
    "#2E7D7D",
    "#845EC2",
  ];
  return fallback[index % fallback.length];
}

export function getGeneAnnotationName(gene) {
  if (gene.recommendResults && gene.recommendResults !== "-") {
    return gene.recommendResults;
  }
  if (gene.geneAnnotation && gene.geneAnnotation !== "-") {
    const parts = gene.geneAnnotation.split("|");
    const last = parts[parts.length - 1]?.trim();
    if (last && last !== "-") return last;
  }
  if (gene.geneType && gene.geneType !== "-") {
    return gene.geneType;
  }
  return null;
}

export function getGeneDisplayName(gene) {
  const annName = getGeneAnnotationName(gene);
  if (annName) return annName;
  if (gene.proteinId) return gene.proteinId;
  return "Gene";
}

// SVG layout constants (compact)
const SVG_WIDTH = 680;
const SVG_HEIGHT = 92;
const MARGIN_X = 35;
const TRACK_WIDTH = SVG_WIDTH - MARGIN_X * 2;
const ARROW_Y = 28;
const ARROW_H = 22;
const ARROW_HEAD = 9;

/**
 * A single cluster track row — header, SVG arrows, detail, legend.
 */
function SingleCluster({ cluster, divider }) {
  const [activeGene, setActiveGene] = useState(null);
  const { cgcId, contigId, genes = [] } = cluster;

  const minCoord = useMemo(() => {
    let min = cluster.clusterStart ?? Infinity;
    for (const g of genes) {
      if (g.geneStart != null && g.geneStart < min) min = g.geneStart;
    }
    return min === Infinity ? 0 : min;
  }, [cluster.clusterStart, genes]);

  const maxCoord = useMemo(() => {
    let max = cluster.clusterEnd ?? -Infinity;
    for (const g of genes) {
      if (g.geneStop != null && g.geneStop > max) max = g.geneStop;
    }
    return max === -Infinity ? 1000 : max;
  }, [cluster.clusterEnd, genes]);

  const span = Math.max(1, maxCoord - minCoord);
  const toX = useMemo(
    () => (coord) => MARGIN_X + ((coord - minCoord) / span) * TRACK_WIDTH,
    [minCoord, span]
  );

  // Group and assign coordinate ticks to tiered rows to avoid overlapping labels
  const coordinateTicks = useMemo(() => {
    const rawTicks = [];
    genes.forEach((g) => {
      if (g.geneStart != null) rawTicks.push({ coord: g.geneStart, gene: g, type: "start" });
      if (g.geneStop != null) rawTicks.push({ coord: g.geneStop, gene: g, type: "stop" });
    });
    rawTicks.sort((a, b) => a.coord - b.coord);

    // Group adjacent boundary points within <= 5px into single combined label (e.g. 2,023 / 2,058)
    const grouped = [];
    rawTicks.forEach((t) => {
      const x = toX(t.coord);
      const prev = grouped[grouped.length - 1];
      if (prev && Math.abs(x - prev.x) <= 5) {
        prev.coords.push(t.coord);
        prev.genes.push(t.gene);
        prev.x = prev.coords.reduce((sum, c) => sum + toX(c), 0) / prev.coords.length;
      } else {
        grouped.push({ coords: [t.coord], x, genes: [t.gene] });
      }
    });

    const MIN_LABEL_GAP = 28;
    const lastXPerTier = [-Infinity, -Infinity];

    return grouped.map((g) => {
      const uniqueCoords = Array.from(new Set(g.coords));
      const label = uniqueCoords.map((c) => c.toLocaleString("en-US")).join(" / ");
      let tier = 0;
      if (g.x - lastXPerTier[0] >= MIN_LABEL_GAP) {
        tier = 0;
        lastXPerTier[0] = g.x;
      } else if (g.x - lastXPerTier[1] >= MIN_LABEL_GAP) {
        tier = 1;
        lastXPerTier[1] = g.x;
      } else {
        if (g.x - lastXPerTier[1] > g.x - lastXPerTier[0]) {
          tier = 1;
          lastXPerTier[1] = g.x;
        } else {
          tier = 0;
          lastXPerTier[0] = g.x;
        }
      }
      return {
        coords: uniqueCoords,
        label,
        x: g.x,
        genes: g.genes,
        tier,
      };
    });
  }, [genes, toX]);

  const toggleGene = (gene) =>
    setActiveGene((prev) =>
      prev?.proteinId === gene.proteinId && prev?.geneStart === gene.geneStart
        ? null
        : gene
    );

  return (
    <div>
      {divider && (
        <div className="border-t my-2.5" style={{ borderColor: COLORS.line }} />
      )}

      {/* Cluster subheader */}
      <div
        className="flex items-center justify-between flex-wrap gap-2 mb-1.5 text-xs"
        style={{ color: COLORS.inkSoft }}
      >
        <div className="flex items-center gap-2">
          <span
            className="font-semibold text-[11px]"
            style={{ color: COLORS.darkTeal, fontFamily: FONT_MONO }}
          >
            {cgcId || "CGC"}
          </span>
          {contigId && (
            <span className="font-mono text-[10px] text-slate-400">
              {contigId}
            </span>
          )}
        </div>
        <span className="font-mono text-[10px]">
          {minCoord.toLocaleString("en-US")} – {maxCoord.toLocaleString("en-US")} bp
          <span className="opacity-60 ml-1">({(span + 1).toLocaleString("en-US")} bp)</span>
        </span>
      </div>

      {/* SVG arrow track */}
      <div
        className="w-full overflow-x-auto rounded-lg bg-slate-50/70 border"
        style={{ borderColor: COLORS.line }}
      >
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full min-w-[480px] select-none"
          role="img"
          aria-label={`Gene cluster track for ${cgcId || "CGC"}`}
        >
          {/* Track baseline */}
          <line
            x1={MARGIN_X}
            y1={ARROW_Y + ARROW_H / 2}
            x2={SVG_WIDTH - MARGIN_X}
            y2={ARROW_Y + ARROW_H / 2}
            stroke="#cbd5e1"
            strokeWidth={2}
            strokeDasharray="3 3"
          />

          {/* Start tick */}
          <line
            x1={MARGIN_X} y1={ARROW_Y + ARROW_H / 2 - 13}
            x2={MARGIN_X} y2={ARROW_Y + ARROW_H / 2 + 13}
            stroke="#94a3b8" strokeWidth={1.5}
          />
          <text
            x={MARGIN_X} y={ARROW_Y - 9}
            textAnchor="start"
            className="text-[8px]"
            style={{ fill: COLORS.inkSoft, fontFamily: FONT_MONO }}
          >
            {minCoord.toLocaleString("en-US")} bp
          </text>

          {/* End tick */}
          <line
            x1={SVG_WIDTH - MARGIN_X} y1={ARROW_Y + ARROW_H / 2 - 13}
            x2={SVG_WIDTH - MARGIN_X} y2={ARROW_Y + ARROW_H / 2 + 13}
            stroke="#94a3b8" strokeWidth={1.5}
          />
          <text
            x={SVG_WIDTH - MARGIN_X} y={ARROW_Y - 9}
            textAnchor="end"
            className="text-[8px]"
            style={{ fill: COLORS.inkSoft, fontFamily: FONT_MONO }}
          >
            {maxCoord.toLocaleString("en-US")} bp
          </text>

          {/* Gene Arrows */}
          {genes.map((gene, idx) => {
            const gStart = gene.geneStart ?? minCoord;
            const gStop = gene.geneStop ?? maxCoord;
            const x0 = toX(Math.min(gStart, gStop));
            const x1 = toX(Math.max(gStart, gStop));
            const width = Math.max(8, x1 - x0);
            const isReverse = gene.geneStrand === "-";
            const color = getGeneColor(gene, idx);
            const isHovered =
              activeGene?.proteinId === gene.proteinId &&
              activeGene?.geneStart === gene.geneStart;

            const head = Math.min(ARROW_HEAD, width * 0.4);
            const y0 = ARROW_Y;
            const y1 = ARROW_Y + ARROW_H;
            const yMid = ARROW_Y + ARROW_H / 2;

            let pathD = "";
            if (isReverse) {
              pathD = `M ${x0 + head} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0 + head} ${y1} L ${x0} ${yMid} Z`;
            } else {
              pathD = `M ${x0} ${y0} L ${x1 - head} ${y0} L ${x1} ${yMid} L ${x1 - head} ${y1} L ${x0} ${y1} Z`;
            }

            const annotationName = getGeneAnnotationName(gene);
            const arrowLabel = annotationName || "—";
            const tooltipTitle = annotationName
              ? `${annotationName} (${gene.proteinId || ""}) [${gene.geneStart?.toLocaleString("en-US")} – ${gene.geneStop?.toLocaleString("en-US")} bp]`
              : `${gene.proteinId || "Gene"} (${gene.geneStart?.toLocaleString("en-US")} – ${gene.geneStop?.toLocaleString("en-US")} bp)`;

            return (
              <g
                key={`${gene.proteinId || idx}_${gene.geneStart}`}
                className="cursor-pointer"
                onMouseEnter={() => setActiveGene(gene)}
                onMouseLeave={() => setActiveGene(null)}
                onClick={() => toggleGene(gene)}
              >
                <path
                  d={pathD}
                  fill={color}
                  stroke={isHovered ? "#000" : "#ffffff"}
                  strokeWidth={isHovered ? 2 : 1}
                  opacity={isHovered ? 1 : 0.9}
                >
                  <title>{tooltipTitle}</title>
                </path>

                {/* Gene label inside arrow */}
                {width > 24 && (
                  <text
                    x={x0 + width / 2 + (isReverse ? head / 4 : -head / 4)}
                    y={yMid + 3.5}
                    textAnchor="middle"
                    className="text-[8px] font-bold select-none pointer-events-none"
                    style={{ fill: "#ffffff" }}
                  >
                    {arrowLabel.length > Math.floor(width / 7)
                      ? `${arrowLabel.slice(0, Math.max(2, Math.floor(width / 7) - 1))}…`
                      : arrowLabel}
                  </text>
                )}
              </g>
            );
          })}

          {/* Coordinate ticks below arrows with collision avoidance */}
          {coordinateTicks.map((tick, tIdx) => {
            const isHovered =
              activeGene &&
              tick.genes.some(
                (g) =>
                  g.proteinId === activeGene.proteinId &&
                  g.geneStart === activeGene.geneStart
              );
            const anchor =
              tick.x < MARGIN_X + 15
                ? "start"
                : tick.x > SVG_WIDTH - MARGIN_X - 15
                ? "end"
                : "middle";

            if (tick.tier === 0) {
              return (
                <g key={`tick_0_${tIdx}_${tick.label}`}>
                  <line
                    x1={tick.x}
                    y1={ARROW_Y + ARROW_H}
                    x2={tick.x}
                    y2={ARROW_Y + ARROW_H + 4}
                    stroke={isHovered ? COLORS.darkTeal : "#cbd5e1"}
                    strokeWidth={isHovered ? 1.5 : 1}
                  />
                  <text
                    x={tick.x}
                    y={ARROW_Y + ARROW_H + 13}
                    textAnchor={anchor}
                    className={`text-[7px] font-mono select-none ${isHovered ? "font-bold" : ""}`}
                    style={{ fill: isHovered ? COLORS.darkTeal : COLORS.inkSoft }}
                  >
                    {tick.label}
                  </text>
                </g>
              );
            }

            return (
              <g key={`tick_1_${tIdx}_${tick.label}`}>
                <line
                  x1={tick.x}
                  y1={ARROW_Y + ARROW_H}
                  x2={tick.x}
                  y2={ARROW_Y + ARROW_H + 16}
                  stroke={isHovered ? COLORS.darkTeal : "#cbd5e1"}
                  strokeWidth={isHovered ? 1.5 : 1}
                  strokeDasharray={isHovered ? "none" : "2 2"}
                />
                <text
                  x={tick.x}
                  y={ARROW_Y + ARROW_H + 25}
                  textAnchor={anchor}
                  className={`text-[7px] font-mono select-none ${isHovered ? "font-bold" : ""}`}
                  style={{ fill: isHovered ? COLORS.darkTeal : COLORS.inkSoft }}
                >
                  {tick.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Hover detail card */}
      {activeGene && (() => {
        const activeAnnName = getGeneAnnotationName(activeGene);
        const activeTitle = activeAnnName || activeGene.proteinId || "Gene";
        const showProteinSubtitle =
          activeGene.proteinId &&
          activeAnnName &&
          activeGene.proteinId !== activeAnnName;
        const activeType =
          CATEGORY_FULL_NAMES[
            activeGene.cazyCategory || activeGene.category || activeGene.geneType
          ] ||
          activeGene.cazyCategory ||
          activeGene.category ||
          activeGene.geneType ||
          "—";
        const activeSubstrate =
          activeGene.substrate && activeGene.substrate !== "-"
            ? activeGene.substrate
            : "—";
        const activeAnnotation =
          activeGene.geneAnnotation && activeGene.geneAnnotation !== "-"
            ? activeGene.geneAnnotation
            : "—";

        return (
          <div
            className="mt-1.5 p-2.5 rounded-lg border text-xs"
            style={{ backgroundColor: COLORS.paperAlt, borderColor: COLORS.line }}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                  style={{ backgroundColor: getGeneColor(activeGene) }}
                />
                <span
                  className="font-bold"
                  style={{ color: COLORS.ink, fontFamily: FONT_MONO }}
                >
                  {activeTitle}
                </span>
                {showProteinSubtitle && (
                  <span className="text-[10px] font-mono text-slate-400">
                    ({activeGene.proteinId})
                  </span>
                )}
              </div>
              <span
                className="font-mono text-[10px] font-medium"
                style={{ color: COLORS.darkTeal }}
              >
                {activeGene.geneStart?.toLocaleString("en-US")} –{" "}
                {activeGene.geneStop?.toLocaleString("en-US")} bp{" "}
                ({activeGene.geneStrand === "-" ? "Reverse ◀" : "Forward ▶"})
              </span>
            </div>
            <div
              className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1.5 pt-1.5 border-t text-[10px]"
              style={{ borderColor: COLORS.line }}
            >
              <div>
                <span className="text-slate-400 block">Type</span>
                <span className="font-medium" style={{ color: COLORS.ink }}>
                  {activeType}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Substrate</span>
                <span className="font-medium" style={{ color: COLORS.ink }}>
                  {activeSubstrate}
                </span>
              </div>
              <div className="col-span-2 md:col-span-1">
                <span className="text-slate-400 block">Annotation</span>
                <span
                  className="font-mono text-[9.5px] truncate block"
                  title={activeAnnotation}
                  style={{ color: COLORS.ink }}
                >
                  {activeAnnotation}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Gene legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
        {genes.map((g, i) => {
          const color = getGeneColor(g, i);
          const annName = getGeneAnnotationName(g);
          const name = annName || g.proteinId || `Gene ${i + 1}`;
          const cat = g.cazyCategory || g.category || g.geneType;
          return (
            <span
              key={`${g.proteinId || i}_${g.geneStart}`}
              className="inline-flex items-center gap-1 text-[9.5px] cursor-pointer hover:underline"
              onClick={() => toggleGene(g)}
              style={{ color: COLORS.ink }}
            >
              <span
                className="inline-block w-2 h-2 rounded-[2px] shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="font-medium">{name}</span>
              {cat ? (
                cat !== name && (
                  <span className="text-slate-400 font-mono text-[8.5px]">[{cat}]</span>
                )
              ) : (
                <span className="text-slate-400 font-mono text-[8.5px]">[—]</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Stacked gene cluster tracks — all clusters shown vertically, no tabs.
 */
export function GeneClusterTrack({ clusters = [] }) {
  if (!clusters || clusters.length === 0) return null;

  return (
    <div className="rounded-2xl p-5 mt-6" style={CARD_SURFACE}>
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2
          className="text-sm font-semibold"
          style={{ color: COLORS.darkTeal, fontFamily: FONT_BODY }}
        >
          CAZyme Gene Clusters (CGC)
        </h2>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            backgroundColor: COLORS.paperAlt,
            color: COLORS.darkTeal,
            fontFamily: FONT_MONO,
          }}
        >
          {clusters.length} {clusters.length === 1 ? "cluster" : "clusters"}
        </span>
      </div>

      {/* All clusters stacked vertically */}
      {clusters.map((cluster, i) => (
        <SingleCluster
          key={`${cluster.cgcId}_${cluster.contigId}_${i}`}
          cluster={cluster}
          divider={i > 0}
        />
      ))}
    </div>
  );
}

