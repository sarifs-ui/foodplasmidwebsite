import { useApi } from "../../api/useApi.js";
import { CARD_SURFACE, COLORS, FONT_MONO } from "../../theme/tokens.js";
import { ErrorBlock, LoadingBlock } from "../ui/index.jsx";

const formatNumber = (n) => (typeof n === "number" ? n.toLocaleString("en-US") : n ?? "—");

/** Headline counters. Every value comes from the API — nothing is hardcoded. */
export function OverviewStats() {
  const { data, error, loading } = useApi("/api/stats/overview");

  if (error) return <ErrorBlock message={error.message} />;
  if (loading || !data) return <LoadingBlock />;

  const tiles = [
    { label: "Total Samples", value: formatNumber(data.totalSamples) },
    { label: "Food Categories", value: formatNumber(data.categories) },
    { label: "Host Families", value: formatNumber(data.hosts) },
    { label: "Countries", value: formatNumber(data.countries) },
    {
      label: "Source Databases",
      // Trim the pipeline suffix ("cFMD-Logan" -> "cFMD") and de-duplicate.
      value: Array.from(new Set((data.databaseOrigins || []).map((o) => o.split("-")[0]))).join(
        " · "
      ),
    },
    { label: "Total Plasmid Contigs", value: formatNumber(data.totalPlasmidContigs) },
  ];

  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-10">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-xl p-4 text-center" style={CARD_SURFACE}>
          <dt
            className="text-[11px] uppercase tracking-wide mb-1"
            style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}
          >
            {tile.label}
          </dt>
          <dd
            className="text-base font-semibold m-0"
            style={{ color: COLORS.darkTeal, fontFamily: FONT_MONO }}
          >
            {tile.value || "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
