// ============================================================================
// GFPR — Global Food Plasmidome Resource
// ============================================================================
// WHAT THIS FILE IS
// Frontend-only prototype for the GFPR (food-derived plasmidome database)
// website. There is no real backend / data-fetching logic yet — this is
// navigation between pages (via React state instead of routing), overall
// visual identity, and interactive UI wired up with mock data. The real
// backend will be connected to these same components later.
//
// REVISION NOTES (this pass)
//   - About GFPR: the intro paragraph block used to be centered
//     (`max-w-3xl mx-auto`, justified text) while the "What is GFPR..."
//     heading above it is left-aligned — that mismatch is what read as
//     "the title is on the left but the text is in the middle." The intro
//     block is now left-aligned to match the heading, and the paper-summary
//     copy itself has been expanded (more of the introduction + dataset
//     numbers from the manuscript) rather than staying at three short
//     paragraphs.
//   - Data Access results table: removed the small colored dot in front of
//     the Category cell on every row — category is already readable as
//     plain text, and the swatch didn't carry extra information there.
//   - Data Access search bar: it previously only matched against ID, type,
//     subtype, and host, so typing a country or category name (e.g.
//     "Türkiye" or "Dairy") returned nothing even though those are visible
//     columns. It now also matches country and category, and the
//     placeholder text reflects that.
//
// PAGE STRUCTURE (top to bottom of the app shell):
//   Masthead   -> Full-width, left-aligned, all-caps title band, over a
//                 real plasmid micrograph in a teal→orange duotone fade.
//   Tab bar    -> Plain text tabs, no icons, sits directly under the
//                 masthead and stays pinned while the page scrolls.
//   Page body  -> One of six views:
//     1) Home         -> Mission line + four large, single-column link
//                         panels (About / Data / Analysis / Contact).
//     2) About GFPR   -> Plain-language paper summary, a full-width overview
//                         stats strip, then four interactive figures: a
//                         RADIAL phylogenetic tree, category share bars, a
//                         circular "Figure A" chord diagram, and a zoomable,
//                         full-width world sample map. Every figure is
//                         clickable — selecting a branch / bar / ribbon /
//                         country surfaces a "See samples" link that jumps
//                         to Data Access pre-filtered accordingly.
//     3) Data Access  -> Category / type / subtype / fermented / country /
//                         date / annotation filters as side-by-side dropdown
//                         chips, a results table, and a per-sample detail page.
//                         Can arrive pre-filtered from an About-page figure.
//     4) Sample detail-> Opened by clicking a row: a FASTA preview, then one
//                         card with General Info (label: value lines) and
//                         Annotation Summary (bold code + hit list) stacked
//                         inside it, and a single Downloads panel with
//                         checkboxes (all checked by default) + one button.
//     5) Analysis     -> FASTA/GFA-style upload dropzone; mock results show
//                         the 10 closest samples plus a predicted origin.
//     6) Contact      -> Contact form (mock submit) + direct team emails.
//
// DESIGN SYSTEM
//   Color  -> Orange carries primary actions and active nav; teal stays for
//             structure and body headings; BERRY breaks up the orange/teal
//             duo across category swatches, chart accents, and section
//             labels. The masthead itself was intentionally pulled back from
//             a flat, saturated orange toward a teal→orange duotone so it
//             reads as calmer and more photographic. The page background is
//             a very faint teal→cream gradient rather than a flat white, so
//             there's never a hard black edge outside the content.
//   Type   -> A single plain system-sans stack (Calibri/Segoe/Arial) for
//             body and display alike. Data labels (accession IDs, table
//             values, the FASTA block) use IBM Plex Mono.
//   Layout -> Masthead, sticky text-only tab bar, then content.
//   Signature -> The circular "Figure A" chord diagram is drawn from the
//             dataset's own shape rather than a stock template chart.
// ============================================================================

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Download,
  UploadCloud,
  Link as LinkIcon,
  Filter,
  Search,
  Globe2,
  GitBranch,
  BarChart3,
  Waves,
  X,
  CheckCircle2,
  FileUp,
  Send,
  ExternalLink,
  Info,
  ChevronDown,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";

// ============================================================================
// 0) API LAYER
// ============================================================================
const API_BASE = import.meta.env?.VITE_API_BASE || "http://localhost:4000";

async function apiGet(path, params) {
  const url = new URL(API_BASE + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, item));
      else url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  return res.json();
}

// ============================================================================
// 1) DESIGN TOKENS
// ============================================================================
const COLORS = {
  darkTeal: "#006060",
  medTeal: "#539E9E",
  lightTeal: "#B8DADA",
  orange: "#EB7F00",
  yellow: "#FFBF3D",
  deepOrange: "#B35900",
  berry: "#7A3B49",
  paper: "#F6FAF9",
  paperAlt: "#EDF5F4",
  paperWarm: "#FDF3E8", // faint warm tint — used only for the page-wide gradient
  ink: "#0C2B2B",
  inkSoft: "#3E5C5C",
  line: "#CFE3E1",
};

const FONT_BODY = "Calibri, 'Segoe UI', Arial, Helvetica, sans-serif";
const FONT_DISPLAY = FONT_BODY;
// IBM Plex Mono (loaded in GlobalStyles below) — used for IDs, table values,
// stats, and the FASTA block.
const FONT_MONO = "'IBM Plex Mono', ui-monospace, 'SF Mono', Consolas, monospace";

// Small shared utility
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// ============================================================================
// 1b) GLOBAL STYLES
// ============================================================================
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

      html, body, #root {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        max-width: none !important;
        min-height: 100% !important;
        text-align: left !important;
        background: linear-gradient(135deg, #F7FBFA 0%, ${COLORS.paperWarm} 100%);
      }

      .no-scrollbar {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .no-scrollbar::-webkit-scrollbar {
        display: none;
      }

      input, textarea, select {
        background-color: #ffffff;
        color: ${COLORS.ink};
        color-scheme: light;
      }
    `}</style>
  );
}

// ============================================================================
// 2) CATEGORIES
// ============================================================================
const CATEGORIES = [
  { key: "alcohol", label: "Alcohol", color: "#5C2439" },
  { key: "dairy", label: "Dairy", color: COLORS.darkTeal },
  { key: "feed", label: "Feed", color: "#5C7A72" },
  { key: "ferm_bev", label: "Fermented Beverages", color: COLORS.berry },
  { key: "ferm_fruit_veg", label: "Fermented Fruits And Vegetables", color: "#7FB8B8" },
  { key: "ferm_grains", label: "Fermented Grains", color: COLORS.medTeal },
  { key: "ferm_legumes", label: "Fermented Legumes", color: COLORS.lightTeal },
  { key: "ferm_meat", label: "Fermented Meat", color: COLORS.deepOrange },
  { key: "ferm_seeds", label: "Fermented Seeds", color: "#CC6E00" },
  { key: "ferm_tubers", label: "Fermented Tubers And Roots", color: COLORS.orange },
  { key: "fruit_veg", label: "Fruits And Vegetables", color: COLORS.yellow },
  { key: "meat", label: "Meat", color: "#FFD37A" },
  { key: "probiotics", label: "Probiotics", color: "#8FA6A0" },
  { key: "seafood", label: "Seafood", color: "#F2954D" },
  { key: "supplement", label: "Supplement", color: "#D9C7A3" },
  { key: "water", label: "Water", color: "#7FA8B0" },
  { key: "other", label: "Other", color: "#4D8080" },
];
const catColor = (key) => CATEGORIES.find((c) => c.key === key)?.color || COLORS.inkSoft;
const catLabel = (key) => CATEGORIES.find((c) => c.key === key)?.label || key;

const FERMENTED_CATEGORIES = new Set([
  "alcohol", "ferm_bev", "ferm_fruit_veg", "ferm_grains", "ferm_legumes",
  "ferm_meat", "ferm_seeds", "ferm_tubers", "probiotics",
]);
const isFermented = (categoryKey) => FERMENTED_CATEGORIES.has(categoryKey);

// ============================================================================
// 3) ANNOTATIONS
// ============================================================================
const ANNOTATIONS = [
  { key: "amr", label: "AMR & Stress Response Genes", tool: "AMRFinderPlus + RGI", short: "AMR" },
  { key: "cazyme", label: "CAZymes", tool: "run_dbCAN", short: "CAZyme" },
  { key: "cgc", label: "Cazyme Gene Cluster", tool: "easy_CGC", short: "CGC" },
  { key: "crispr", label: "CRISPR-Cas Systems", tool: "CRISPRCasTyper", short: "CRISPR-Cas" },
  { key: "amp", label: "Antimicrobial Peptides", tool: "Macrel", short: "AMP" },
  { key: "acp", label: "Anticancer Peptides", tool: "Metapepticon", short: "ACP" },
  { key: "pfam_kegg", label: "Pfam & KEGG KO", tool: "eggNOG-mapper", short: "Pfam/KO" },
];

// ============================================================================
// 4) NAVIGATION
// ============================================================================
const NAV_ITEMS = [
  { key: "home", label: "Home" },
  { key: "about", label: "About GFPR" },
  { key: "data", label: "Data Access" },
  { key: "analysis", label: "Analysis" },
  { key: "contact", label: "Contact" },
];

const HOME_CARDS = [
  {
    key: "about",
    title: "About GFPR",
    teaser: "What this project is and why it exists.",
    desc:
      "Read a plain-language summary of the science, the sampling strategy, and the headline findings, then explore the phylogenetic tree, category breakdown, and global sample map for yourself. Click to explore.",
    image: "/images/card-about-paper.jpg",
  },
  {
    key: "data",
    title: "Data Access",
    teaser: "Filter and download from 4,000+ samples.",
    desc:
      "Filter by category, type, subtype, fermentation status, country, date, or annotation. Download metadata as CSV, or go straight from a chosen annotation to raw DNA output for the records you select. Click to explore.",
    image: "/images/card-data-table.jpg",
  },
  {
    key: "analysis",
    title: "Analysis",
    teaser: "Upload your own data, see the closest matches.",
    desc:
      "Upload a FASTA, GFA, or protein/DNA file of your own and get back the 10 closest matching plasmid IDs in our database, plus a prediction of the likely sample type, host, and origin. Click to explore.",
    image: "/images/card-analysis-lab.jpg",
  },
  {
    key: "contact",
    title: "Contact",
    teaser: "Questions? Reach the team directly.",
    desc:
      "Fill out the form for questions about data, collaboration, or anything technical, or email the team or Arıkan Lab directly. Click to explore.",
    image: "/images/card-contact.jpg",
  },
];

// ============================================================================
// 5) SMALL REUSABLE UI PIECES
// ============================================================================
function Eyebrow({ children, color = COLORS.orange }) {
  return (
    <div
      className="uppercase tracking-widest text-xs font-semibold mb-3"
      style={{ fontFamily: FONT_MONO, color, letterSpacing: "0.18em" }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ eyebrow, eyebrowColor, title, subtitle, align = "left" }) {
  return (
    <div className={align === "center" ? "text-center" : "text-left"}>
      {eyebrow && <Eyebrow color={eyebrowColor || COLORS.orange}>{eyebrow}</Eyebrow>}
      <h2 className="text-3xl md:text-4xl font-semibold mb-3" style={{ fontFamily: FONT_DISPLAY, color: COLORS.darkTeal }}>
        {title}
      </h2>
      {subtitle && (
        <p className="max-w-2xl text-base leading-relaxed" style={{ color: COLORS.inkSoft, margin: align === "center" ? "0 auto" : 0 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function MockNotice({ message, onClose }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg max-w-sm"
      style={{ backgroundColor: COLORS.darkTeal, color: "#fff", fontFamily: FONT_BODY }}
    >
      <Info size={18} style={{ flexShrink: 0, marginTop: 2 }} />
      <div className="text-sm leading-snug">{message}</div>
      <button onClick={onClose} className="ml-1" aria-label="Close">
        <X size={16} />
      </button>
    </div>
  );
}

function LoadingBlock({ label = "Yükleniyor..." }) {
  return (
    <div className="flex items-center justify-center py-10 text-sm" style={{ color: COLORS.inkSoft }}>
      {label}
    </div>
  );
}

function ErrorBlock({ message }) {
  return (
    <div className="flex items-center justify-center py-10 text-sm text-center px-4" style={{ color: COLORS.deepOrange }}>
      Veri alınamadı: {message}. Backend'in (http://localhost:4000) çalıştığından emin ol.
    </div>
  );
}

// ============================================================================
// 6) MASTHEAD
// ============================================================================
const HERO_IMAGE_URL =
  "/images/bacterial-plasmids-coloured-transmission-electron-micrograph-tem-of-two-circles-or-plasmids-of-dna-from-bacteria-a-plasmid-is-a-length-of-dna-t-2ADG4FH.jpg";

function Masthead() {
  return (
    <div className="relative overflow-hidden w-full" style={{ backgroundColor: COLORS.darkTeal }}>
      <img
        src={HERO_IMAGE_URL}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: "70% 50%" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, ${COLORS.darkTeal}F5 0%, ${COLORS.darkTeal}DB 30%, ${COLORS.deepOrange}66 58%, transparent 92%)`,
        }}
      />
      <div className="relative z-10 w-full px-6 md:px-12 pt-16 pb-14 md:pt-20 md:pb-16 text-left">
        <h1 className="uppercase text-5xl md:text-7xl font-extrabold leading-[1.02] tracking-tight" style={{ fontFamily: FONT_DISPLAY, color: "#fff" }}>
          Global Food<br />Plasmidome Resource
        </h1>
        <p className="mt-4 text-sm md:text-base tracking-wide" style={{ color: COLORS.paper, fontFamily: FONT_BODY }}>
          Open Food-Derived Plasmidome Database
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// 7) TAB BAR
// ============================================================================
function TabBar({ page, setPage }) {
  return (
    <header className="sticky top-0 z-40 w-full" style={{ backgroundColor: "#fff", borderBottom: `1px solid ${COLORS.line}` }}>
      <nav className="no-scrollbar max-w-6xl mx-auto flex items-center justify-center gap-1 px-6 py-3 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const active = page === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setPage(item.key)}
              className="relative px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors"
              style={{ color: active ? COLORS.orange : COLORS.inkSoft, fontFamily: FONT_BODY }}
            >
              {item.label}
              {active && <span className="absolute left-3 right-3 -bottom-[13px] h-[3px] rounded-full" style={{ backgroundColor: COLORS.orange }} />}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

// ============================================================================
// 8) HOME PAGE
// ============================================================================
function HomePage({ setPage }) {
  const [hoveredKey, setHoveredKey] = useState(null);

  return (
    <div style={{ backgroundColor: COLORS.paper }}>
      <section className="max-w-3xl mx-auto px-6 pt-14 pb-8 text-center">
        <p className="text-base md:text-lg leading-relaxed" style={{ color: COLORS.inkSoft, fontFamily: FONT_BODY }}>
          GFPR is an open database mapping antibiotic-resistance, enzyme, and defense genes carried by plasmids
          across more than 4,000 food-derived metagenomic samples collected from around the world.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="flex flex-col gap-5">
          {HOME_CARDS.map((card, i) => {
            const isHovered = hoveredKey === card.key;
            const gradientPairs = [
              [COLORS.deepOrange, COLORS.orange],
              [COLORS.darkTeal, COLORS.medTeal],
              [COLORS.berry, COLORS.deepOrange],
              [COLORS.orange, COLORS.berry],
            ];
            const [g1, g2] = gradientPairs[i % gradientPairs.length];
            return (
              <button
                key={card.key}
                onClick={() => setPage(card.key)}
                onMouseEnter={() => setHoveredKey(card.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onFocus={() => setHoveredKey(card.key)}
                onBlur={() => setHoveredKey(null)}
                className="relative overflow-hidden rounded-2xl text-left w-full h-40 md:h-48 group"
                style={{ backgroundColor: COLORS.paperAlt, border: `1px solid ${COLORS.line}` }}
              >
                <img src={card.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(90deg, ${COLORS.paperAlt}F5 0%, ${COLORS.paperAlt}D9 38%, transparent 88%)` }}
                />
                <div className="relative z-10 h-full flex flex-col justify-center p-8">
                  <h3 className="text-2xl md:text-3xl font-semibold mb-1" style={{ fontFamily: FONT_DISPLAY, color: COLORS.darkTeal }}>
                    {card.title}
                  </h3>
                  <p className="text-sm md:text-base" style={{ color: COLORS.inkSoft }}>{card.teaser}</p>
                </div>
                <div
                  className="absolute inset-0 z-20 flex items-center p-8 transition-all duration-300 ease-out"
                  style={{
                    backgroundImage: `linear-gradient(120deg, ${g1}, ${g2})`,
                    opacity: isHovered ? 1 : 0,
                    transform: isHovered ? "translateY(0)" : "translateY(8px)",
                    pointerEvents: "none",
                  }}
                >
                  <p className="text-white text-base md:text-lg leading-relaxed font-medium max-w-xl" style={{ fontFamily: FONT_BODY }}>
                    {card.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 9) ABOUT GFPR PAGE
// ============================================================================
const PHYLA = [
  { id: "p1", label: "Proteobacteria", color: COLORS.darkTeal },
  { id: "p2", label: "Firmicutes", color: COLORS.orange },
  { id: "p3", label: "Bacteroidota", color: COLORS.medTeal },
  { id: "p4", label: "Actinobacteriota", color: COLORS.berry },
];
const CLADO_NODES = [
  { id: "p1", level: 0, label: "Proteobacteria", phylumId: "p1" },
  { id: "p2", level: 0, label: "Firmicutes", phylumId: "p2" },
  { id: "p3", level: 0, label: "Bacteroidota", phylumId: "p3" },
  { id: "p4", level: 0, label: "Actinobacteriota", phylumId: "p4" },
  { id: "c1", level: 1, label: "Gammaproteobacteria", parent: "p1", phylumId: "p1" },
  { id: "c2", level: 1, label: "Alphaproteobacteria", parent: "p1", phylumId: "p1" },
  { id: "c3", level: 1, label: "Bacilli", parent: "p2", phylumId: "p2" },
  { id: "c4", level: 1, label: "Clostridia", parent: "p2", phylumId: "p2" },
  { id: "c5", level: 1, label: "Bacteroidia", parent: "p3", phylumId: "p3" },
  { id: "c6", level: 1, label: "Actinomycetia", parent: "p4", phylumId: "p4" },
  { id: "o1", level: 2, label: "Enterobacterales", parent: "c1", phylumId: "p1" },
  { id: "o2", level: 2, label: "Pseudomonadales", parent: "c1", phylumId: "p1" },
  { id: "o3", level: 2, label: "Rhizobiales", parent: "c2", phylumId: "p1" },
  { id: "o4", level: 2, label: "Lactobacillales", parent: "c3", phylumId: "p2" },
  { id: "o5", level: 2, label: "Bacillales", parent: "c3", phylumId: "p2" },
  { id: "o6", level: 2, label: "Clostridiales", parent: "c4", phylumId: "p2" },
  { id: "o7", level: 2, label: "Bacteroidales", parent: "c5", phylumId: "p3" },
  { id: "o8", level: 2, label: "Corynebacteriales", parent: "c6", phylumId: "p4" },
  { id: "f1", level: 3, label: "Enterobacteriaceae", parent: "o1", phylumId: "p1" },
  { id: "f2", level: 3, label: "Morganellaceae", parent: "o1", phylumId: "p1" },
  { id: "f3", level: 3, label: "Pseudomonadaceae", parent: "o2", phylumId: "p1" },
  { id: "f4", level: 3, label: "Rhizobiaceae", parent: "o3", phylumId: "p1" },
  { id: "f5", level: 3, label: "Streptococcaceae", parent: "o4", phylumId: "p2" },
  { id: "f6", level: 3, label: "Lactobacillaceae", parent: "o4", phylumId: "p2" },
  { id: "f7", level: 3, label: "Bacillaceae", parent: "o5", phylumId: "p2" },
  { id: "f8", level: 3, label: "Clostridiaceae", parent: "o6", phylumId: "p2" },
  { id: "f9", level: 3, label: "Bacteroidaceae", parent: "o7", phylumId: "p3" },
  { id: "f10", level: 3, label: "Corynebacteriaceae", parent: "o8", phylumId: "p4" },
];
const cladoById = Object.fromEntries(CLADO_NODES.map((n) => [n.id, n]));

function RadialTaxonomy({ onSeeSamples }) {
  const [hoverPhylum, setHoverPhylum] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const size = 760;
  const cx = size / 2, cy = size / 2;
  const radii = { 0: 60, 1: 135, 2: 205, 3: 255 };

  const angleById = useMemo(() => {
    const childrenOf = {};
    CLADO_NODES.forEach((n) => { if (n.parent) (childrenOf[n.parent] = childrenOf[n.parent] || []).push(n.id); });
    const leaves = CLADO_NODES.filter((n) => n.level === 3);
    const step = 360 / leaves.length;
    const angles = {};
    leaves.forEach((leaf, i) => { angles[leaf.id] = i * step; });
    [2, 1, 0].forEach((lvl) => {
      CLADO_NODES.filter((n) => n.level === lvl).forEach((n) => {
        const kids = childrenOf[n.id] || [];
        if (kids.length) angles[n.id] = kids.reduce((s, k) => s + angles[k], 0) / kids.length;
      });
    });
    return angles;
  }, []);

  const polar = (r, angleDeg) => {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  const edgePath = (parent, child) => {
    const rP = radii[parent.level], rC = radii[child.level];
    const aP = angleById[parent.id], aC = angleById[child.id];
    const [ax, ay] = polar(rP, aP);
    const [bx, by] = polar(rP, aC);
    const [dx, dy] = polar(rC, aC);
    const large = Math.abs(aC - aP) > 180 ? 1 : 0;
    const sweep = aC > aP ? 1 : 0;
    return `M ${ax},${ay} A ${rP},${rP} 0 ${large} ${sweep} ${bx},${by} L ${dx},${dy}`;
  };

  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <GitBranch size={16} style={{ color: COLORS.darkTeal }} />
          <span className="text-sm font-semibold" style={{ color: COLORS.darkTeal, fontFamily: FONT_BODY }}>
            Host Phylogeny (Phylum → Family)
          </span>
        </div>
        <span className="text-[11px]" style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}>example taxonomy</span>
      </div>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full" style={{ maxHeight: 520 }}>
        {CLADO_NODES.filter((n) => n.parent).map((n) => {
          const parent = cladoById[n.parent];
          const dim = hoverPhylum && n.phylumId !== hoverPhylum;
          return (
            <path
              key={`e-${n.id}`}
              d={edgePath(parent, n)}
              fill="none"
              stroke={PHYLA.find((p) => p.id === n.phylumId)?.color}
              strokeWidth={dim ? 1 : 1.6}
              opacity={dim ? 0.15 : 0.7}
            />
          );
        })}
        {CLADO_NODES.map((n) => {
          const r = radii[n.level];
          const angle = angleById[n.id];
          const [x, y] = polar(r, angle);
          const color = PHYLA.find((p) => p.id === n.phylumId)?.color;
          const dim = hoverPhylum && n.phylumId !== hoverPhylum;
          const leftHalf = angle > 90 && angle < 270;
          return (
            <g
              key={n.id}
              onMouseEnter={() => setHoverPhylum(n.phylumId)}
              onMouseLeave={() => setHoverPhylum(null)}
              onClick={() => setSelectedNode({ id: n.id, label: n.label })}
              style={{ cursor: "pointer" }}
              opacity={dim ? 0.25 : 1}
            >
              <circle cx={x} cy={y} r={n.level === 0 ? 5 : 3.5} fill={color} stroke={selectedNode?.id === n.id ? COLORS.ink : "none"} strokeWidth={selectedNode?.id === n.id ? 1.5 : 0} />
              <text
                x={x + (leftHalf ? -9 : 9)}
                y={y + 3}
                textAnchor={leftHalf ? "end" : "start"}
                fontSize={n.level === 0 ? 12 : 10}
                fontWeight={n.level === 0 || selectedNode?.id === n.id ? 700 : 400}
                fill={n.level === 0 ? COLORS.ink : COLORS.inkSoft}
                fontFamily={FONT_BODY}
              >
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-between gap-3 flex-wrap mt-2">
        <p className="text-xs" style={{ color: COLORS.inkSoft }}>
          Hover a branch to highlight its phylum; click any node to select it.
        </p>
        {selectedNode && (
          <button
            onClick={() => onSeeSamples({ type: "query", value: selectedNode.label })}
            className="inline-flex items-center gap-1 text-xs font-semibold shrink-0"
            style={{ color: COLORS.orange }}
          >
            See {selectedNode.label} samples <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

// ---- 9.2 Category share bars (GERÇEK VERİ) ---------------------------------
function CategoryBarChart({ onSeeSamples }) {
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet("/api/stats/category-share").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBlock message={error} />;
  if (!data) return <LoadingBlock />;

  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}>
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={16} style={{ color: COLORS.darkTeal }} />
        <span className="text-sm font-semibold" style={{ color: COLORS.darkTeal, fontFamily: FONT_BODY }}>
          Sample Share by Category
        </span>
      </div>
      <div className="space-y-2.5">
        {data.map((d) => (
          <button key={d.key} onClick={() => setSelected(d.key)} className="flex items-center gap-3 w-full text-left">
            <span className="w-40 text-xs shrink-0 text-right" style={{ color: COLORS.inkSoft, fontFamily: FONT_BODY }}>
              {catLabel(d.key)}
            </span>
            <div className="flex-1 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.paperAlt, height: 12 }}>
              <div style={{ width: `${(d.value / max) * 100}%`, height: "100%", backgroundColor: catColor(d.key), borderRadius: 999, opacity: selected === d.key ? 1 : 0.85 }} />
            </div>
            <span className="w-10 text-xs shrink-0" style={{ color: COLORS.ink, fontFamily: FONT_MONO }}>{d.value}%</span>
          </button>
        ))}
      </div>
      {selected && (
        <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: `1px solid ${COLORS.paperAlt}` }}>
          <span className="text-xs" style={{ color: COLORS.inkSoft }}>Selected: <strong style={{ color: COLORS.ink }}>{catLabel(selected)}</strong></span>
          <button onClick={() => onSeeSamples({ type: "category", value: selected })} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: COLORS.orange }}>
            See {catLabel(selected)} samples <ArrowRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// ---- 9.3 "Figure A" — circular chord diagram (GERÇEK VERİ) -----------------
function buildChordLayout(categories, targets, gapDeg = 3) {
  const catStart = 100, catEnd = 260;
  const tgtStart = -75, tgtEnd = 75;

  const catTotals = categories.map((c) => Object.values(c.values).reduce((a, b) => a + b, 0));
  const catTotalSum = catTotals.reduce((a, b) => a + b, 0) || 1;
  const catSpanTotal = catEnd - catStart - gapDeg * (categories.length - 1);
  let cursor = catStart;
  const catBlocks = categories.map((c, i) => {
    const span = (catTotals[i] / catTotalSum) * catSpanTotal;
    const block = { ...c, a0: cursor, a1: cursor + span, total: catTotals[i] || 1 };
    cursor += span + gapDeg;
    return block;
  });

  const tgtTotals = targets.map((t) => categories.reduce((s, c) => s + (c.values[t.key] || 0), 0));
  const tgtTotalSum = tgtTotals.reduce((a, b) => a + b, 0) || 1;
  const tgtSpanTotal = tgtEnd - tgtStart - gapDeg * (targets.length - 1);
  cursor = tgtStart;
  const tgtBlocks = targets.map((t, i) => {
    const span = (tgtTotals[i] / tgtTotalSum) * tgtSpanTotal;
    const block = { ...t, a0: cursor, a1: cursor + span, total: tgtTotals[i] || 1 };
    cursor += span + gapDeg;
    return block;
  });

  const tgtRunning = tgtBlocks.map((b) => b.a0);
  const ribbons = [];
  catBlocks.forEach((cat) => {
    let a = cat.a0;
    targets.forEach((t, ti) => {
      const v = cat.values[t.key] || 0;
      if (v <= 0) return;
      const srcSpan = (v / cat.total) * (cat.a1 - cat.a0);
      const tgtSpan = (v / tgtBlocks[ti].total) * (tgtBlocks[ti].a1 - tgtBlocks[ti].a0);
      ribbons.push({
        catKey: cat.key,
        color: cat.color,
        targetKey: t.key,
        srcA0: a,
        srcA1: a + srcSpan,
        tgtA0: tgtRunning[ti],
        tgtA1: tgtRunning[ti] + tgtSpan,
      });
      a += srcSpan;
      tgtRunning[ti] += tgtSpan;
    });
  });

  return { catBlocks, tgtBlocks, ribbons };
}

function RibbonChord({ onSeeSamples }) {
  const [hoverCat, setHoverCat] = useState(null);
  const [selected, setSelected] = useState(null);
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState(null);
  const width = 820, height = 560;
  const cx = 460, cy = 280;
  const R = 185, outerR = 200, labelR = 218;

  useEffect(() => {
    apiGet("/api/stats/annotation-flow").then(setRaw).catch((e) => setError(e.message));
  }, []);

  const categoriesForChord = useMemo(() => {
    if (!raw) return [];
    return raw
      .filter((c) => Object.values(c.values).some((v) => v > 0))
      .map((c) => ({ ...c, label: catLabel(c.key), color: catColor(c.key) }));
  }, [raw]);

  const { catBlocks, tgtBlocks, ribbons } = useMemo(
    () => buildChordLayout(categoriesForChord, ANNOTATIONS.map((a) => ({ key: a.key === "crispr" ? "crispr" : a.key, label: a.short }))),
    [categoriesForChord]
  );

  const polar = (r, angleDeg) => {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const arcPath = (rInner, rOuter, a0, a1) => {
    const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    const [x1, y1] = polar(rOuter, a0), [x2, y2] = polar(rOuter, a1);
    const [x3, y3] = polar(rInner, a1), [x4, y4] = polar(rInner, a0);
    return `M ${x1},${y1} A ${rOuter},${rOuter} 0 ${large} 1 ${x2},${y2} L ${x3},${y3} A ${rInner},${rInner} 0 ${large} 0 ${x4},${y4} Z`;
  };
  const ribbonPath = (a0, a1, b0, b1) => {
    const [x1, y1] = polar(R, a0), [x2, y2] = polar(R, a1);
    const [x3, y3] = polar(R, b0), [x4, y4] = polar(R, b1);
    const largeA = Math.abs(a1 - a0) > 180 ? 1 : 0;
    const largeB = Math.abs(b1 - b0) > 180 ? 1 : 0;
    return `M ${x1},${y1} A ${R},${R} 0 ${largeA} 1 ${x2},${y2} Q ${cx},${cy} ${x3},${y3} A ${R},${R} 0 ${largeB} 1 ${x4},${y4} Q ${cx},${cy} ${x1},${y1} Z`;
  };

  if (error) return <div className="rounded-2xl p-5 lg:col-span-2" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}><ErrorBlock message={error} /></div>;
  if (!raw) return <div className="rounded-2xl p-5 lg:col-span-2" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}><LoadingBlock /></div>;

  return (
    <div className="rounded-2xl p-5 lg:col-span-2" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}>
      <div className="flex items-center gap-2 mb-1">
        <Waves size={16} style={{ color: COLORS.darkTeal }} />
        <span className="text-sm font-semibold" style={{ color: COLORS.darkTeal, fontFamily: FONT_BODY }}>
          Figure A — Category to Functional Annotation Flow
        </span>
      </div>
      <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>
        Ribbon thickness shows contribution share; ribbon color always reflects the SOURCE category. Click a category
        or an annotation arc to select it.
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 480 }}>
        {ribbons.map((r, i) => {
          const dimmed = hoverCat && hoverCat !== r.catKey;
          return (
            <path
              key={i}
              d={ribbonPath(r.srcA0, r.srcA1, r.tgtA0, r.tgtA1)}
              fill={r.color}
              opacity={dimmed ? 0.06 : hoverCat === r.catKey ? 0.85 : 0.45}
              style={{ transition: "opacity 0.25s ease" }}
            />
          );
        })}
        {catBlocks.map((b) => {
          const mid = (b.a0 + b.a1) / 2;
          const [lx, ly] = polar(labelR, mid);
          const leftHalf = mid > 90 && mid < 270;
          const isSel = selected?.type === "category" && selected.key === b.key;
          return (
            <g
              key={b.key}
              onMouseEnter={() => setHoverCat(b.key)}
              onMouseLeave={() => setHoverCat(null)}
              onClick={() => setSelected({ type: "category", key: b.key, label: b.label })}
              style={{ cursor: "pointer" }}
            >
              <path d={arcPath(R, outerR, b.a0, b.a1)} fill={b.color} opacity={hoverCat === b.key || isSel ? 1 : 0.9} />
              <text x={lx} y={ly} textAnchor={leftHalf ? "end" : "start"} dominantBaseline="middle" fontSize={11.5} fontWeight={hoverCat === b.key || isSel ? 700 : 500} fill={COLORS.ink} fontFamily={FONT_BODY}>
                {b.label}
              </text>
            </g>
          );
        })}
        {tgtBlocks.map((b) => {
          const mid = (b.a0 + b.a1) / 2;
          const [lx, ly] = polar(labelR, mid);
          const leftHalf = mid > 90 && mid < 270;
          const isSel = selected?.type === "annotation" && selected.key === b.key;
          return (
            <g key={b.key} onClick={() => setSelected({ type: "annotation", key: b.key, label: b.label })} style={{ cursor: "pointer" }}>
              <path d={arcPath(R, outerR, b.a0, b.a1)} fill={COLORS.ink} opacity={isSel ? 1 : 0.7} />
              <text x={lx} y={ly} textAnchor={leftHalf ? "end" : "start"} dominantBaseline="middle" fontSize={12} fontWeight={isSel ? 700 : 600} fill={COLORS.darkTeal} fontFamily={FONT_MONO}>
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3" style={{ borderTop: `1px solid ${COLORS.paperAlt}` }}>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {ANNOTATIONS.map((a) => (
            <span key={a.key} className="text-[11px]" style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}>
              <strong style={{ color: COLORS.darkTeal }}>{a.short}</strong> = {a.label} ({a.tool})
            </span>
          ))}
        </div>
        {selected && (
          <button
            onClick={() => onSeeSamples({ type: selected.type, value: selected.key })}
            className="inline-flex items-center gap-1 text-xs font-semibold shrink-0"
            style={{ color: COLORS.orange }}
          >
            See {selected.label} samples <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

// ---- 9.4 World sample map (GERÇEK sayı/kategori, MOCK centroid konumu) -----
const WORLD_MAP_URL = "https://commons.wikimedia.org/wiki/Special:FilePath/BlankMap-Equirectangular.svg";
const MAP_W = 360;
const MAP_H = 180;
const toMapXY = (lat, lon) => [lon + 180, 90 - lat];

function WorldHeatMap({ onSeeSamples }) {
  const [mode, setMode] = useState("count");
  const [active, setActive] = useState(null);
  const [locked, setLocked] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [points, setPoints] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet("/api/stats/map")
      .then((rows) => {
        const withXY = rows
          .filter((r) => r.lat !== null && r.lon !== null)
          .map((r) => {
            const [x, y] = toMapXY(r.lat, r.lon);
            return { ...r, x, y };
          });
        setPoints(withXY);
      })
      .catch((e) => setError(e.message));
  }, []);

  const viewW = MAP_W / zoom, viewH = MAP_H / zoom;
  const vx = clamp(pan.x, 0, Math.max(0, MAP_W - viewW));
  const vy = clamp(pan.y, 0, Math.max(0, MAP_H - viewH));

  const zoomBy = (factor) => setZoom((z) => clamp(z * factor, 1, 5));
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      e.preventDefault();
      setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, 5));
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  const onPointerDown = (e) => {
    if (zoom <= 1) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: vx, panY: vy };
  };
  const onPointerMove = (e) => {
    if (!dragRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = viewW / rect.width;
    const scaleY = viewH / rect.height;
    const dx = (e.clientX - dragRef.current.startX) * scaleX;
    const dy = (e.clientY - dragRef.current.startY) * scaleY;
    setPan({ x: dragRef.current.panX - dx, y: dragRef.current.panY - dy });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const maxCount = points && points.length ? Math.max(...points.map((p) => p.count)) : 1;
  const countColor = (v) => {
    const t = v / maxCount;
    if (t < 0.3) return COLORS.lightTeal;
    if (t < 0.55) return COLORS.medTeal;
    if (t < 0.8) return COLORS.orange;
    return COLORS.berry;
  };

  const selectPoint = (p) => { setActive(p); setLocked(true); };
  const clearSelection = () => { setActive(null); setLocked(false); };

  return (
    <div className="rounded-2xl p-5 lg:col-span-2" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Globe2 size={16} style={{ color: COLORS.darkTeal }} />
          <span className="text-sm font-semibold" style={{ color: COLORS.darkTeal, fontFamily: FONT_BODY }}>
            Global Sample Distribution
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full overflow-hidden border" style={{ borderColor: COLORS.line }}>
            {[{ key: "count", label: "Sample Count" }, { key: "category", label: "Dominant Category" }].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setMode(opt.key)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{ backgroundColor: mode === opt.key ? COLORS.darkTeal : "#fff", color: mode === opt.key ? "#fff" : COLORS.inkSoft, fontFamily: FONT_BODY }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => zoomBy(1.3)} className="p-1.5 rounded-md" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.darkTeal }} title="Zoom in">
              <ZoomIn size={14} />
            </button>
            <button onClick={() => zoomBy(1 / 1.3)} className="p-1.5 rounded-md" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.darkTeal }} title="Zoom out">
              <ZoomOut size={14} />
            </button>
            <button onClick={resetView} className="p-1.5 rounded-md" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.darkTeal }} title="Reset view">
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>

      {error && <ErrorBlock message={error} />}
      {!error && !points && <LoadingBlock />}
      {!error && points && (
        <>
          <svg
            ref={svgRef}
            viewBox={`${vx} ${vy} ${viewW} ${viewH}`}
            className="w-full"
            style={{ maxHeight: 560, cursor: zoom > 1 ? "grab" : "default", touchAction: "none" }}
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onMouseLeave={onPointerUp}
          >
            <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="#E8F2F3" />
            <image href={WORLD_MAP_URL} x={0} y={0} width={MAP_W} height={MAP_H} preserveAspectRatio="none" opacity={0.9} />
            {points.map((p) => {
              const fill = mode === "count" ? countColor(p.count) : catColor(p.category);
              const r = 2 + (p.count / maxCount) * 4.5;
              const isActive = active && active.label === p.label;
              return (
                <g
                  key={p.label}
                  onMouseEnter={() => !locked && setActive(p)}
                  onMouseLeave={() => !locked && setActive(null)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); selectPoint(p); }}
                  style={{ cursor: "pointer" }}
                >
                  <circle cx={p.x} cy={p.y} r={r} fill={fill} opacity={0.85} stroke={isActive ? COLORS.ink : "#fff"} strokeWidth={isActive ? 0.9 : 0.5} />
                </g>
              );
            })}
          </svg>
          <div className="mt-2 min-h-[40px] flex items-center justify-between flex-wrap gap-2">
            {active ? (
              <>
                <div className="text-sm flex items-center gap-3 flex-wrap" style={{ fontFamily: FONT_BODY }}>
                  <span className="font-semibold" style={{ color: COLORS.darkTeal }}>{active.label}</span>
                  <span style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}>n = {active.count}</span>
                  {active.category && (
                    <span className="px-2 py-0.5 rounded-full text-xs text-white" style={{ backgroundColor: catColor(active.category) }}>{catLabel(active.category)}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => onSeeSamples({ type: "country", value: active.label })} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: COLORS.orange }}>
                    See {active.label} samples <ArrowRight size={12} />
                  </button>
                  {locked && <button onClick={clearSelection} className="text-xs" style={{ color: COLORS.inkSoft }}>Clear</button>}
                </div>
              </>
            ) : (
              <span className="text-xs" style={{ color: COLORS.inkSoft }}>
                Scroll or use the zoom controls to zoom in, drag to pan, and click a point to see samples from that
                country. Nokta konumları yaklaşık ülke merkezi (mock centroid) — sayı ve kategori gerçek veridir.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---- 9.5 Overview stats (GERÇEK VERİ) --------------------------------------
function OverviewStats() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet("/api/stats/overview").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBlock message={error} />;
  if (!data) return <LoadingBlock />;

  const rows = [
    { label: "Total Samples", value: data.totalSamples?.toLocaleString?.() ?? data.totalSamples },
    { label: "Food Categories", value: data.categories },
    { label: "Host Species", value: data.hosts },
    { label: "Countries", value: data.countries },
    { label: "Source Databases", value: (data.databaseOrigins || []).join(" · ") || "—" },
    { label: "Total Plasmid Contigs", value: data.totalPlasmidContigs?.toLocaleString?.() ?? data.totalPlasmidContigs },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-10">
      {rows.map((s) => (
        <div key={s.label} className="rounded-xl p-4" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}>
          <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}>{s.label}</div>
          <div className="text-base font-semibold" style={{ color: COLORS.darkTeal, fontFamily: FONT_MONO }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

// ---- 9.6 About page shell --------------------------------------------------
function AboutPage({ onNavigate }) {
  return (
    <div style={{ backgroundColor: COLORS.paper }}>
      <section className="max-w-6xl mx-auto px-6 py-16">
        <SectionTitle title="What is GFPR, and why does it matter?" align="center" />

        <div
          className="w-[75%] mt-10 space-y-4 text-[15px] leading-relaxed mx-auto"
          style={{ color: COLORS.ink, fontFamily: FONT_BODY, textAlign: "left" }}
        >
          <p>
            Food is not just a cultural product — it is a living microbial ecosystem. Fermented dairy, wines,
            soy sauce, and hundreds of other foods across every culture carry dynamic microbial communities and
            mobile genetic elements that continuously move between animals, the environment, and humans. At the
            center of that ecosystem sit <strong>plasmids</strong>: circular, self-replicating DNA molecules
            that move between bacteria independently of the host chromosome, carrying traits like antibiotic
            resistance, stress tolerance, and enzyme production.
          </p>
          <p>
            Plasmids matter for both the technological and safety sides of food. In fermentation, they often
            encode traits central to the process itself — lactose and citrate utilization, cell-envelope
            proteinases, exopolysaccharide synthesis, and bacteriocins — alongside carbohydrate-active enzymes,
            heavy-metal resistance, and defense systems such as CRISPR-Cas. They are also key vectors for{" "}
            <strong>antimicrobial resistance (AMR)</strong> genes, which makes food a direct route by which
            resistance genes can reach the human gut.
          </p>
          <p>
            Most plasmid research to date has focused on clinical settings — the human gut, bloodstream
            infections — or on environmental reservoirs like soil and water. Where food has been studied at all,
            it has mostly meant animal agriculture (poultry, dairy cattle, livestock production) rather than the
            broader range of food people actually eat. The food-derived plasmidome has remained largely
            unexplored. GFPR was built to close that gap.
          </p>
          <p>
            For every sample, plasmid host taxonomy is predicted down to the family level, and contigs are
            annotated across seven functional dimensions: <strong>AMR &amp; stress response genes</strong>,{" "}
            <strong>CAZymes</strong>, <strong>CAZyme gene clusters</strong>, <strong>CRISPR-Cas systems</strong>,{" "}
            <strong>antimicrobial peptides</strong>, <strong>anticancer peptides</strong>, and{" "}
            <strong>Pfam / KEGG orthology groups</strong>.
          </p>
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>
            Every sample follows a <strong>Category → Type → Subtype</strong> hierarchy, and is separately tagged as{" "}
            <strong>fermented</strong> or <strong>non-fermented</strong> — both are filterable on the Data Access page.
          </p>
          <div className="flex flex-wrap items-center justify-start gap-5 mt-2">
            <a href="#" className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: COLORS.orange }}>
              View the full paper <ExternalLink size={14} />
            </a>
            <a href="#" className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: COLORS.berry }}>
              <FaGithub className="w-4 h-4" /> View on GitHub
            </a>
            <a href="https://arikanlab.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: COLORS.darkTeal }}>
              Arıkan Lab <ExternalLink size={14} />
            </a>
          </div>
        </div>

        <OverviewStats />

        <div className="mt-14">
          <SectionTitle title="Explore the data" />
          <div className="grid lg:grid-cols-2 gap-6 mt-8">
            <RadialTaxonomy onSeeSamples={onNavigate} />
            <CategoryBarChart onSeeSamples={onNavigate} />
            <RibbonChord onSeeSamples={onNavigate} />
            <WorldHeatMap onSeeSamples={onNavigate} />
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 10) DATA ACCESS PAGE + SAMPLE DETAIL (GERÇEK VERİ)
// ============================================================================
function FilterChip({ label, options, selected, onToggle }) {
  const [open, setOpen] = useState(false);
  const sorted = [...options].sort((a, b) => a.label.localeCompare(b.label));
  const hasSelection = selected.length > 0;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap"
        style={{
          border: `1.5px solid ${hasSelection ? COLORS.orange : COLORS.line}`,
          backgroundColor: hasSelection ? `${COLORS.orange}18` : "#fff",
          color: hasSelection ? COLORS.deepOrange : COLORS.ink,
          fontFamily: FONT_BODY,
        }}
      >
        {label}{hasSelection && ` (${selected.length})`}
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-2 w-64 max-h-72 overflow-y-auto rounded-xl shadow-lg p-2" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}>
            {sorted.map((opt) => {
              const isSel = selected.includes(opt.value);
              return (
                <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer" style={{ color: COLORS.ink }}>
                  <input type="checkbox" checked={isSel} onChange={() => onToggle(opt.value)} style={{ accentColor: COLORS.orange }} />
                  {opt.swatch && <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: opt.swatch }} />}
                  {opt.label}
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function DataAccessPage({ onMockAction, onOpenSample, initialFilter }) {
  const [filterOptions, setFilterOptions] = useState(null);
  const [selectedCats, setSelectedCats] = useState(() => (initialFilter?.type === "category" ? [initialFilter.value] : []));
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedSubtypes, setSelectedSubtypes] = useState([]);
  const [selectedCountries, setSelectedCountries] = useState(() => (initialFilter?.type === "country" ? [initialFilter.value] : []));
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedAnnotations, setSelectedAnnotations] = useState(() => (initialFilter?.type === "annotation" ? [initialFilter.value] : []));
  const [fermentFilter, setFermentFilter] = useState(null);
  const [query, setQuery] = useState(() => (initialFilter?.type === "query" ? initialFilter.value : ""));
  const [selectedIds, setSelectedIds] = useState([]);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtre chip seçenekleri — DB'de gerçekten var olan değerlerden
  useEffect(() => {
    apiGet("/api/samples/filters").then(setFilterOptions).catch((e) => setError(e.message));
  }, []);

  // Filtre/arama/sayfa her değiştiğinde backend'e sor
  useEffect(() => {
    setLoading(true);
    setError(null);
    apiGet("/api/samples", {
      category: selectedCats,
      type: selectedTypes,
      subtype: selectedSubtypes,
      country: selectedCountries,
      year: selectedYears,
      fermented: fermentFilter === null ? undefined : String(fermentFilter),
      q: query || undefined,
      page,
      pageSize,
    })
      .then((res) => {
        setRows(res.results);
        setTotal(res.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedCats, selectedTypes, selectedSubtypes, selectedCountries, selectedYears, fermentFilter, query, page]);

  // Herhangi bir filtre değişince 1. sayfaya dön
  useEffect(() => { setPage(1); }, [selectedCats, selectedTypes, selectedSubtypes, selectedCountries, selectedYears, fermentFilter, query]);

  const toggle = (setFn) => (val) => setFn((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));
  const toggleId = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const annotationNote = selectedAnnotations.length
    ? `the selected annotation output (${selectedAnnotations.map((k) => ANNOTATIONS.find((a) => a.key === k)?.short).join(", ")})`
    : "raw DNA sequences and every annotation output";

  return (
    <div style={{ backgroundColor: COLORS.paper }} className="min-h-screen">
      <section className="max-w-6xl mx-auto px-6 py-16">
        <SectionTitle
          title="Data Access"
          subtitle="Filter by category, type, subtype, fermentation status, country, date, or annotation, then download metadata or the underlying files."
        />

        {initialFilter && (
          <div className="flex items-center gap-1.5 mt-4 text-xs" style={{ color: COLORS.darkTeal }}>
            <Filter size={12} />
            Arrived pre-filtered from About GFPR — {initialFilter.type === "category" ? `category: ${catLabel(initialFilter.value)}` : initialFilter.type === "annotation" ? `annotation: ${ANNOTATIONS.find((a) => a.key === initialFilter.value)?.short || initialFilter.value}` : initialFilter.type === "country" ? `country: ${initialFilter.value}` : `search: "${initialFilter.value}"`}
          </div>
        )}

        {error && <div className="mt-4"><ErrorBlock message={error} /></div>}

        {filterOptions && (
          <>
            <div className="flex items-center gap-2 mt-8 mb-3">
              <Filter size={14} style={{ color: COLORS.inkSoft }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}>Filters</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <FilterChip
                label="Category"
                options={filterOptions.categories.map((k) => ({ value: k, label: catLabel(k), swatch: catColor(k) }))}
                selected={selectedCats}
                onToggle={toggle(setSelectedCats)}
              />
              <FilterChip
                label="Type"
                options={filterOptions.types.map((t) => ({ value: t, label: t }))}
                selected={selectedTypes}
                onToggle={toggle(setSelectedTypes)}
              />
              <FilterChip
                label="Subtype"
                options={filterOptions.subtypes.map((t) => ({ value: t, label: t }))}
                selected={selectedSubtypes}
                onToggle={toggle(setSelectedSubtypes)}
              />
              <div className="flex rounded-xl overflow-hidden" style={{ border: `1.5px solid ${COLORS.line}` }}>
                {[{ key: null, label: "All" }, { key: true, label: "Fermented" }, { key: false, label: "Non-Fermented" }].map((opt) => (
                  <button
                    key={String(opt.key)}
                    onClick={() => setFermentFilter(opt.key)}
                    className="px-3 py-2.5 text-xs font-medium whitespace-nowrap"
                    style={{ backgroundColor: fermentFilter === opt.key ? COLORS.orange : "#fff", color: fermentFilter === opt.key ? "#fff" : COLORS.inkSoft, fontFamily: FONT_BODY }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <FilterChip
                label="Country"
                options={filterOptions.countries.map((c) => ({ value: c, label: c }))}
                selected={selectedCountries}
                onToggle={toggle(setSelectedCountries)}
              />
              <FilterChip
                label="Date"
                options={filterOptions.years.map((y) => ({ value: String(y), label: String(y) }))}
                selected={selectedYears}
                onToggle={toggle(setSelectedYears)}
              />
              <FilterChip
                label="Annotation"
                options={ANNOTATIONS.map((a) => ({ value: a.key, label: a.short }))}
                selected={selectedAnnotations}
                onToggle={toggle(setSelectedAnnotations)}
              />
              <div className="relative flex-1 min-w-[180px]">
                <Search size={14} style={{ position: "absolute", left: 10, top: 12, color: COLORS.inkSoft }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search ID, category, type, subtype, host, country..."
                  className="w-full text-sm pl-8 pr-3 py-2.5 rounded-xl outline-none"
                  style={{ border: `1.5px solid ${COLORS.line}`, fontFamily: FONT_BODY, backgroundColor: "#fff", color: COLORS.ink }}
                />
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-between mt-6 mb-3 flex-wrap gap-2">
          <span className="text-sm" style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}>
            {total} results {selectedIds.length > 0 && `· ${selectedIds.length} selected`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onMockAction(`Metadata (CSV) will be downloaded for ${selectedIds.length || total} sample(s).`)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
              style={{ backgroundColor: COLORS.lightTeal, color: COLORS.darkTeal }}
            >
              <Download size={13} /> Metadata (CSV)
            </button>
            <button
              onClick={() => onMockAction(`For ${selectedIds.length || total} sample(s), ${annotationNote} will be downloaded.`)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: COLORS.orange }}
            >
              <Download size={13} /> Download Files
            </button>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${COLORS.line}` }}>
          <table className="w-full text-sm" style={{ fontFamily: FONT_BODY }}>
            <thead>
              <tr style={{ backgroundColor: COLORS.darkTeal }}>
                <th className="w-8 py-2.5"></th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-white" style={{ fontFamily: FONT_MONO }}>ID</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-white">Category</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-white">Country</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-white">Type</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-white">Host</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-white">Date</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8}><LoadingBlock /></td></tr>
              )}
              {!loading && rows.map((r, i) => (
                <tr key={r.id} style={{ backgroundColor: i % 2 ? COLORS.paperAlt : "#fff" }}>
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleId(r.id)} style={{ accentColor: COLORS.orange }} />
                  </td>
                  <td className="px-3 py-2 cursor-pointer" style={{ fontFamily: FONT_MONO, color: COLORS.darkTeal }} onClick={() => onOpenSample(r.id)}>
                    {r.id}
                  </td>
                  <td className="px-3 py-2 cursor-pointer" style={{ color: COLORS.ink }} onClick={() => onOpenSample(r.id)}>
                    {catLabel(r.category)}
                  </td>
                  <td className="px-3 py-2 cursor-pointer" style={{ color: COLORS.inkSoft }} onClick={() => onOpenSample(r.id)}>{r.country}</td>
                  <td className="px-3 py-2 cursor-pointer" style={{ color: COLORS.inkSoft }} onClick={() => onOpenSample(r.id)}>{r.type}</td>
                  <td className="px-3 py-2 italic cursor-pointer" style={{ color: COLORS.inkSoft }} onClick={() => onOpenSample(r.id)}>{r.host}</td>
                  <td className="px-3 py-2 cursor-pointer" style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }} onClick={() => onOpenSample(r.id)}>{r.year}</td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button title="Open source database entry" onClick={() => onMockAction(`${r.id} will open the source database entry.`)} className="p-1.5 rounded-md" style={{ color: COLORS.medTeal }}>
                        <LinkIcon size={14} />
                      </button>
                      <button title="Download this sample" onClick={() => onMockAction(`Files will be downloaded for ${r.id}.`)} className="p-1.5 rounded-md" style={{ color: COLORS.orange }}>
                        <Download size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-sm" style={{ color: COLORS.inkSoft }}>No samples match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {total > pageSize && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-40"
              style={{ border: `1px solid ${COLORS.line}`, color: COLORS.darkTeal }}
            >
              Prev
            </button>
            <span className="text-xs" style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}>
              Page {page} / {Math.max(1, Math.ceil(total / pageSize))}
            </span>
            <button
              disabled={page >= Math.ceil(total / pageSize)}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-40"
              style={{ border: `1px solid ${COLORS.line}`, color: COLORS.darkTeal }}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="text-sm leading-relaxed" style={{ fontFamily: FONT_BODY, color: COLORS.ink }}>
      <span style={{ fontWeight: 700 }}>{label}:</span> <span>{children}</span>
    </div>
  );
}

function SampleDetailPage({ recordId, onBack, onMockAction }) {
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(null);
  const [selectedDownloads, setSelectedDownloads] = useState([]);

  useEffect(() => {
    setRecord(null);
    setError(null);
    if (!recordId) return;
    apiGet(`/api/samples/${encodeURIComponent(recordId)}`)
      .then((data) => {
        setRecord(data);
        setSelectedDownloads(["fasta", ...data.annotations.map((a) => a.key)]);
      })
      .catch((e) => setError(e.message));
  }, [recordId]);

  if (error) {
    return (
      <div style={{ backgroundColor: COLORS.paper }} className="min-h-screen">
        <section className="max-w-4xl mx-auto px-6 py-16">
          <ErrorBlock message={error} />
          <button onClick={onBack} className="mt-4 text-sm font-semibold" style={{ color: COLORS.orange }}>Back to Data Access</button>
        </section>
      </div>
    );
  }

  if (!record) {
    return (
      <div style={{ backgroundColor: COLORS.paper }} className="min-h-screen">
        <section className="max-w-4xl mx-auto px-6 py-16">
          <LoadingBlock />
        </section>
      </div>
    );
  }

  const allKeys = ["fasta", ...record.annotations.map((a) => a.key)];
  const toggleDownload = (key) => setSelectedDownloads((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const toggleAllDownloads = () => setSelectedDownloads((prev) => (prev.length === allKeys.length ? [] : allKeys));

  const ANNOTATION_LABELS = {
    amr: "AMR & Stress Response Genes", cazyme: "CAZymes", cgc: "Cazyme Gene Cluster",
    crispr_cas: "CRISPR-Cas Systems", amp: "Antimicrobial Peptides", acp: "Anticancer Peptides",
    pfam_ko: "Pfam & KEGG KO",
  };

  const downloadItems = [
    { key: "fasta", label: "Raw DNA Sequence (FASTA)", sub: `${record.id}.fasta` },
    ...record.annotations.map((a) => ({ key: a.key, label: ANNOTATION_LABELS[a.key] || a.key, sub: `${a.count} hit(s)` })),
  ];

  const annotationsToShow = record.annotations.filter((a) => selectedDownloads.includes(a.key));

  return (
    <div style={{ backgroundColor: COLORS.paper }} className="min-h-screen">
      <section className="max-w-5xl mx-auto px-6 py-16">
        <button onClick={onBack} className="text-sm font-semibold mb-6 flex items-center gap-1" style={{ color: COLORS.orange }}>
          <ChevronLeft size={16} /> Back to Data Access
        </button>

        <h2 className="text-3xl font-semibold mb-8" style={{ color: COLORS.darkTeal, fontFamily: FONT_MONO }}>{record.id}</h2>

        <div className="grid md:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6">
            <div className="rounded-2xl p-5" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold" style={{ color: COLORS.darkTeal }}>FASTA Preview</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: COLORS.yellow, color: COLORS.deepOrange, fontFamily: FONT_MONO }}>mock</span>
              </div>
              <p className="text-xs" style={{ color: COLORS.inkSoft }}>Gerçek FASTA verisi bağlanmadı — dosya deposu hazır olduğunda burada gösterilecek.</p>
            </div>

            <div className="rounded-2xl p-5" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}>
              <div className="text-sm font-semibold mb-3" style={{ color: COLORS.darkTeal }}>General Info</div>
              <div className="space-y-1.5">
                <InfoRow label="Country">{record.country}</InfoRow>
                <InfoRow label="Category">{catLabel(record.category)} → {record.type} → {record.subtype}</InfoRow>
                <InfoRow label="Fermented">{record.fermented ? "Yes" : "No"}</InfoRow>
                <InfoRow label="Host"><em>{record.host}</em></InfoRow>
                <InfoRow label="Plasmid Contig Count">{record.plasmidContigCounts}</InfoRow>
                <InfoRow label="Date">{record.year}</InfoRow>
              </div>

              <div className="text-sm font-semibold mt-6 mb-3 pt-4" style={{ color: COLORS.darkTeal, borderTop: `1px solid ${COLORS.paperAlt}` }}>
                Annotation Summary
              </div>
              {annotationsToShow.length === 0 ? (
                <p className="text-xs" style={{ color: COLORS.inkSoft }}>Check an annotation file in Downloads to see its hit summary here.</p>
              ) : (
                <div className="space-y-4">
                  {annotationsToShow.map((a) => (
                    <div key={a.key}>
                      <div className="text-sm" style={{ fontWeight: 700, color: COLORS.ink, fontFamily: FONT_BODY }}>
                        {ANNOTATION_LABELS[a.key] || a.key} <span style={{ fontWeight: 400, color: COLORS.inkSoft }}>({a.count} hit{a.count === 1 ? "" : "s"} — gerçek sayı)</span>
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {a.hits.length === 0 ? (
                          <div className="text-sm" style={{ color: COLORS.inkSoft }}>—</div>
                        ) : a.hits.map((h) => (
                          <div key={h} className="text-sm" style={{ fontWeight: 400, color: COLORS.inkSoft, fontFamily: FONT_BODY }}>
                            {h}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl p-5 h-fit" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold" style={{ color: COLORS.darkTeal }}>Downloads</span>
              <button onClick={toggleAllDownloads} className="text-xs font-medium" style={{ color: COLORS.orange }}>
                {selectedDownloads.length === allKeys.length ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="space-y-2 mb-4">
              {downloadItems.map((it) => (
                <label key={it.key} className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer" style={{ backgroundColor: COLORS.paperAlt }}>
                  <input type="checkbox" checked={selectedDownloads.includes(it.key)} onChange={() => toggleDownload(it.key)} style={{ accentColor: COLORS.orange }} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: COLORS.ink }}>{it.label}</div>
                    <div className="text-[11px] truncate" style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}>{it.sub}</div>
                  </div>
                </label>
              ))}
            </div>
            <button
              onClick={() => onMockAction(`${selectedDownloads.length} file(s) will be downloaded for ${record.id}.`)}
              disabled={selectedDownloads.length === 0}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg text-white"
              style={{ backgroundColor: selectedDownloads.length ? COLORS.orange : "#c9c9c9" }}
            >
              <Download size={14} /> Download Selected ({selectedDownloads.length})
            </button>
            <a href="#" onClick={(e) => e.preventDefault()} className="inline-flex items-center gap-1 text-xs font-semibold mt-4" style={{ color: COLORS.medTeal }}>
              View source record on NCBI <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 11) ANALYSIS PAGE (mock analiz motoru, gerçek örneklerden rastgele seçim)
// ============================================================================
function AnalysisPage({ onMockAction }) {
  const [fileName, setFileName] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const handleFiles = (files) => { if (files && files[0]) setFileName(files[0].name); };

  const runAnalysis = async () => {
    if (!fileName) { onMockAction("Please upload a file first."); return; }
    setRunning(true);
    setError(null);
    try {
      const data = await apiPost("/api/mock/analysis/run", {});
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ backgroundColor: COLORS.paper }} className="min-h-screen">
      <section className="max-w-4xl mx-auto px-6 py-16">
        <SectionTitle
          title="Analysis"
          subtitle="Upload a file in FASTA, GFA, or protein/DNA format and we'll surface the closest matches in our database."
        />
        <p className="mt-4 max-w-2xl text-sm leading-relaxed" style={{ color: COLORS.inkSoft, fontFamily: FONT_BODY }}>
          This tool compares your upload against every plasmid in GFPR and returns the 10 most similar samples.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className="mt-8 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
          style={{ border: `2px dashed ${dragOver ? COLORS.orange : COLORS.medTeal}`, backgroundColor: dragOver ? COLORS.lightTeal : "#fff", padding: "56px 24px" }}
        >
          <input ref={inputRef} type="file" className="hidden" accept=".fa,.fasta,.gfa,.faa,.ffn,.gff,.fna" onChange={(e) => handleFiles(e.target.files)} />
          <div className="rounded-full p-4 mb-4" style={{ backgroundColor: COLORS.lightTeal }}>
            <UploadCloud size={26} style={{ color: COLORS.darkTeal }} />
          </div>
          {fileName ? (
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: COLORS.darkTeal }}>
              <FileUp size={15} /> {fileName}
            </div>
          ) : (
            <p className="text-sm font-medium" style={{ color: COLORS.ink }}>Drag a file here, or click to choose one</p>
          )}
        </div>

        <div className="flex items-center justify-between mt-5">
          <div className="flex flex-wrap gap-2">
            {[".fasta", ".fa", ".gfa", ".faa", ".gff"].map((f) => (
              <span key={f} className="text-[11px] px-2.5 py-1 rounded-full" style={{ backgroundColor: COLORS.paperAlt, color: COLORS.inkSoft, fontFamily: FONT_MONO }}>{f}</span>
            ))}
          </div>
          <button onClick={runAnalysis} disabled={running} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: COLORS.orange }}>
            {running ? "Running..." : "Run Analysis"}
          </button>
        </div>

        {error && <div className="mt-6"><ErrorBlock message={error} /></div>}

        {result && (
          <>
            <div className="mt-10 rounded-2xl p-5" style={{ backgroundColor: COLORS.lightTeal }}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs uppercase tracking-wide font-semibold" style={{ color: COLORS.darkTeal, fontFamily: FONT_MONO }}>Predicted Origin</div>
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: COLORS.yellow, color: COLORS.deepOrange, fontFamily: FONT_MONO }}>mock</span>
              </div>
              {result.predictedOrigin && (
                <div className="text-lg font-semibold" style={{ fontFamily: FONT_DISPLAY, color: COLORS.darkTeal }}>
                  {catLabel(result.predictedOrigin.category)} · {result.predictedOrigin.type} · {result.predictedOrigin.host} · {result.predictedOrigin.country}
                </div>
              )}
              <p className="text-sm mt-1" style={{ color: COLORS.darkTeal }}>{result.note}</p>
            </div>

            <div className="mt-6 rounded-2xl p-5" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold" style={{ color: COLORS.darkTeal }}>10 Closest Samples</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: COLORS.yellow, color: COLORS.deepOrange, fontFamily: FONT_MONO }}>
                  mock — similarity motoru bağlanmadı, örnekler gerçek DB'den rastgele
                </span>
              </div>
              <table className="w-full text-sm mt-3" style={{ fontFamily: FONT_BODY }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                    <th className="text-left py-2 text-xs font-semibold" style={{ color: COLORS.inkSoft }}>ID</th>
                    <th className="text-left py-2 text-xs font-semibold" style={{ color: COLORS.inkSoft }}>Similarity</th>
                    <th className="text-left py-2 text-xs font-semibold" style={{ color: COLORS.inkSoft }}>Category</th>
                    <th className="text-left py-2 text-xs font-semibold" style={{ color: COLORS.inkSoft }}>Type</th>
                    <th className="text-left py-2 text-xs font-semibold" style={{ color: COLORS.inkSoft }}>Host</th>
                    <th className="text-left py-2 text-xs font-semibold" style={{ color: COLORS.inkSoft }}>Country</th>
                  </tr>
                </thead>
                <tbody>
                  {result.matches.map((m) => (
                    <tr key={m.id} style={{ borderBottom: `1px solid ${COLORS.paperAlt}` }}>
                      <td className="py-2.5" style={{ fontFamily: FONT_MONO, color: COLORS.darkTeal }}>{m.id}</td>
                      <td className="py-2.5">{m.similarity}%</td>
                      <td className="py-2.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: catColor(m.category) }} />
                          {catLabel(m.category)}
                        </span>
                      </td>
                      <td className="py-2.5" style={{ color: COLORS.inkSoft }}>{m.type}</td>
                      <td className="py-2.5 italic" style={{ color: COLORS.inkSoft }}>{m.host}</td>
                      <td className="py-2.5" style={{ color: COLORS.inkSoft }}>{m.country}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// ============================================================================
// 12) CONTACT PAGE
// ============================================================================
function ContactPage({ onMockAction }) {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    try {
      await apiPost("/api/mock/contact", form);
      setSent(true);
      onMockAction("Your message was received (mock). Real delivery will go live once the backend is connected.");
    } catch (err) {
      onMockAction(`Gönderilemedi: ${err.message}`);
    }
  };

  return (
    <div style={{ backgroundColor: COLORS.paper }} className="min-h-screen">
      <section className="max-w-4xl mx-auto px-6 py-16">
        <SectionTitle
          title="Contact"
          subtitle="Fill out the form for questions about data, collaboration, or anything technical, or email the team directly."
        />

        <div className="grid md:grid-cols-[1fr_260px] gap-8 mt-10">
          <form onSubmit={submit} className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold" style={{ color: COLORS.inkSoft }}>Full Name</label>
                <input required value={form.name} onChange={update("name")} className="w-full mt-1 text-sm px-3 py-2 rounded-lg outline-none" style={{ border: `1px solid ${COLORS.line}`, backgroundColor: "#fff", color: COLORS.ink }} />
              </div>
              <div>
                <label className="text-xs font-semibold" style={{ color: COLORS.inkSoft }}>Email</label>
                <input required type="email" value={form.email} onChange={update("email")} className="w-full mt-1 text-sm px-3 py-2 rounded-lg outline-none" style={{ border: `1px solid ${COLORS.line}`, backgroundColor: "#fff", color: COLORS.ink }} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold" style={{ color: COLORS.inkSoft }}>Subject</label>
              <input value={form.subject} onChange={update("subject")} className="w-full mt-1 text-sm px-3 py-2 rounded-lg outline-none" style={{ border: `1px solid ${COLORS.line}`, backgroundColor: "#fff", color: COLORS.ink }} />
            </div>
            <div>
              <label className="text-xs font-semibold" style={{ color: COLORS.inkSoft }}>Message</label>
              <textarea required rows={5} value={form.message} onChange={update("message")} className="w-full mt-1 text-sm px-3 py-2 rounded-lg outline-none resize-none" style={{ border: `1px solid ${COLORS.line}`, backgroundColor: "#fff", color: COLORS.ink }} />
            </div>
            <button type="submit" className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: COLORS.orange }}>
              <Send size={15} /> Send
            </button>
            {sent && (
              <div className="flex items-center gap-2 text-sm" style={{ color: COLORS.darkTeal }}>
                <CheckCircle2 size={16} /> Your message was received — we'll get back to you shortly.
              </div>
            )}
          </form>

          <div className="rounded-2xl p-6 space-y-5" style={{ backgroundColor: COLORS.lightTeal }}>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: COLORS.darkTeal }}>Team</div>
              <a href="mailto:info@gfpr.org" className="text-sm font-medium flex items-center gap-1.5" style={{ color: COLORS.darkTeal }}>info@gfpr.org</a>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: COLORS.darkTeal }}>Arıkan Lab</div>
              <a href="mailto:arikanlab@example.edu" className="text-sm font-medium flex items-center gap-1.5" style={{ color: COLORS.darkTeal }}>arikanlab@example.edu</a>
              <a href="https://arikanlab.com/" target="_blank" rel="noreferrer" className="text-sm font-medium flex items-center gap-1.5 mt-1" style={{ color: COLORS.darkTeal }}>
                arikanlab.com <ExternalLink size={12} />
              </a>
            </div>
            <p className="text-xs pt-2" style={{ color: COLORS.darkTeal, opacity: 0.85 }}>
              For publication and data-use terms, see the citation details on the "About GFPR" page.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 13) FOOTER
// ============================================================================
function Footer({ setPage }) {
  return (
    <footer style={{ backgroundColor: COLORS.darkTeal }} className="text-white">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-sm" style={{ fontFamily: FONT_MONO, color: COLORS.lightTeal }}>
          © {new Date().getFullYear()} GFPR — Global Food Plasmidome Resource
        </span>
        <div className="flex gap-4 text-sm">
          {NAV_ITEMS.map((n) => (
            <button key={n.key} onClick={() => setPage(n.key)} style={{ color: COLORS.lightTeal }}>{n.label}</button>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ============================================================================
// 14) APP SHELL (DEFAULT EXPORT)
// ============================================================================
export default function GFPRWebsite() {
  const [page, setPage] = useState("home");
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [pendingFilter, setPendingFilter] = useState(null);

  const showNotice = (msg) => {
    setNotice(msg);
    window.clearTimeout(showNotice._t);
    showNotice._t = window.setTimeout(() => setNotice(null), 3200);
  };

  const handleSetPage = (p) => {
    setPendingFilter(null);
    setPage(p);
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  const goToDataFiltered = (filter) => {
    setPendingFilter(filter);
    setPage("data");
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  const openSample = (id) => {
    setSelectedRecordId(id);
    setPage("sampleDetail");
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };
  const backToData = () => handleSetPage("data");

  let PageComponent;
  if (page === "home") PageComponent = <HomePage setPage={handleSetPage} />;
  else if (page === "about") PageComponent = <AboutPage onNavigate={goToDataFiltered} />;
  else if (page === "data") PageComponent = <DataAccessPage onMockAction={showNotice} onOpenSample={openSample} initialFilter={pendingFilter} />;
  else if (page === "sampleDetail") {
    PageComponent = <SampleDetailPage recordId={selectedRecordId} onBack={backToData} onMockAction={showNotice} />;
  } else if (page === "analysis") PageComponent = <AnalysisPage onMockAction={showNotice} />;
  else if (page === "contact") PageComponent = <ContactPage onMockAction={showNotice} />;

  const activeTab = page === "sampleDetail" ? "data" : page;

  return (
    <div className="w-full min-h-screen" style={{ fontFamily: FONT_BODY, background: `linear-gradient(135deg, #F7FBFA 0%, ${COLORS.paperWarm} 100%)` }}>
      <GlobalStyles />
      <Masthead />
      <TabBar page={activeTab} setPage={handleSetPage} />
      {PageComponent}
      <Footer setPage={handleSetPage} />
      {notice && <MockNotice message={notice} onClose={() => setNotice(null)} />}
    </div>
  );
}
