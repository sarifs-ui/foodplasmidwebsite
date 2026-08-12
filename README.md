# GFPR — Global Food Plasmidome Resource

An open, browsable catalog of plasmid data mined from food-derived metagenomic
samples — antibiotic-resistance genes, enzymes, and other functional
annotations, searchable by food category, country, host organism, and more.

> **Status:** frontend-only prototype. All data on the site (samples,
> counts, FASTA sequences, annotation hits) is **mock data** for UI/UX
> review. No backend or real database is connected yet.

## What's in this repo

- A single-page React app (`src/App.jsx`) with five views — Home, About
  GFPR, Data Access, Analysis, and Contact — navigated with in-app state
  (no router).
- Built with **React + Vite** and styled with **Tailwind CSS**.
- Icons from `lucide-react` and `react-icons`.
- Images referenced by the app live in `public/images/`.

## Requirements

You only need two things installed:

- **[Node.js](https://nodejs.org/)** — version 18 or newer (LTS recommended).
  Installing Node also installs **npm** automatically.
- A terminal (Terminal on macOS/Linux, PowerShell or Command Prompt on
  Windows).

To check what you already have, open a terminal and run:

```bash
node -v
npm -v
```

If either command fails, install Node.js from the link above and try again.

## Running it locally

1. **Clone the repository**

   ```bash
  git clone https://github.com/sarifs-ui/foodplasmidwebsite.git
  cd foodplasmidwebsite
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

   This reads `package.json` and downloads everything the project needs into
   a local `node_modules/` folder. It can take a minute or two the first
   time — that's normal.

3. **Start the dev server**

   ```bash
   npm run dev
   ```

   The terminal will print a local address, typically:

   ```
   Local:   http://localhost:5173/
   ```

   Open that address in your browser. The site supports hot-reload, so any
   code change shows up instantly without restarting the server.

4. **Stop the server** anytime with `Ctrl + C` in the terminal.

That's it — no environment variables, API keys, or database setup are
required, since the app runs entirely on mock data in the browser.

### Optional: production build

If you want to generate a static, deployable build instead of the dev
server:

```bash
npm run build      # outputs to dist/
npm run preview    # serve that build locally to sanity-check it
```

## Project structure

```
.
├── public/
│   └── images/        # photos used by the masthead and home page cards
├── src/
│   ├── App.jsx         # the entire app — all pages/components live here
│   └── ...              # standard Vite/React entry files (main.jsx, index.css, etc.)
├── package.json
└── README.md
```

## Notes for reviewers

- Nothing here writes to a real backend — filters, downloads, the contact
  form, and the "Analysis" upload are all mocked (you'll see a toast
  notification instead of an actual file download or email send).
- The world map on the **About GFPR** page uses a public-domain basemap
  (Natural Earth data via [Wikimedia
  Commons](https://commons.wikimedia.org/wiki/File:BlankMap-Equirectangular.svg),
  CC0) — no API key or attribution payment needed, it's loaded directly by
  URL.
- If images don't appear, confirm the files referenced in `src/App.jsx`
  (search for `HERO_IMAGE_URL` and `HOME_CARDS`) actually exist under
  `public/images/` with matching filenames — filenames are case-sensitive.

## Troubleshooting

| Problem | Likely fix |
|---|---|
| `npm install` fails | Make sure Node.js is 18+ (`node -v`). Delete `node_modules/` and `package-lock.json`, then retry. |
| Port 5173 is already in use | Vite will automatically try the next free port and print it — just use the URL it shows. |
| Page loads blank / console errors about missing modules | Run `npm install` again — a dependency likely didn't finish installing. |
| Images are broken (broken-image icons) | Check that the exact filenames in `public/images/` match what `src/App.jsx` expects (see above). |

## License / Credits

- App code: add a license here if you'd like this to be reusable (e.g. MIT).
- Sample/masthead photography: supplied by the project team.
- World map basemap: Natural Earth data, via Wikimedia Commons, public
  domain (CC0).