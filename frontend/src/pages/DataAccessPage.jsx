import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronUp, Download, Search, X } from "lucide-react";

import { apiPostDownload } from "../api/client.js";
import { useApi, useDebounced } from "../api/useApi.js";
import { ColumnPicker } from "../components/ui/ColumnPicker.jsx";
import { FilterChip } from "../components/ui/FilterChip.jsx";
import { ErrorBlock, LoadingBlock, SectionTitle } from "../components/ui/index.jsx";
import {
  EXPORT_ANNOTATION_KEYS,
  annotationLabel,
} from "../domain/annotations.js";
import { categoryColor, categoryLabel } from "../domain/categories.js";
import {
  DEFAULT_VISIBLE_KEYS,
  METADATA_COLUMNS,
  parseColumnParam,
  renderCell,
  serializeColumns,
} from "../domain/metadataColumns.jsx";
import { formatCount } from "../lib/format.js";
import { COLORS, FONT_BODY, FONT_MONO } from "../theme/tokens.js";

const PAGE_SIZE = 25;

/** Filters that hold a list of values, all driven from the URL query string. */
const MULTI_FILTERS = [
  { param: "category", label: "Category", optionsKey: "categories" },
  { param: "type", label: "Type", optionsKey: "types" },
  { param: "subtype", label: "Subtype", optionsKey: "subtypes" },
  { param: "country", label: "Country", optionsKey: "countries" },
  { param: "year", label: "Year", optionsKey: "years" },
];

const FERMENT_OPTIONS = [
  { value: "", label: "All" },
  { value: "true", label: "Fermented" },
  { value: "false", label: "Non-Fermented" },
];

/**
 * Sample browser.
 *
 * All filter state lives in the URL, so a filtered view is linkable, survives a
 * reload, and the browser Back button steps through filter changes instead of
 * leaving the site.
 */
export function DataAccessPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState([]);
  // Which export is in flight, so only the button that was pressed shows the
  // progress readout — `null` when none is.
  const [exportingKey, setExportingKey] = useState(null);
  const [exportPercent, setExportPercent] = useState(0);
  const [exportError, setExportError] = useState(null);

  // The search box is local state so typing stays responsive; the URL and the
  // request follow once the user pauses.
  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  const debouncedSearch = useDebounced(searchInput, 300);

  const page = Math.max(1, Number.parseInt(searchParams.get("page"), 10) || 1);

  useEffect(() => {
    const current = searchParams.get("q") || "";
    if (debouncedSearch === current) return;
    const next = new URLSearchParams(searchParams);
    if (debouncedSearch) next.set("q", debouncedSearch);
    else next.delete("q");
    next.delete("page");
    setSearchParams(next, { replace: true, preventScrollReset: true });
    // searchParams is intentionally read, not depended on, to avoid a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const { data: filterOptions } = useApi("/api/samples/filters");

  // One request per query change — the URL is the single source of truth, so
  // there is no second effect resetting the page and triggering a refetch.
  const queryParams = useMemo(() => {
    const params = { page, pageSize: PAGE_SIZE };
    for (const { param } of MULTI_FILTERS) {
      const values = searchParams.getAll(param);
      if (values.length) params[param] = values;
    }
    const fermented = searchParams.get("fermented");
    if (fermented) params.fermented = fermented;
    const q = searchParams.get("q");
    if (q) params.q = q;
    const sort = searchParams.get("sort");
    if (sort) {
      params.sort = sort;
      params.order = searchParams.get("order") === "desc" ? "desc" : "asc";
    }
    return params;
  }, [searchParams, page]);

  const { data, error, loading } = useApi("/api/samples", queryParams);

  const updateParams = useCallback(
    (mutate) => {
      const next = new URLSearchParams(searchParams);
      mutate(next);
      next.delete("page");
      setSearchParams(next, { preventScrollReset: true });
    },
    [searchParams, setSearchParams]
  );

  const toggleFilter = useCallback(
    (param, value) => {
      updateParams((next) => {
        const values = next.getAll(param);
        next.delete(param);
        const remaining = values.includes(value)
          ? values.filter((v) => v !== value)
          : [...values, value];
        for (const v of remaining) next.append(param, v);
      });
    },
    [updateParams]
  );

  const sortKey = searchParams.get("sort");
  const sortOrder = searchParams.get("order") === "desc" ? "desc" : "asc";

  /** Click a header to sort by it; click again to flip, a third time to clear. */
  const toggleSort = useCallback(
    (key) => {
      const next = new URLSearchParams(searchParams);
      if (sortKey !== key) {
        next.set("sort", key);
        next.set("order", "asc");
      } else if (sortOrder === "asc") {
        next.set("order", "desc");
      } else {
        next.delete("sort");
        next.delete("order");
      }
      next.delete("page");
      setSearchParams(next, { preventScrollReset: true });
    },
    [searchParams, setSearchParams, sortKey, sortOrder]
  );

  // Column choice rides in the URL like every other bit of view state, so a
  // link carries the columns it was shared with.
  const visibleKeys = useMemo(
    () => parseColumnParam(searchParams.get("cols")),
    [searchParams]
  );
  const visibleColumns = useMemo(
    () => METADATA_COLUMNS.filter((c) => visibleKeys.includes(c.key)),
    [visibleKeys]
  );

  /**
   * Unlike a filter change this must NOT reset the page: showing one more
   * column does not change which rows match, so the reader stays where they
   * were.
   */
  const applyColumns = useCallback(
    (keys) => {
      const next = new URLSearchParams(searchParams);
      const value = serializeColumns(keys);
      if (value) next.set("cols", value);
      else next.delete("cols");
      setSearchParams(next, { preventScrollReset: true });
    },
    [searchParams, setSearchParams]
  );

  const clearAll = useCallback(() => {
    setSearchInput("");
    // The column choice is not a filter — clearing the query should not also
    // take away the columns the reader picked.
    const next = new URLSearchParams();
    const cols = searchParams.get("cols");
    if (cols) next.set("cols", cols);
    setSearchParams(next, { preventScrollReset: true });
  }, [searchParams, setSearchParams]);

  const activeFilterCount = MULTI_FILTERS.reduce(
    (sum, { param }) => sum + searchParams.getAll(param).length,
    0
  );
  const hasActiveQuery =
    activeFilterCount > 0 || Boolean(searchParams.get("fermented")) || Boolean(searchInput);

  // Set by the chord diagram's "Open <table> records" link. It focuses the
  // export controls on one annotation table rather than filtering the rows,
  // which is what the catalogue is indexed by.
  const focusedAnnotation = EXPORT_ANNOTATION_KEYS.includes(searchParams.get("annotation"))
    ? searchParams.get("annotation")
    : null;

  const results = data?.results ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const allOnPageSelected =
    results.length > 0 && results.every((r) => selectedIds.includes(r.id));

  // The export mirrors the table: whatever is on screen is what lands in the CSV.
  const exportColumns = visibleColumns.map((c) => c.exportKey);

  const runExport = async (annotations, key) => {
    setExportingKey(key);
    setExportPercent(0);
    setExportError(null);
    // Chunks arrive every few dozen kB; re-rendering the table that often
    // would cost more than the download does, so only whole percents are
    // pushed into state.
    let shown = 0;
    const report = (received, total) => {
      if (!total) return;
      // The total is an estimate, so the last percent is held back until the
      // stream actually ends rather than sitting at 100% or overshooting it.
      const percent = Math.min(99, Math.floor((received / total) * 100));
      if (percent <= shown) return;
      shown = percent;
      setExportPercent(percent);
    };
    try {
      await apiPostDownload(
        "/api/downloads/export",
        {
          runIds: selectedIds,
          include: { metadata: true, metadataColumns: exportColumns, annotations },
        },
        "gfpr-export.zip",
        { onProgress: report }
      );
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExportingKey(null);
    }
  };

  const exporting = exportingKey !== null;
  /** Label for a button while its own export runs. */
  const progressLabel = (key) =>
    exportingKey === key ? (exportPercent > 0 ? `${exportPercent}%` : "Preparing…") : null;

  const goToPage = (nextPage) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next, { preventScrollReset: true });
  };

  return (
    <div style={{ backgroundColor: COLORS.paper }}>
      <section className="max-w-6xl mx-auto px-6 py-12">
        <SectionTitle
          eyebrow="Data Access"
          title="Browse the sample catalogue"
          subtitle="Filter by category, type, subtype, fermentation status, country and year, and choose which metadata columns to show. Select rows to export just those samples, or export the whole catalogue."
        />

        {filterOptions && (
          <div className="flex flex-wrap items-center gap-2 mt-8">
            {MULTI_FILTERS.map(({ param, label, optionsKey }) => (
              <FilterChip
                key={param}
                label={label}
                options={(filterOptions[optionsKey] || []).map((value) => ({
                  value: String(value),
                  label: param === "category" ? categoryLabel(value) : String(value),
                  swatch: param === "category" ? categoryColor(value) : undefined,
                }))}
                selected={searchParams.getAll(param)}
                onToggle={(value) => toggleFilter(param, value)}
              />
            ))}

            <div
              className="flex rounded-xl overflow-hidden"
              style={{ border: `1.5px solid ${COLORS.line}` }}
              role="group"
              aria-label="Fermentation status"
            >
              {FERMENT_OPTIONS.map((option) => {
                const active = (searchParams.get("fermented") || "") === option.value;
                return (
                  <button
                    key={option.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      updateParams((next) => {
                        if (option.value) next.set("fermented", option.value);
                        else next.delete("fermented");
                      })
                    }
                    className="px-3 py-2.5 text-xs font-medium whitespace-nowrap"
                    style={{
                      backgroundColor: active ? COLORS.orange : "#fff",
                      color: active ? "#fff" : COLORS.inkSoft,
                      fontFamily: FONT_BODY,
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <ColumnPicker
              columns={METADATA_COLUMNS}
              visible={visibleKeys}
              onApply={applyColumns}
              onReset={() => applyColumns(DEFAULT_VISIBLE_KEYS)}
            />

            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={14}
                aria-hidden="true"
                style={{ position: "absolute", left: 10, top: 12, color: COLORS.inkSoft }}
              />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search ID, category, type, subtype, country…"
                aria-label="Search samples"
                className="w-full text-sm pl-8 pr-3 py-2.5 rounded-xl"
                style={{
                  border: `1.5px solid ${COLORS.line}`,
                  fontFamily: FONT_BODY,
                  backgroundColor: "#fff",
                  color: COLORS.ink,
                }}
              />
            </div>

            {hasActiveQuery && (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2.5 rounded-xl"
                style={{
                  color: COLORS.deepOrange,
                  border: `1.5px solid ${COLORS.deepOrange}40`,
                }}
              >
                <X size={12} aria-hidden="true" /> Clear all filters
                {activeFilterCount > 0 && ` (${activeFilterCount})`}
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-6 mb-3 flex-wrap gap-2">
          <span className="text-sm" style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}>
            {formatCount(total)} results
            {selectedIds.length > 0 && ` · ${selectedIds.length} selected`}
            {sortKey && (
              <>
                {" · sorted by "}
                {METADATA_COLUMNS.find((c) => c.sort === sortKey)?.label}
                {sortOrder === "desc" ? " ↓" : " ↑"}
              </>
            )}
          </span>
          <div className="flex gap-2 items-center">
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-xs"
                style={{ color: COLORS.inkSoft }}
              >
                Clear selection
              </button>
            )}
            <button
              type="button"
              onClick={() => runExport([], "metadata")}
              disabled={exporting}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-60"
              style={{ backgroundColor: COLORS.lightTeal, color: COLORS.darkTeal }}
            >
              <Download size={13} aria-hidden="true" />
              {progressLabel("metadata") ?? "Metadata (CSV)"}
            </button>
            <button
              type="button"
              onClick={() => runExport(EXPORT_ANNOTATION_KEYS, "annotations")}
              disabled={exporting}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white disabled:opacity-60"
              style={{ backgroundColor: COLORS.orange }}
            >
              <Download size={13} aria-hidden="true" />
              {progressLabel("annotations") ?? "Metadata + annotations"}
            </button>
          </div>
        </div>

        {focusedAnnotation && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 mb-3 px-4 py-3 rounded-xl"
            style={{ backgroundColor: COLORS.lightTeal, border: `1px solid ${COLORS.line}` }}
          >
            <span className="text-xs" style={{ color: COLORS.darkTeal }}>
              Focused on{" "}
              <strong>{annotationLabel(focusedAnnotation)}</strong> — export it on its own,
              with the metadata for the same samples.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runExport([focusedAnnotation], "focused")}
                disabled={exporting}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white disabled:opacity-60"
                style={{ backgroundColor: COLORS.darkTeal }}
              >
                <Download size={13} aria-hidden="true" />
                {progressLabel("focused") ??
                  `Metadata + ${annotationLabel(focusedAnnotation)}`}
              </button>
              <button
                type="button"
                onClick={() => updateParams((next) => next.delete("annotation"))}
                aria-label="Clear the focused annotation"
                className="text-xs"
                style={{ color: COLORS.inkSoft }}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {selectedIds.length === 0 && (
          <p className="text-xs mb-1" style={{ color: COLORS.inkSoft }}>
            Nothing selected — an export will include the entire catalogue. With every
            annotation table that is about a 55 MB archive (~340 MB of CSV), and takes
            some seconds to build.
          </p>
        )}
        <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>
          The exported metadata.csv holds the{" "}
          {exportColumns.length === 1 ? "column" : `${exportColumns.length} columns`} shown
          below — use <strong>Columns</strong> to change them.
        </p>
        {exportError && <ErrorBlock message={exportError} />}

        {error ? (
          <ErrorBlock message={error.message} />
        ) : loading && !data ? (
          <LoadingBlock />
        ) : (
          <div
            className="rounded-2xl overflow-x-auto"
            style={{ border: `1px solid ${COLORS.line}` }}
          >
            <table className="w-full text-sm" style={{ fontFamily: FONT_BODY }}>
              <thead>
                <tr style={{ backgroundColor: COLORS.darkTeal }}>
                  <th scope="col" className="w-10 py-2.5">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      aria-label="Select all rows on this page"
                      onChange={() =>
                        setSelectedIds((prev) =>
                          allOnPageSelected
                            ? prev.filter((id) => !results.some((r) => r.id === id))
                            : [...new Set([...prev, ...results.map((r) => r.id)])]
                        )
                      }
                      style={{ accentColor: COLORS.orange }}
                    />
                  </th>
                  {visibleColumns.map((column) => {
                    const isSorted = Boolean(column.sort) && sortKey === column.sort;
                    return (
                      <th
                        key={column.key}
                        scope="col"
                        aria-sort={
                          isSorted
                            ? sortOrder === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        className={`px-3 py-2.5 text-xs font-semibold text-white ${
                          column.align === "right" ? "text-right" : "text-left"
                        }`}
                      >
                        {column.sort ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(column.sort)}
                            title={`Sort by ${column.label}`}
                            className={`inline-flex items-center gap-1 hover:underline ${
                              column.align === "right" ? "flex-row-reverse" : ""
                            }`}
                            style={{ color: "#fff", opacity: isSorted ? 1 : 0.85 }}
                          >
                            {column.label}
                            {isSorted &&
                              (sortOrder === "asc" ? (
                                <ChevronUp size={12} aria-hidden="true" />
                              ) : (
                                <ChevronDown size={12} aria-hidden="true" />
                              ))}
                          </button>
                        ) : (
                          <span style={{ opacity: 0.85 }}>{column.label}</span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {results.map((row, index) => (
                  <tr
                    key={row.id}
                    style={{ backgroundColor: index % 2 ? COLORS.paperAlt : "#fff" }}
                  >
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        aria-label={`Select ${row.id}`}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            prev.includes(row.id)
                              ? prev.filter((id) => id !== row.id)
                              : [...prev, row.id]
                          )
                        }
                        style={{ accentColor: COLORS.orange }}
                      />
                    </td>
                    {visibleColumns.map((column) =>
                      column.key === "id" ? (
                        <td key={column.key} className="px-3 py-2">
                          {/* One focusable control per row, rather than a click
                              handler on every cell. */}
                          <button
                            type="button"
                            onClick={() => navigate(`/samples/${row.id}`)}
                            className="font-medium hover:underline"
                            style={{ color: COLORS.darkTeal, fontFamily: FONT_MONO }}
                          >
                            {row.id}
                          </button>
                        </td>
                      ) : (
                        <td
                          key={column.key}
                          className={`px-3 py-2 ${column.align === "right" ? "text-right" : ""}`}
                          style={{
                            fontFamily: column.mono ? FONT_MONO : undefined,
                            color: column.muted ? COLORS.inkSoft : undefined,
                          }}
                        >
                          {renderCell(column, row)}
                        </td>
                      )
                    )}
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr>
                    <td
                      colSpan={visibleColumns.length + 1}
                      className="px-3 py-10 text-center text-sm"
                      style={{ color: COLORS.inkSoft }}
                    >
                      No samples match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <nav
            className="flex items-center justify-between mt-4"
            aria-label="Pagination"
          >
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-40"
              style={{ backgroundColor: COLORS.paperAlt, color: COLORS.darkTeal }}
            >
              Previous
            </button>
            <span className="text-xs" style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}>
              Page {page} of {totalPages.toLocaleString("en-US")}
            </span>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-40"
              style={{ backgroundColor: COLORS.paperAlt, color: COLORS.darkTeal }}
            >
              Next
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}
