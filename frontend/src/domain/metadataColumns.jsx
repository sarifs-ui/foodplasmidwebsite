import { categoryColor, categoryLabel } from "./categories.js";
import { formatCount } from "../lib/format.js";

/**
 * Every column the sample table can show.
 *
 * One definition drives the header, the body cell and the export together, so a
 * column cannot be added to one and forgotten in the others — the table body
 * used to be hand-written `<td>`s that could silently drift from the header.
 *
 * Order here is the order on screen. It follows metadata.csv, except that `id`
 * is pinned first because it carries the row's link.
 *
 *   key             field on the row the API returns
 *   sort            key the API accepts for ordering; omit to make it unsortable
 *   exportKey       column name in metadata.csv
 *   defaultVisible  shown when the URL says nothing about columns
 *   locked          cannot be switched off
 *   render          cell contents; the default prints the field, or an em dash
 */

const dash = (value) =>
  value === null || value === undefined || value === "" ? "—" : value;

export const METADATA_COLUMNS = [
  {
    key: "id",
    label: "ID",
    sort: "id",
    exportKey: "run_id",
    mono: true,
    defaultVisible: true,
    locked: true,
  },
  {
    key: "projectId",
    label: "Project ID",
    sort: "projectId",
    exportKey: "project_id",
    mono: true,
    defaultVisible: false,
  },
  {
    key: "biosampleId",
    label: "BioSample",
    sort: "biosampleId",
    exportKey: "biosample_id",
    mono: true,
    defaultVisible: false,
  },
  {
    key: "sampleAcc",
    label: "Sample accession",
    sort: "sampleAcc",
    exportKey: "sample_acc",
    mono: true,
    defaultVisible: false,
  },
  {
    key: "category",
    label: "Category",
    sort: "category",
    exportKey: "category",
    defaultVisible: true,
    render: (row) =>
      row.category ? (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: categoryColor(row.category) }}
          />
          {categoryLabel(row.category)}
        </span>
      ) : (
        "—"
      ),
  },
  {
    key: "type",
    label: "Type",
    sort: "type",
    exportKey: "type",
    muted: true,
    defaultVisible: true,
  },
  {
    key: "subtype",
    label: "Subtype",
    sort: "subtype",
    exportKey: "sub_type",
    muted: true,
    defaultVisible: true,
  },
  {
    key: "fermented",
    label: "Fermented",
    sort: "fermented",
    exportKey: "fermented",
    defaultVisible: false,
    // Three states, not two: null means the source did not say.
    render: (row) =>
      row.fermented === null || row.fermented === undefined
        ? "—"
        : row.fermented
          ? "Fermented"
          : "Non-fermented",
  },
  {
    key: "country",
    label: "Country",
    sort: "country",
    exportKey: "country",
    defaultVisible: true,
    render: (row) => dash(row.countryName || row.country),
  },
  {
    key: "year",
    label: "Year",
    sort: "year",
    exportKey: "year",
    mono: true,
    defaultVisible: true,
  },
  {
    key: "databaseOrigin",
    label: "Source database",
    sort: "databaseOrigin",
    exportKey: "database_origin",
    muted: true,
    defaultVisible: false,
  },
  {
    key: "sizeContigs",
    label: "Plasmid Contigs",
    sort: "contigs",
    exportKey: "plasmid_contig_counts",
    mono: true,
    align: "right",
    defaultVisible: true,
    render: (row) => formatCount(row.sizeContigs),
  },
  {
    key: "classified",
    label: "Classified",
    sort: "classified",
    exportKey: "classified",
    mono: true,
    align: "right",
    defaultVisible: false,
    render: (row) => formatCount(row.classified),
  },
  {
    key: "unclassified",
    label: "Unclassified",
    sort: "unclassified",
    exportKey: "unclassified",
    mono: true,
    align: "right",
    defaultVisible: false,
    render: (row) => formatCount(row.unclassified),
  },
];

export const DEFAULT_VISIBLE_KEYS = METADATA_COLUMNS.filter((c) => c.defaultVisible).map(
  (c) => c.key
);

const LOCKED_KEYS = METADATA_COLUMNS.filter((c) => c.locked).map((c) => c.key);

/** Cell contents for a column that did not define its own renderer. */
export function renderCell(column, row) {
  return column.render ? column.render(row) : dash(row[column.key]);
}

/** Definition order, with the locked columns forced in. */
function normalize(keys) {
  const wanted = new Set(keys);
  for (const key of LOCKED_KEYS) wanted.add(key);
  return METADATA_COLUMNS.filter((c) => wanted.has(c.key)).map((c) => c.key);
}

/**
 * Turn a `?cols=` value into a validated, ordered key list.
 *
 * Unknown keys are dropped rather than rejected, so an old bookmark naming a
 * column that no longer exists still opens — it just falls back to the default
 * set if nothing in it is recognised.
 */
export function parseColumnParam(value) {
  if (!value) return DEFAULT_VISIBLE_KEYS;
  const requested = new Set(String(value).split(",").map((k) => k.trim()));
  const known = METADATA_COLUMNS.filter((c) => requested.has(c.key));
  if (known.length === 0) return DEFAULT_VISIBLE_KEYS;
  return normalize(known.map((c) => c.key));
}

/**
 * The inverse. Returns null for the default set, which is then left out of the
 * URL entirely so an untouched page keeps a clean address.
 */
export function serializeColumns(keys) {
  const ordered = normalize(keys);
  const isDefault =
    ordered.length === DEFAULT_VISIBLE_KEYS.length &&
    ordered.every((k, i) => k === DEFAULT_VISIBLE_KEYS[i]);
  return isDefault ? null : ordered.join(",");
}
