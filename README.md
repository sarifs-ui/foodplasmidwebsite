# GFPR — Global Food Plasmidome Resource

An open, browsable catalogue of plasmids recovered from food-associated
metagenomes: antimicrobial resistance genes, carbohydrate-active enzymes,
CRISPR-Cas systems and other functional annotations, searchable by food
category, country and host organism.

The repository ships with the full dataset, so both setups below give you a
working site with real data — no downloads, no database server, no API keys.

---

## Run with Docker

```bash
git clone https://github.com/sarifs-ui/foodplasmidwebsite.git
cd foodplasmidwebsite
docker compose up --build
```

Open **<http://localhost:4000>**.

To use a different port: `PORT=8080 docker compose up --build`.
Stop with `Ctrl+C`, or `docker compose down`.

## Run without Docker

Requires **Node.js 18+** ([nodejs.org](https://nodejs.org/)).

```bash
git clone https://github.com/sarifs-ui/foodplasmidwebsite.git
cd foodplasmidwebsite
npm install
npm start
```

Open **<http://localhost:4000>**.

For development with hot reload — API on 4000, UI on 5173:

```bash
npm run dev
```

---

## How it works

The Express backend serves the JSON API and the built React frontend from a
single port:

```
http://localhost:4000
  ├── /api/*   → JSON API
  └── /*       → React app
```

`npm install` (and the Docker build) imports the bundled tables automatically —
the sample table plus the five annotation tables — which is why the site has
data on first launch.

## Commands

| Command | What it does |
|---|---|
| `npm start` | Build the frontend, then serve everything on port 4000 |
| `npm run dev` | Development mode with hot reload |
| `npm run build` | Build the frontend into `frontend/dist/` |
| `npm run lint` | Lint the frontend |
| `npm run import-data` | Re-import the sample table |

## Data

`backend/data/` holds the dataset as zstd-compressed tables:

| File | Contents |
|---|---|
| `metadata.csv.zst` | 4,690 samples — the master table |
| `chord.csv.zst` | Category × feature-class matrix |
| `amr-rgi-consensus.csv.zst` | Resistance gene calls |
| `cazyme.csv.zst` | Carbohydrate-active enzymes |
| `amp_all.csv.zst`, `acp_all.csv.zst` | Peptide predictions |
| `cctyper.csv.zst` | CRISPR-Cas systems |
| `gfpr.derived.json.zst` | Precomputed taxonomy tree, top Pfam/KO terms, per-run KO digest |
| `family_assigned.csv.zst` | Contig host taxonomy (69 MB raw) |
| `merged_pfam_kofam.csv.zst` | Pfam/KOfam terms per contig (319 MB raw, 5.5M rows) |

`Run_ID` in `metadata.csv.zst` is the key every other table joins on.

### Why zstd

Every file is read as a stream and decompressed in flight — nothing is ever
expanded onto disk. Measured on `merged_pfam_kofam.csv`, zstd -19 stores it in
0.093 of its raw size against gzip's 0.172, while decompressing *faster* than
gzip; brotli-11 matches the ratio but reads more slowly, and xz -9e is 6%
smaller for roughly 4× the decompression cost plus a native dependency. zstd
is built into Node 22, so there is nothing to install.

`.gz`, `.br` and plain files are still recognised — a plain `.csv` wins over
every compressed form, so you can drop an uncompressed file in without
renaming anything.

### The two heavy tables

`family_assigned.csv` and `merged_pfam_kofam.csv` are shipped compressed
(~33 MB together) but are **not** imported into SQLite by default: as tables
they cost about 520 MB, which would more than double the Docker image.

Instead the sample page reads its Pfam/KO term lists from the digest in
`gfpr.derived.json.zst`, and their exports stream straight out of the `.zst`
files. Those exports carry the source files' own column names (`RunID`,
`Contig`, …), which `MANIFEST.txt` notes.

To import them into the database anyway — which makes exports use the database
and its column names — run:

```bash
npm run import-annotations   # builds backend/data/gfpr.db (~500 MB)
npm run build-derived        # regenerates gfpr.derived.json.zst
```

The container does not need this; `docker-compose.yml` still has a commented
`volumes:` block if you want to mount a full database into it.

## Configuration

No configuration is required. To change something, copy
`backend/.env.example` to `backend/.env`; the usual knob is `PORT`.

## Project structure

```
backend/
  data/                  zstd-compressed source tables
  src/
    config/              paths, country table, annotation registry
    data/                cached loaders
    ingest/              importers
    api/                 routes, controllers, services
frontend/
  src/
    api/                 fetch client + hooks
    theme/               design tokens
    domain/              categories, annotations, navigation
    components/          ui atoms + figures
    pages/               one module per route
```
