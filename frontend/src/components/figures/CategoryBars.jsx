import { useState } from "react";
import { ArrowRight, BarChart3 } from "lucide-react";

import { useApi } from "../../api/useApi.js";
import { categoryColor, categoryLabel } from "../../domain/categories.js";
import { COLORS, FONT_MONO } from "../../theme/tokens.js";
import { FigureFrame, SegmentedControl } from "../ui/index.jsx";

const SCALE_OPTIONS = [
  { value: "share", label: "Share" },
  { value: "log", label: "Log" },
];

/**
 * Share of the dataset per food category.
 *
 * `metric` selects what is being shared out — samples or plasmid contigs — so
 * the two variants of this figure are one component.
 */
export function CategoryBars({ metric = "samples", onSelectCategory }) {
  const isContigs = metric === "contigs";
  const { data, error, loading } = useApi(
    isContigs ? "/api/stats/contig-share" : "/api/stats/category-share"
  );
  const [selected, setSelected] = useState(null);
  const [scale, setScale] = useState("share");

  return (
    <FigureFrame
      icon={BarChart3}
      title={isContigs ? "Plasmid Contig Share by Category" : "Sample Share by Category"}
      description={
        isContigs
          ? "How the 3.9 million plasmid contigs are distributed across food categories."
          : "How the 4,690 samples are distributed across food categories."
      }
      loading={loading}
      error={error}
    >
      {(isFullscreen) => {
        // Bars are drawn as a share of the whole, not relative to the largest
        // category. Scaling to the maximum made the top category a permanently
        // full bar, which reads as "100%" rather than its actual ~53%.
        const total = data.reduce((sum, d) => sum + d.count, 0) || 1;
        const fractionOf = (d) => {
          const share = d.count / total;
          if (share <= 0) return 0;
          // The log option keeps the long tail legible; it is off by default so
          // the honest proportions are what a reader sees first.
          return scale === "log" ? Math.log1p(d.count) / Math.log1p(total) : share;
        };

        const formatValue = (d) =>
          `${d.value}%  ·  ${d.count.toLocaleString("en-US")}`;

        return (
          <>
            <div className="flex items-center justify-end gap-2 mb-4">
              <SegmentedControl
                options={SCALE_OPTIONS}
                value={scale}
                onChange={setScale}
                label="Bar scale"
              />
            </div>

            <ul className="space-y-1.5 list-none p-0 m-0">
              {data.map((row) => {
                const active = selected === row.key;
                return (
                  <li key={row.key}>
                    <button
                      type="button"
                      onClick={() => setSelected(active ? null : row.key)}
                      aria-pressed={active}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span
                          className="text-xs truncate"
                          style={{
                            color: active ? COLORS.darkTeal : COLORS.inkSoft,
                            fontWeight: active ? 600 : 400,
                          }}
                        >
                          {categoryLabel(row.key)}
                        </span>
                        <span
                          className="text-[11px] shrink-0"
                          style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}
                        >
                          {formatValue(row)}
                        </span>
                      </div>
                      <div
                        className="w-full rounded-full overflow-hidden"
                        style={{
                          height: isFullscreen ? 18 : 12,
                          backgroundColor: COLORS.paperAlt,
                        }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            // A floor of 0.6% keeps the smallest categories from
                            // vanishing entirely without distorting the rest.
                            width: `${Math.max(fractionOf(row) * 100, 0.6)}%`,
                            backgroundColor: categoryColor(row.key),
                            opacity: selected && !active ? 0.35 : 1,
                          }}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            <p className="text-xs mt-3" style={{ color: COLORS.inkSoft }}>
              {scale === "share"
                ? "Bar length is the true share of the total; percentages are printed alongside."
                : "Bar length is log-scaled to bring out the smaller categories; the printed value is the true share."}
            </p>

            {selected && (
              <div
                className="flex items-center justify-between mt-4 pt-3"
                style={{ borderTop: `1px solid ${COLORS.line}` }}
              >
                <span className="text-xs" style={{ color: COLORS.inkSoft }}>
                  Selected:{" "}
                  <strong style={{ color: COLORS.darkTeal }}>{categoryLabel(selected)}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => onSelectCategory?.(selected)}
                  className="inline-flex items-center gap-1 text-xs font-semibold"
                  style={{ color: COLORS.orange }}
                >
                  See {categoryLabel(selected)} samples <ArrowRight size={12} />
                </button>
              </div>
            )}
          </>
        );
      }}
    </FigureFrame>
  );
}
