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

`backend/data/` holds the dataset as gzipped tables (~730 KB in total):

| File | Contents |
|---|---|
| `metadata.csv.gz` | 4,690 samples — the master table |
| `chord.csv.gz` | Category × feature-class matrix |
| `amr-rgi-consensus.csv.gz` | Resistance gene calls |
| `cazyme.csv.gz` | Carbohydrate-active enzymes |
| `amp_all.csv.gz`, `acp_all.csv.gz` | Peptide predictions |
| `cctyper.csv.gz` | CRISPR-Cas systems |
| `gfpr.derived.json.gz` | Precomputed taxonomy tree and top Pfam/KO terms |

`Run_ID` in `metadata.csv.gz` is the key every other table joins on.

### Optional: gene-level annotations

Two source files are too large to distribute here (`family_assigned.csv`,
69 MB; `merged_pfam_kofam.csv`, 319 MB). Without them everything works except
the host-taxonomy rows and the per-sample Pfam/KO term lists. To add them,
place both in `backend/data/` and run:

```bash
npm run import-annotations   # builds backend/data/gfpr.db (~500 MB)
npm run build-derived        # regenerates gfpr.derived.json.gz
```

Then uncomment the `volumes:` block in `docker-compose.yml` to mount the
database into the container.

## Configuration

No configuration is required. To change something, copy
`backend/.env.example` to `backend/.env`; the usual knob is `PORT`.

## Project structure

```
backend/
  data/                  gzipped source tables
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
