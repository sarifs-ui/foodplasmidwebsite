/**
 * Shared SVG geometry.
 *
 * `polar` used to be defined twice, byte-identical, in two different figures.
 */

/** Polar to cartesian, with 0 degrees pointing up. */
export function polar(cx, cy, radius, angleDeg) {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)];
}

/** Annulus wedge between two radii and two angles. */
export function arcPath(cx, cy, rInner, rOuter, a0, a1) {
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const [x1, y1] = polar(cx, cy, rOuter, a0);
  const [x2, y2] = polar(cx, cy, rOuter, a1);
  const [x3, y3] = polar(cx, cy, rInner, a1);
  const [x4, y4] = polar(cx, cy, rInner, a0);
  return `M ${x1},${y1} A ${rOuter},${rOuter} 0 ${large} 1 ${x2},${y2} L ${x3},${y3} A ${rInner},${rInner} 0 ${large} 0 ${x4},${y4} Z`;
}

/** Chord ribbon: two arcs joined by beziers that pass through the centre. */
export function ribbonPath(cx, cy, radius, a0, a1, b0, b1) {
  const [x1, y1] = polar(cx, cy, radius, a0);
  const [x2, y2] = polar(cx, cy, radius, a1);
  const [x3, y3] = polar(cx, cy, radius, b0);
  const [x4, y4] = polar(cx, cy, radius, b1);
  const largeA = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const largeB = Math.abs(b1 - b0) > 180 ? 1 : 0;
  return (
    `M ${x1},${y1} A ${radius},${radius} 0 ${largeA} 1 ${x2},${y2} ` +
    `C ${cx},${cy} ${cx},${cy} ${x3},${y3} ` +
    `A ${radius},${radius} 0 ${largeB} 1 ${x4},${y4} ` +
    `C ${cx},${cy} ${cx},${cy} ${x1},${y1} Z`
  );
}

/** Dendrogram elbow: arc along the parent radius, then a radial line outward. */
export function elbowPath(cx, cy, rParent, aParent, aChild, rChild) {
  const [ax, ay] = polar(cx, cy, rParent, aParent);
  const [bx, by] = polar(cx, cy, rParent, aChild);
  const [dx, dy] = polar(cx, cy, rChild, aChild);
  const large = Math.abs(aChild - aParent) > 180 ? 1 : 0;
  const sweep = aChild > aParent ? 1 : 0;
  return `M ${ax},${ay} A ${rParent},${rParent} 0 ${large} ${sweep} ${bx},${by} L ${dx},${dy}`;
}

/**
 * Lay out a bipartite chord diagram: sources on the left arc, targets on the
 * right.
 *
 * Values are compressed with a 0.4 power before sizing the blocks. Without it
 * the largest category would occupy nearly the whole ring and the small ones
 * would be invisible slivers; the exponent trades exact proportionality for
 * readability, which is why the figure reports its numbers in the tooltip.
 */
export function buildChordLayout(sources, targets, { gapDeg = 3, exponent = 0.4 } = {}) {
  const SOURCE_START = 90;
  const SOURCE_END = 270;
  const TARGET_START = -80;
  const TARGET_END = 80;

  const matrix = sources.map((source) =>
    targets.map((target) => {
      const value = source.values[target.key] || 0;
      return value > 0 ? Math.pow(value, exponent) : 0;
    })
  );

  const sourceTotals = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const sourceSum = sourceTotals.reduce((a, b) => a + b, 0) || 1;
  const sourceSpan = SOURCE_END - SOURCE_START - gapDeg * Math.max(0, sources.length - 1);

  let cursor = SOURCE_START;
  const sourceBlocks = sources.map((source, i) => {
    const span = (sourceTotals[i] / sourceSum) * sourceSpan;
    const block = { ...source, a0: cursor, a1: cursor + span, total: sourceTotals[i] || 1 };
    cursor += span + gapDeg;
    return block;
  });

  const targetTotals = targets.map((_, j) => matrix.reduce((sum, row) => sum + row[j], 0));
  const targetSum = targetTotals.reduce((a, b) => a + b, 0) || 1;
  const targetSpan = TARGET_END - TARGET_START - gapDeg * Math.max(0, targets.length - 1);

  cursor = TARGET_START;
  const targetBlocks = targets.map((target, j) => {
    const span = (targetTotals[j] / targetSum) * targetSpan;
    const block = { ...target, a0: cursor, a1: cursor + span, total: targetTotals[j] || 1 };
    cursor += span + gapDeg;
    return block;
  });

  // Target endpoints are consumed from the far end inward, which keeps ribbons
  // from crossing each other inside the circle.
  const targetCursor = targetBlocks.map((block) => block.a1);
  const ribbons = [];

  sourceBlocks.forEach((source, i) => {
    let angle = source.a0;
    targets.forEach((target, j) => {
      const weight = matrix[i][j];
      if (weight <= 0) return;

      const srcSpan = (weight / source.total) * (source.a1 - source.a0);
      const tgtSpan = (weight / targetBlocks[j].total) * (targetBlocks[j].a1 - targetBlocks[j].a0);
      targetCursor[j] -= tgtSpan;

      ribbons.push({
        sourceKey: source.key,
        targetKey: target.key,
        value: source.values[target.key] || 0,
        color: target.color,
        srcA0: angle,
        srcA1: angle + srcSpan,
        tgtA0: targetCursor[j],
        tgtA1: targetCursor[j] + tgtSpan,
      });

      angle += srcSpan;
    });
  });

  return { sourceBlocks, targetBlocks, ribbons };
}
