import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Download, ExternalLink } from "lucide-react";

import { apiPostDownload } from "../api/client.js";
import { useApi } from "../api/useApi.js";
import { ErrorBlock, InfoRow, LoadingBlock } from "../components/ui/index.jsx";
import { EXPORT_ANNOTATION_KEYS } from "../domain/annotations.js";
import { categoryColor, categoryLabel } from "../domain/categories.js";
import { CARD_SURFACE, COLORS, FONT_BODY, FONT_MONO } from "../theme/tokens.js";

export function SampleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, error, loading } = useApi(`/api/samples/${encodeURIComponent(id)}`);
  const { data: rawLinks } = useApi("/api/raw-data/links");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const runExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await apiPostDownload(
        "/api/downloads/export",
        { runIds: [id], include: { metadata: true, annotations: EXPORT_ANNOTATION_KEYS } },
        `gfpr-${id}.zip`
      );
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const zenodoUrl =
    data && rawLinks
      ? rawLinks.byCategory?.[data.category] || rawLinks.byCountry?.[data.country] || null
      : null;

  return (
    <div style={{ backgroundColor: COLORS.paper }} className="min-h-[60vh]">
      <section className="max-w-4xl mx-auto px-6 py-12">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm font-medium mb-6"
          style={{ color: COLORS.darkTeal }}
        >
          <ChevronLeft size={16} aria-hidden="true" /> Back
        </button>

        {error ? (
          <ErrorBlock message={error.message} />
        ) : loading || !data ? (
          <LoadingBlock />
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1
                className="text-2xl font-bold"
                style={{ color: COLORS.darkTeal, fontFamily: FONT_MONO }}
              >
                {data.id}
              </h1>
              {data.category && (
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs text-white"
                  style={{ backgroundColor: categoryColor(data.category) }}
                >
                  {categoryLabel(data.category)}
                </span>
              )}
              {data.fermented !== null && (
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs"
                  style={{ backgroundColor: COLORS.paperAlt, color: COLORS.inkSoft }}
                >
                  {data.fermented ? "Fermented" : "Non-fermented"}
                </span>
              )}
            </div>
            {data.host && (
              <p className="text-sm italic mb-6" style={{ color: COLORS.inkSoft }}>
                Dominant host: {data.host}
              </p>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div className="rounded-2xl p-5" style={CARD_SURFACE}>
                <h2
                  className="text-sm font-semibold mb-3"
                  style={{ color: COLORS.darkTeal, fontFamily: FONT_BODY }}
                >
                  Sample
                </h2>
                <InfoRow label="Run ID">{data.runId}</InfoRow>
                <InfoRow label="BioSample">{data.biosampleId || "—"}</InfoRow>
                <InfoRow label="Sample accession">{data.sampleAcc || "—"}</InfoRow>
                <InfoRow label="Project">{data.projectId || "—"}</InfoRow>
                <InfoRow label="Source database">{data.databaseOrigin || "—"}</InfoRow>
              </div>

              <div className="rounded-2xl p-5" style={CARD_SURFACE}>
                <h2
                  className="text-sm font-semibold mb-3"
                  style={{ color: COLORS.darkTeal, fontFamily: FONT_BODY }}
                >
                  Origin & contigs
                </h2>
                <InfoRow label="Type">{data.type || "—"}</InfoRow>
                <InfoRow label="Subtype">{data.subtype || "—"}</InfoRow>
                <InfoRow label="Country">{data.countryName || data.country || "—"}</InfoRow>
                <InfoRow label="Year">{data.year || "—"}</InfoRow>
                <InfoRow label="Plasmid contigs">
                  {data.plasmidContigCounts?.toLocaleString("en-US") ?? "—"}
                </InfoRow>
                <InfoRow label="Classified / unclassified">
                  {data.classified?.toLocaleString("en-US")} /{" "}
                  {data.unclassified?.toLocaleString("en-US")}
                </InfoRow>
              </div>
            </div>

            <div className="rounded-2xl p-5 mt-6" style={CARD_SURFACE}>
              <h2
                className="text-sm font-semibold mb-3"
                style={{ color: COLORS.darkTeal, fontFamily: FONT_BODY }}
              >
                Functional annotations
              </h2>
              <ul className="space-y-3 list-none p-0 m-0">
                {data.annotations.map((annotation) => (
                  <li key={annotation.key}>
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: COLORS.ink }}>
                        {annotation.label}
                        {annotation.tool && (
                          <span
                            className="ml-2 text-[11px]"
                            style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}
                          >
                            {annotation.tool}
                          </span>
                        )}
                      </span>
                      <span
                        className="text-xs shrink-0"
                        style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}
                      >
                        {annotation.available || annotation.count
                          ? `${annotation.count.toLocaleString("en-US")} hits`
                          : annotation.note || "not available"}
                      </span>
                    </div>
                    {annotation.hits.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {annotation.hits.slice(0, 24).map((hit) => (
                          <span
                            key={hit}
                            className="px-1.5 py-0.5 rounded text-[10px]"
                            style={{
                              backgroundColor: COLORS.paperAlt,
                              color: COLORS.inkSoft,
                              fontFamily: FONT_MONO,
                            }}
                          >
                            {hit}
                          </span>
                        ))}
                        {annotation.hits.length > 24 && (
                          <span className="text-[10px]" style={{ color: COLORS.inkSoft }}>
                            +{annotation.hits.length - 24} more
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {exportError && <ErrorBlock message={exportError} />}

            <div className="flex flex-wrap gap-3 mt-6">
              <button
                type="button"
                onClick={runExport}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white disabled:opacity-60"
                style={{ backgroundColor: COLORS.orange }}
              >
                <Download size={13} aria-hidden="true" />
                {exporting ? "Preparing…" : "Download this sample"}
              </button>

              {zenodoUrl ? (
                <a
                  href={zenodoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
                  style={{ backgroundColor: COLORS.lightTeal, color: COLORS.darkTeal }}
                >
                  Raw contig archive <ExternalLink size={12} aria-hidden="true" />
                </a>
              ) : (
                <span
                  className="inline-flex items-center text-xs px-3 py-2"
                  style={{ color: COLORS.inkSoft }}
                >
                  No public raw-contig archive is registered for this group yet.
                </span>
              )}

              <Link
                to={`/samples?category=${encodeURIComponent(data.category || "")}`}
                className="inline-flex items-center text-xs font-semibold px-3 py-2"
                style={{ color: COLORS.darkTeal }}
              >
                Browse other {categoryLabel(data.category)} samples
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
