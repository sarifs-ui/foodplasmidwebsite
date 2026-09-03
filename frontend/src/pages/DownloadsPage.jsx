import { useState } from "react";
import { ExternalLink } from "lucide-react";

import { useApi } from "../api/useApi.js";
import { ErrorBlock, LoadingBlock, SectionTitle, SegmentedControl } from "../components/ui/index.jsx";
import { categoryColor, categoryLabel } from "../domain/categories.js";
import { CARD_SURFACE, COLORS, FONT_BODY, FONT_MONO } from "../theme/tokens.js";

const GROUPING_OPTIONS = [
  { value: "category", label: "By food category" },
  { value: "country", label: "By country" },
];

/** Registry of externally hosted raw-contig archives. */
export function DownloadsPage() {
  const { data, error, loading } = useApi("/api/raw-data/links");
  const { data: mapData } = useApi("/api/stats/map");
  const [grouping, setGrouping] = useState("category");

  const countryNames = new Map((mapData || []).map((row) => [row.code, row.label]));

  const entries = data
    ? Object.entries(grouping === "category" ? data.byCategory : data.byCountry)
    : [];

  return (
    <div style={{ backgroundColor: COLORS.paper }} className="min-h-[60vh]">
      <section className="max-w-4xl mx-auto px-6 py-12">
        <SectionTitle
          eyebrow="Download Data"
          title="Raw plasmid contig archives"
          subtitle="Archives of plasmid contigs grouped by food category or country of origin. For per-sample metadata and annotation tables, use the export buttons on the Data Access page instead."
        />

        <div className="mt-8 mb-6">
          <SegmentedControl
            options={GROUPING_OPTIONS}
            value={grouping}
            onChange={setGrouping}
            label="Group archives by"
          />
        </div>

        {error ? (
          <ErrorBlock message={error.message} />
        ) : loading ? (
          <LoadingBlock />
        ) : entries.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={CARD_SURFACE}>
            <p className="text-sm" style={{ color: COLORS.inkSoft, fontFamily: FONT_BODY }}>
              No raw-data archives have been published yet.
            </p>
            <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>
              Per-sample metadata and annotation tables are already available from the{" "}
              <a href="/samples" style={{ color: COLORS.orange, fontWeight: 600 }}>
                Data Access
              </a>{" "}
              page.
            </p>
          </div>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-3 list-none p-0 m-0">
            {entries.map(([key, url]) => (
              <li key={key}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-xl p-4 hover:shadow-sm transition-shadow"
                  style={CARD_SURFACE}
                >
                  <span className="flex items-center gap-2 text-sm" style={{ color: COLORS.ink }}>
                    {grouping === "category" && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: categoryColor(key) }}
                      />
                    )}
                    {grouping === "category"
                      ? categoryLabel(key)
                      : countryNames.get(key) || key}
                  </span>
                  <ExternalLink size={14} style={{ color: COLORS.orange }} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs mt-8" style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}>
          Archives open on the hosting repository in a new tab.
        </p>
      </section>
    </div>
  );
}
