/**
 * Percentage formatting that keeps small shares meaningful.
 *
 * A fixed single decimal turns genuinely present categories into "0.0%" —
 * feed holds 1,335 of 3.9M plasmid contigs, which is 0.034%, not zero. Below
 * 1% the precision grows until two significant digits survive.
 */
export function formatPercent(fraction) {
  const pct = fraction * 100;
  if (!Number.isFinite(pct) || pct <= 0) return "0%";
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  // toPrecision keeps two significant digits however small the value gets;
  // Number() then drops any trailing zeros it introduced.
  return `${Number(pct.toPrecision(2))}%`;
}

export const formatCount = (n) =>
  typeof n === "number" ? n.toLocaleString("en-US") : String(n ?? "—");
