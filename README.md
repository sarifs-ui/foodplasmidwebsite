# GFPR — Global Food Plasmidome Resource

An open, browsable catalogue of plasmids mined from food-derived metagenomic
samples — antimicrobial resistance genes, carbohydrate-active enzymes,
CRISPR-Cas systems and other functional annotations, searchable by food
category, country and host organism.

## Quick start

You need **Node.js 18+** ([nodejs.org](https://nodejs.org/)) and nothing else —
no Python, no database server, no API keys.

```bash
git clone https://github.com/sarifs-ui/foodplasmidwebsite.git
cd foodplasmidwebsite
npm install
npm start
```

Then open **<http://localhost:4000>**.

That is the whole setup. `npm install` imports the bundled sample table, so a
fresh clone renders **every figure and every page with real data** — no extra
downloads.

## How it runs

Everything is served from a **single port**. The Express backend serves both the
JSON API and the built React frontend:

```
http://localhost:4000
  ├── /api/*   → JSON API (Express)
  └── /*       → React app (frontend/dist)
```

Because both come from the same origin, the frontend calls the API with plain
relative paths (`/api/samples`) — there is no host or port to configure.

## Data

The dataset splits into three tiers by size. This is what makes a bare clone
work without a multi-hundred-megabyte download.

| Tier | Contents | Size | In the repo? |
|---|---|---|---|
| **A** — source tables | `metadata.csv`, `chord.csv`, `amr-rgi-consensus.csv`, `cazyme.csv`, `amp_all.csv`, `cctyper.csv`, `acp_all.csv` | ~12 MB | **yes** |
| **B** — derived artifact | `gfpr.derived.json` — taxonomy tree, host per run, top Pfam/KO terms | ~410 KB | **yes** |
| **C** — heavy sources | `family_assigned.csv` (69 MB), `merged_pfam_kofam.csv` (319 MB) | ~390 MB | no |

**`metadata.csv` is the master table.** Its `Run_ID` column is the primary key
for the whole project: every annotation file joins on it at 100% coverage. Note
that the file ends with a `Total` summary row, which the importer drops — if a
headline number ever looks exactly doubled, that row got through.

**`chord.csv` is an external input, not a derivative.** It is the published
category × feature-class matrix and cannot be recomputed from the other files;
three of its six classes (heat resistance, heavy-metal resistance, virulence)
have no per-gene source at all.

### Without Tier C

Tier C only adds **gene-level hit lists** on the sample detail page and the
`pfam_ko` / `host_taxonomy` tables in exports. Everything else — all five
figures, the taxonomy tree, host labels, per-sample Pfam/KO *counts*, filters,
and metadata export — works from Tiers A and B alone.

To load Tier C, place the two files in `backend/data/` and run:

```bash
npm run import-annotations   # builds backend/data/gfpr.db (~500 MB, ~40 s)
npm run build-derived        # regenerates gfpr.derived.json from them
```

`build-derived` refuses to run without both heavy files, so a contributor who
lacks them cannot accidentally commit a blanked artifact.

## Commands

Run these from the repository root.

| Command | What it does |
|---|---|
| `npm install` | Installs both workspaces and imports the sample table |
| `npm start` | Builds the frontend, then serves everything on port 4000 |
| `npm run dev` | Development mode with hot reload (API on 4000, Vite on 5173) |
| `npm run build` | Builds the frontend into `frontend/dist/` |
| `npm run serve` | Serves without rebuilding |
| `npm run lint` | Lints the frontend with oxlint |
| `npm run import-data` | Re-imports the sample table from `metadata.csv` |
| `npm run import-annotations` | Imports the gene-level annotation database (needs Tier C) |
| `npm run build-derived` | Regenerates `gfpr.derived.json` (needs Tier C) |

## API

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/health` | Status, sample count, which tiers are loaded |
| `GET` | `/api/stats/overview` | Headline counters |
| `GET` | `/api/stats/category-share` | Samples per food category |
| `GET` | `/api/stats/contig-share` | Plasmid contigs per food category |
| `GET` | `/api/stats/annotation-flow` | Category × feature-class matrix (chord) |
| `GET` | `/api/stats/taxonomy` | Phylum→family tree with category composition |
| `GET` | `/api/stats/map` | Per-country counts, with ISO alpha-3 and numeric codes |
| `GET` | `/api/samples` | Paged, filterable sample list |
| `GET` | `/api/samples/filters` | Distinct values for each filter |
| `GET` | `/api/samples/:id` | One sample plus its annotations |
| `POST` | `/api/downloads/export` | Streams a zip of metadata + annotation CSVs |
| `GET` | `/api/raw-data/links` | Registry of external raw-contig archives |
| `POST` | `/api/contact` | Contact form (logs to the server; no mail transport) |

## Docker

Everything ships as **one image**, serving the API and the built UI from a
single port.

```bash
docker build -t gfpr .
docker run --rm -p 4000:4000 gfpr
```

Open <http://localhost:4000>. The image bakes in Tiers A and B, so it runs
standalone with real data. To add Tier C, mount the database:

```bash
docker run --rm -p 4000:4000 \
  -v "$PWD/backend/data/gfpr.db:/app/backend/data/gfpr.db:ro" \
  gfpr
```

Change the port with `-e PORT=8080 -p 8080:8080`.

## Project structure

```
.
├── package.json              # workspace root — every command lives here
├── Dockerfile                # single image: API + built frontend
├── backend/
│   ├── data/                 # source CSVs (tiers A/B committed, C ignored)
│   └── src/
│       ├── config/           # paths, env, country table, annotation registry
│       ├── data/             # cached loaders: samples, derived, SQLite
│       ├── ingest/           # importers
│       │   ├── lib/          # CSV reader, coercion, bulk load, dataset specs
│       │   └── sources/      # one module per source file
│       ├── api/              # routes, controllers, services
│       └── utils/            # CSV writer
└── frontend/
    ├── src/
    │   ├── api/              # fetch client + useApi hook
    │   ├── theme/            # design tokens, global styles
    │   ├── domain/           # categories, annotations, navigation
    │   ├── lib/              # SVG geometry
    │   ├── components/       # ui/ atoms, figures/ charts
    │   └── pages/            # one module per route
    └── vite.config.js        # dev proxy for /api
```

## Configuration

Every setting has a working default, so **no `.env` file is required**. To
override something, copy `backend/.env.example` to `backend/.env`; the most
useful knob is `PORT`.

The frontend understands `VITE_API_BASE`, empty by default (same origin). Set it
only if the UI should talk to a backend on another host.
