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
// REVISION NOTES (this pass — frontend-only, no backend touched)
//   - Analysis page removed entirely (nav item, home card, routing branch).
//     A new "Raw Data" tab takes its place in the nav: a By Category / By
//     Country toggle backed by GET /api/raw-data/links, rendered as a
//     simple grid of buttons that open the matching Zenodo record in a new
//     tab.
//   - Sample detail page: the mock "FASTA Preview" box is gone. In its
//     place, the right-hand column now always shows a "Download Raw Files
//     (Zenodo)" button (above the existing Downloads card) that links to
//     GET /api/raw-data/links's byCategory[record.category].
//   - Figure A (RibbonChord / buildChordLayout): category block angular
//     width still reflects each category's absolute total hit count
//     (unchanged), but the ribbon thickness leaving a category block is now
//     explicitly computed as that category's internal percentage share
//     (0–100%) rather than an absolute count, so small categories always
//     fill their own block edge-to-edge instead of being visually crushed.
//   - RadialTaxonomy: mock CLADO_NODES/PHYLA constants removed; the
//     component now fetches GET /api/stats/taxonomy on mount and follows
//     the same loading/error pattern as CategoryBarChart / WorldHeatMap.
//   - DataAccessPage: the "Metadata (CSV)" and "Download Files" toolbar
//     buttons now POST to /api/downloads/export and stream back a real
//     blob download instead of calling onMockAction.
//   - Everything else (colors, fonts, HomePage/AboutPage body copy,
//     CategoryBarChart, WorldHeatMap, small UI pieces) is untouched.
// ============================================================================

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
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
  Maximize2,
  RotateCcw as ResetIcon,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";

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

// POST /api/downloads/export doesn't return JSON — it streams back a zip
// blob, so it needs its own helper (raw fetch, no apiPost/json parsing) that
// triggers a browser download via a temporary <a> element.
async function apiPostBlobDownload(path, body, downloadName) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadName || "download.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
// 1c) FIGURE CARD — tam ekran wrapper
// ============================================================================
function FigureCard({ children, className = "", style = {} }) {
  const ref = useRef(null);
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const handler = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      ref.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <div
      ref={ref}
      className={`relative rounded-2xl ${className}`}
      style={{
        backgroundColor: "#fff",
        border: `1px solid ${COLORS.line}`,
        ...(isFs ? { overflow: "auto", padding: "1.5rem" } : {}),
        ...style,
      }}
    >
      <button
        onClick={toggleFullscreen}
        title={isFs ? "Tam ekrandan çık" : "Tam ekran"}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 10,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: COLORS.inkSoft,
          opacity: 0.6,
          padding: 4,
          borderRadius: 6,
          lineHeight: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
      >
        <Maximize2 size={15} />
      </button>
      {children}
    </div>
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

// Full country names keyed by ISO3 code — mirrors backend/src/config/countries.js
const COUNTRY_FULL_NAMES = {
  ITA: "Italy", TUR: "Türkiye", FRA: "France", DEU: "Germany", GBR: "United Kingdom",
  NLD: "Netherlands", POL: "Poland", USA: "United States of America", MEX: "Mexico", BRA: "Brazil",
  CHN: "China", JPN: "Japan", KOR: "South Korea", IND: "India", THA: "Thailand",
  VNM: "Vietnam", EGY: "Egypt", NGA: "Nigeria", KEN: "Kenya", AUS: "Australia",
  ESP: "Spain", GRC: "Greece", NOR: "Norway", PRT: "Portugal", BEL: "Belgium",
  CHE: "Switzerland", AUT: "Austria", SWE: "Sweden", DNK: "Denmark", FIN: "Finland",
  IRL: "Ireland", CAN: "Canada", ARG: "Argentina", CHL: "Chile", ZAF: "South Africa",
  RUS: "Russia", UKR: "Ukraine", ROU: "Romania", HUN: "Hungary", CZE: "Czechia",
  SVK: "Slovakia", HRV: "Croatia", SRB: "Serbia", BGR: "Bulgaria", IDN: "Indonesia",
  MYS: "Malaysia", PHL: "Philippines", SGP: "Singapore", NZL: "New Zealand",
  ISR: "Israel", SAU: "Saudi Arabia", ARE: "United Arab Emirates", PAK: "Pakistan",
  BGD: "Bangladesh", ETH: "Ethiopia", MAR: "Morocco", TUN: "Tunisia", DZA: "Algeria",
  COL: "Colombia", PER: "Peru", ECU: "Ecuador", URY: "Uruguay", CRI: "Costa Rica",
};


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

// Annotation keys exactly as accepted by POST /api/downloads/export's
// `include.annotations` field, per the API contract. This intentionally
// does NOT reuse ANNOTATIONS' keys above 1:1 (that list has extra/renamed
// entries like "acp" and "pfam_kegg" that the export endpoint doesn't
// recognize) — this is the literal whitelist for export requests.
const EXPORT_ANNOTATION_KEYS = ["amr", "cazyme", "cgc", "crispr_cas", "amp", "pfam_ko"];

// ============================================================================
// 4) NAVIGATION
// ============================================================================
const NAV_ITEMS = [
  { key: "home", label: "Home" },
  { key: "about", label: "About GFPR" },
  { key: "data", label: "Data Access" },
  { key: "rawdata", label: "Raw Data" },
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
    key: "rawdata",
    title: "Raw Data",
    teaser: "Direct links to Zenodo raw sequencing archives.",
    desc:
      "Jump straight to the raw sequencing data archived on Zenodo, browseable by food category or by country of origin. No filters needed — grab an entire category's reads in one click. Click to explore.",
    image: "/images/card-data-table.jpg",
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

// ---- 9.1 Radial phylogeny (GERÇEK VERİ) ------------------------------------
// The API (GET /api/stats/taxonomy) returns a flat list of
// { id, level(0-3), label, parentId, phylumId } — the exact same shape the
// old mock CLADO_NODES used, just with `parentId` instead of `parent` and no
// per-phylum color. Colors are assigned locally from a fixed palette, keyed
// by phylumId, in the order phyla appear in the fetched data.
const PHYLUM_COLOR_PALETTE = [
  COLORS.darkTeal, COLORS.orange, COLORS.medTeal, COLORS.berry,
  COLORS.deepOrange, COLORS.yellow, "#4D8080", "#8FA6A0",
];

function RadialTaxonomy({ onSeeSamples }) {
  const [hoverPhylum, setHoverPhylum] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodes, setNodes] = useState(null);
  const [error, setError] = useState(null);
  // Zoom/pan state for hover zoom
  const [zoom, setZoom] = useState(1);
  const [zoomCenter, setZoomCenter] = useState({ cx: 380, cy: 380 });
  const svgContainerRef = useRef(null);
  const zoomTimerRef = useRef(null);

  useEffect(() => {
    apiGet("/api/stats/taxonomy").then(setNodes).catch((e) => setError(e.message));
  }, []);

  const size = 760;
  const cx = size / 2, cy = size / 2;
  const radii = { 0: 60, 1: 135, 2: 205, 3: 255 };

  // Scroll zoom handler
  useEffect(() => {
    const el = svgContainerRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      e.preventDefault();
      setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.2 : 1 / 1.2), 1, 5));
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [nodes]);

  const handleMouseEnterSvg = () => {
    zoomTimerRef.current = setTimeout(() => setZoom(2.5), 100);
  };
  const handleMouseLeaveSvg = () => {
    clearTimeout(zoomTimerRef.current);
    setZoom(1);
  };

  // Compute SVG viewBox based on zoom
  const svgViewW = size / zoom;
  const svgViewH = size / zoom;
  const svgVX = clamp(zoomCenter.cx - svgViewW / 2, 0, size - svgViewW);
  const svgVY = clamp(zoomCenter.cy - svgViewH / 2, 0, size - svgViewH);

  const nodeById = useMemo(() => Object.fromEntries((nodes || []).map((n) => [n.id, n])), [nodes]);

  const phylumColors = useMemo(() => {
    if (!nodes) return {};
    const phyla = nodes.filter((n) => n.level === 0);
    const map = {};
    phyla.forEach((p, i) => { map[p.id] = PHYLUM_COLOR_PALETTE[i % PHYLUM_COLOR_PALETTE.length]; });
    return map;
  }, [nodes]);

  const angleById = useMemo(() => {
    if (!nodes) return {};
    const childrenOf = {};
    nodes.forEach((n) => { if (n.parentId) (childrenOf[n.parentId] = childrenOf[n.parentId] || []).push(n.id); });
    const leaves = nodes.filter((n) => n.level === 3);
    if (leaves.length === 0) return {};
    const step = 360 / leaves.length;
    const angles = {};
    leaves.forEach((leaf, i) => { angles[leaf.id] = i * step; });
    [2, 1, 0].forEach((lvl) => {
      nodes.filter((n) => n.level === lvl).forEach((n) => {
        const kids = childrenOf[n.id] || [];
        if (kids.length) angles[n.id] = kids.reduce((s, k) => s + angles[k], 0) / kids.length;
      });
    });
    return angles;
  }, [nodes]);

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
    <FigureCard className="p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <GitBranch size={16} style={{ color: COLORS.darkTeal }} />
          <span className="text-sm font-semibold" style={{ color: COLORS.darkTeal, fontFamily: FONT_BODY }}>
            Host Phylogeny (Phylum → Family)
          </span>
        </div>
        {nodes && (
          <span className="text-[11px] flex items-center gap-1 mr-6" style={{ color: COLORS.inkSoft }}>
            <ZoomIn size={11} /> Hover to zoom · scroll to adjust
          </span>
        )}
      </div>

      {error && <ErrorBlock message={error} />}
      {!error && !nodes && <LoadingBlock />}
      {!error && nodes && (
        <>
          <div
            ref={svgContainerRef}
            onMouseEnter={handleMouseEnterSvg}
            onMouseLeave={handleMouseLeaveSvg}
            onMouseMove={(e) => {
              const rect = svgContainerRef.current?.getBoundingClientRect();
              if (!rect) return;
              const relX = (e.clientX - rect.left) / rect.width;
              const relY = (e.clientY - rect.top) / rect.height;
              setZoomCenter({ cx: relX * size, cy: relY * size });
            }}
            style={{ touchAction: "none", userSelect: "none" }}
          >
            <svg
              viewBox={`${svgVX} ${svgVY} ${svgViewW} ${svgViewH}`}
              className="w-full"
              style={{
                maxHeight: 520,
                cursor: zoom > 1 ? "zoom-out" : "zoom-in",
                transition: "all 0.35s ease",
              }}
            >
              {nodes.filter((n) => n.parentId).map((n) => {
                const parent = nodeById[n.parentId];
                if (!parent) return null;
                const dim = hoverPhylum && n.phylumId !== hoverPhylum;
                return (
                  <path
                    key={`e-${n.id}`}
                    d={edgePath(parent, n)}
                    fill="none"
                    stroke={phylumColors[n.phylumId]}
                    strokeWidth={dim ? 1 : 1.6}
                    opacity={dim ? 0.15 : 0.7}
                  />
                );
              })}
              {nodes.map((n) => {
                const r = radii[n.level];
                const angle = angleById[n.id];
                const [x, y] = polar(r, angle);
                const color = phylumColors[n.phylumId];
                const dim = hoverPhylum && n.phylumId !== hoverPhylum;
                // Yazıyı radyal yöne döndür — sol yarıda 180° flip, sağda düz
                const leftHalf = angle > 90 && angle < 270;
                const rotAngle = leftHalf ? angle - 90 + 180 : angle - 90;
                // Zoom'da daha fazla label göster
                const showLabel = zoom >= 1.8 || n.level === 0;
                const labelOffset = n.level === 0 ? 12 : 9;
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
                    {showLabel && (
                      <text
                        transform={`translate(${x},${y}) rotate(${rotAngle}) translate(${labelOffset},0)`}
                        textAnchor={leftHalf ? "end" : "start"}
                        dominantBaseline="middle"
                        fontSize={n.level === 0 ? 11 : 9}
                        fontWeight={n.level === 0 || selectedNode?.id === n.id ? 700 : 400}
                        fill={n.level === 0 ? COLORS.ink : COLORS.inkSoft}
                        fontFamily={FONT_BODY}
                      >
                        {n.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap mt-2">
            <p className="text-xs" style={{ color: COLORS.inkSoft }}>
              Hover to zoom in · scroll to adjust zoom level · click any node to select it.
            </p>
            {selectedNode && (
              <button
                onClick={() => onSeeSamples({ type: "host_taxonomy", value: selectedNode.label })}
                className="inline-flex items-center gap-1 text-xs font-semibold shrink-0"
                style={{ color: COLORS.orange }}
              >
                See {selectedNode.label} samples <ArrowRight size={12} />
              </button>
            )}
          </div>
        </>
      )}
    </FigureCard>
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
    <FigureCard className="p-5">
      <div className="flex items-center gap-2 mb-4 mr-6">
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
    </FigureCard>
  );
}

const ANNOTATION_COLORS = {
  amr: "#3861ED",       // Antimicrobial Resistance (blue)
  cazyme: "#1A9C96",    // CAZyme (teal)
  cgc: "#F28C28",       // CGC (orange)
  crispr: "#7029F0",    // CRISPR (purple)
  amp: "#8A2BE2",       // AMP (violet)
  acp: "#FF1493",       // ACP (pink)
  pfam_kegg: "#059033", // Pfam/KO (green)
};

function buildChordLayout(categories, targets, gapDeg = 3) {
  const catStart = 90, catEnd = 270;
  const tgtStart = -80, tgtEnd = 80;

  // 1) Normalize the matrix (Math.pow to boost small values, and ignore 0)
  const matrix = categories.map(c => {
    return targets.map(t => {
      const v = c.values[t.key] || 0;
      return v > 0 ? Math.pow(v, 0.4) : 0;
    });
  });

  const catTotals = matrix.map(row => row.reduce((a, b) => a + b, 0));
  const catTotalSum = catTotals.reduce((a, b) => a + b, 0) || 1;
  const catSpanTotal = catEnd - catStart - gapDeg * (categories.length - 1);
  
  let cursor = catStart;
  const catBlocks = categories.map((c, i) => {
    const span = (catTotals[i] / catTotalSum) * catSpanTotal;
    const block = { ...c, a0: cursor, a1: cursor + span, total: catTotals[i] || 1 };
    cursor += span + gapDeg;
    return block;
  });

  const tgtTotals = targets.map((t, j) => matrix.reduce((sum, row) => sum + row[j], 0));
  const tgtTotalSum = tgtTotals.reduce((a, b) => a + b, 0) || 1;
  const tgtSpanTotal = tgtEnd - tgtStart - gapDeg * (targets.length - 1);
  
  cursor = tgtStart;
  const tgtBlocks = targets.map((t, j) => {
    const span = (tgtTotals[j] / tgtTotalSum) * tgtSpanTotal;
    const block = { ...t, a0: cursor, a1: cursor + span, total: tgtTotals[j] || 1 };
    cursor += span + gapDeg;
    return block;
  });

  const ribbons = [];
  // To avoid crossing, target endpoints must be assigned in REVERSE order of categories
  const tgtRunning = tgtBlocks.map(b => b.a1); 

  catBlocks.forEach((cat, i) => {
    let a = cat.a0;
    targets.forEach((t, j) => {
      const v = matrix[i][j];
      if (v <= 0) return;
      
      const srcSpan = (v / cat.total) * (cat.a1 - cat.a0);
      const tgtSpan = (v / tgtBlocks[j].total) * (tgtBlocks[j].a1 - tgtBlocks[j].a0);
      
      tgtRunning[j] -= tgtSpan;
      
      ribbons.push({
        catKey: cat.key,
        targetKey: t.key,
        color: ANNOTATION_COLORS[t.key] || "#999", // Color by annotation!
        srcA0: a,
        srcA1: a + srcSpan,
        tgtA0: tgtRunning[j],
        tgtA1: tgtRunning[j] + tgtSpan,
      });
      
      a += srcSpan;
    });
  });

  return { catBlocks, tgtBlocks, ribbons };
}

function RibbonChord({ onSeeSamples }) {
  const [hoverCat, setHoverCat] = useState(null);
  const [hoverTgt, setHoverTgt] = useState(null);
  const [selected, setSelected] = useState(null);
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState(null);
  const width = 900, height = 700;
  const cx = 450, cy = 350;
  const R = 230, outerR = 245, labelR = 260;

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
    // Cubic bezier curves to origin (cx,cy) for smooth ribbon flow without sharp corners
    return `M ${x1},${y1} A ${R},${R} 0 ${largeA} 1 ${x2},${y2} C ${cx},${cy} ${cx},${cy} ${x3},${y3} A ${R},${R} 0 ${largeB} 1 ${x4},${y4} C ${cx},${cy} ${cx},${cy} ${x1},${y1} Z`;
  };

  if (error) return <FigureCard className="p-5 lg:col-span-2"><ErrorBlock message={error} /></FigureCard>;
  if (!raw) return <FigureCard className="p-5 lg:col-span-2"><LoadingBlock /></FigureCard>;

  return (
    <FigureCard className="p-5 lg:col-span-2">
      <div className="flex items-center gap-2 mb-1 mr-6">
        <Waves size={16} style={{ color: COLORS.darkTeal }} />
        <span className="text-sm font-semibold" style={{ color: COLORS.darkTeal, fontFamily: FONT_BODY }}>
          Category to Functional Annotation Flow
        </span>
      </div>
      <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>
        Ribbon width is normalized (Math.pow(0.4)) to ensure all food categories and annotations remain clearly visible regardless of vast sample count differences. Ribbon color reflects the TARGET annotation. Click an arc to select it.
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: "75vh" }}>
        {ribbons.map((r, i) => {
          const dimmed = (hoverCat && hoverCat !== r.catKey) || (hoverTgt && hoverTgt !== r.targetKey);
          return (
            <path
              key={i}
              d={ribbonPath(r.srcA0, r.srcA1, r.tgtA0, r.tgtA1)}
              fill={r.color}
              opacity={dimmed ? 0.05 : ((hoverCat === r.catKey || hoverTgt === r.targetKey) ? 0.85 : 0.45)}
              style={{ transition: "opacity 0.25s ease" }}
            />
          );
        })}
        
        {/* Source Categories (Food) */}
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
              <path d={arcPath(R + 2, outerR, b.a0, b.a1)} fill={b.color} stroke="#fff" strokeWidth={0.5} />
              <text
                transform={`translate(${lx},${ly}) rotate(${leftHalf ? mid - 270 : mid - 90})`}
                textAnchor={leftHalf ? "end" : "start"}
                dominantBaseline="middle"
                fontSize={isSel ? 10 : 9}
                fontWeight={isSel ? 700 : 500}
                fill={COLORS.ink}
                fontFamily={FONT_BODY}
              >
                {b.label}
              </text>
            </g>
          );
        })}

        {/* Target Annotations (Functions) */}
        {tgtBlocks.map((b) => {
          const mid = (b.a0 + b.a1) / 2;
          const [lx, ly] = polar(labelR, mid);
          const leftHalf = mid > 90 && mid < 270;
          const isSel = selected?.type === "annotation" && selected.key === b.key;
          const tColor = ANNOTATION_COLORS[b.key] || "#999";
          return (
            <g
              key={b.key}
              onMouseEnter={() => setHoverTgt(b.key)}
              onMouseLeave={() => setHoverTgt(null)}
              onClick={() => setSelected({ type: "annotation", key: b.key, label: b.label })}
              style={{ cursor: "pointer" }}
            >
              <path d={arcPath(R + 2, outerR, b.a0, b.a1)} fill={tColor} stroke="#fff" strokeWidth={0.5} />
              <text
                transform={`translate(${lx},${ly}) rotate(${leftHalf ? mid - 270 : mid - 90})`}
                textAnchor={leftHalf ? "end" : "start"}
                dominantBaseline="middle"
                fontSize={isSel ? 11 : 10}
                fontWeight={isSel ? 700 : 500}
                fill={tColor}
                fontFamily={FONT_BODY}
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      {selected && (
        <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: `1px solid ${COLORS.paperAlt}` }}>
          <span className="text-xs" style={{ color: COLORS.inkSoft }}>Selected: <strong style={{ color: COLORS.ink }}>{selected.label}</strong></span>
          <button onClick={() => onSeeSamples({ type: selected.type, value: selected.type === "category" ? selected.key : selected.label })} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: COLORS.orange }}>
            See {selected.label} samples <ArrowRight size={12} />
          </button>
        </div>
      )}
    </FigureCard>
  );
}


// ---- 9.4 World sample map — react-simple-maps tabanlı ülke renklendirme ----
// Sample sayısı arttıkça soluk yeşilden turtuncuya kayar.
// Dominant category modunda ülke o kategorinin rengiyle boyanır.
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ISO numeric → ISO3 dönüşüm tablosu (react-simple-maps numeric ID kullanır)
// Backend centroidFor() ISO3 döndürüyor, bu yüzden label eşleştirme için
// yeterli olduğundan; harita verisiyle API verisini label üzerinden birleştiriyoruz.
// Backend /api/stats/map zaten label (ülke adı) döndürüyor.

function sampleCountColor(count, maxCount) {
  if (!count || !maxCount) return "#d1e8d1"; // no data - pale green
  // Use log scale (Math.log) or square root to normalize color distribution
  // because maxCount is huge compared to average count, leading to poor contrast.
  const normCount = Math.pow(count, 0.35);
  const normMax = Math.pow(maxCount, 0.35);
  const t = Math.min(1, normCount / normMax);
  
  if (t < 0.25)  return `hsl(${120 - t * 40}, 40%, ${82 - t * 15}%)`;
  if (t < 0.55)  return `hsl(${120 - t * 80}, 50%, ${70 - t * 20}%)`;
  if (t < 0.80)  return `hsl(${40 - t * 10}, 75%, ${55 - t * 5}%)`;
  return COLORS.orange;
}

function WorldHeatMap({ onSeeSamples }) {
  const [mode, setMode] = useState("count");
  const [active, setActive] = useState(null);
  const [locked, setLocked] = useState(false);
  const [mapPoints, setMapPoints] = useState(null);
  const [error, setError] = useState(null);
  const [position, setPosition] = useState({ coordinates: [0, 20], zoom: 1 });

  useEffect(() => {
    apiGet("/api/stats/map")
      .then((rows) => setMapPoints(rows.filter((r) => r.lat !== null && r.lon !== null)))
      .catch((e) => setError(e.message));
  }, []);

  const maxCount = useMemo(
    () => (mapPoints?.length ? Math.max(...mapPoints.map((p) => p.count)) : 1),
    [mapPoints]
  );

  const byLabel = useMemo(() => {
    if (!mapPoints) return {};
    const m = {};
    for (const p of mapPoints) m[p.label] = p;
    return m;
  }, [mapPoints]);

  const [countryDetails, setCountryDetails] = useState(null);

  const selectPoint = (p) => { 
    setActive(p); 
    setLocked(true); 
    setCountryDetails(null);
    apiGet(`/api/stats/country/${encodeURIComponent(p.label)}`)
      .then(res => setCountryDetails(res.dominantAnnotations))
      .catch(console.error);
  };
  const handleZoomIn = () => {
    if (position.zoom >= 8) return;
    setPosition(pos => ({ ...pos, zoom: pos.zoom * 1.5 }));
  };
  
  const handleZoomOut = () => {
    if (position.zoom <= 1) return;
    setPosition(pos => ({ ...pos, zoom: pos.zoom / 1.5 }));
  };
  
  const handleReset = () => {
    setPosition({ coordinates: [0, 20], zoom: 1 });
  };
  
  const handleMoveEnd = (position) => {
    setPosition(position);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  return (
    <FigureCard className="p-5 lg:col-span-2">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2 mr-6">
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
            <button onClick={handleZoomIn} className="p-1.5 rounded-md" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.darkTeal }} title="Zoom in"><ZoomIn size={14} /></button>
            <button onClick={handleZoomOut} className="p-1.5 rounded-md" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.darkTeal }} title="Zoom out"><ZoomOut size={14} /></button>
            <button onClick={handleReset} className="p-1.5 rounded-md" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.darkTeal }} title="Reset view"><RotateCcw size={14} /></button>
          </div>
        </div>
      </div>

      {error && <ErrorBlock message={error} />}
      {!error && !mapPoints && <LoadingBlock />}
      {!error && mapPoints && (
        <div className="flex flex-col h-full">
          <div className="flex-1" style={{ borderRadius: 12, overflow: "hidden", backgroundColor: "#c8dce0", minHeight: 400 }} onWheel={handleWheel}>
            <ComposableMap
              projectionConfig={{ scale: 147 }}
              style={{ width: "100%", height: "100%", maxHeight: "75vh" }}
            >
              <ZoomableGroup
                zoom={position.zoom}
                center={position.coordinates}
                onMoveEnd={handleMoveEnd}
              >
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const name = geo.properties.name;
                      const point = byLabel[name];
                      let fill = "#ddeee8"; // no data - light neutral
                      if (point) {
                        fill = mode === "count"
                          ? sampleCountColor(point.count, maxCount)
                          : catColor(point.category);
                      }
                      const isActive = active && active.label === name;
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={fill}
                          stroke="#fff"
                          strokeWidth={0.4 / position.zoom}
                          style={{
                            default: { outline: "none", opacity: point ? 1 : 0.65 },
                            hover: { outline: "none", opacity: 0.85, cursor: point ? "pointer" : "default" },
                            pressed: { outline: "none" },
                          }}
                          onMouseEnter={() => { if (point && !locked) setActive(point); }}
                          onMouseLeave={() => { if (!locked) setActive(null); }}
                          onClick={() => { if (point) selectPoint(point); }}
                          className={isActive ? "country-active" : ""}
                        />
                      );
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>
          </div>

          <div className="mt-2 shrink-0">
            {/* Color scale legend */}
            {mode === "count" && (
              <div className="flex items-center gap-2">
                <span className="text-[10px]" style={{ color: COLORS.inkSoft }}>Low</span>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: "linear-gradient(to right, #a8d5a2, #539E9E, #EB7F00)", maxWidth: 180 }} />
                <span className="text-[10px]" style={{ color: COLORS.inkSoft }}>High</span>
              </div>
            )}

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
                  {locked && countryDetails && Object.keys(countryDetails).length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs mt-1" style={{ color: COLORS.inkSoft }}>
                      {Object.entries(countryDetails).map(([key, info]) => {
                        let displayName = key;
                        if (key === 'taxonomy') displayName = 'Species';
                        else if (ANNOTATIONS.find(a => a.key === key)) displayName = ANNOTATIONS.find(a => a.key === key).label;
                        return (
                          <div key={key} className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border">
                            <span className="font-semibold">{displayName}:</span>
                            <span className="truncate max-w-[120px]" title={info.label}>{info.label}</span>
                            <span className="opacity-70 text-[10px]">({info.count})</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {locked && !countryDetails && (
                    <div className="text-xs mt-1 text-gray-400">Loading dominant traits...</div>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                  <button onClick={() => onSeeSamples({ type: "country", value: active.label })} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: COLORS.orange }}>
                    See {active.label} samples <ArrowRight size={12} />
                  </button>
                  {locked && <button onClick={() => { setActive(null); setLocked(false); }} className="text-xs" style={{ color: COLORS.inkSoft }}>Clear</button>}
                </div>
              </>
            ) : (
              <span className="text-xs" style={{ color: COLORS.inkSoft }}>
                Hover or click a country to see sample info. Sample count → color (low = pale green, high = orange).
              </span>
            )}
            </div>
          </div>
        </div>
      )}
    </FigureCard>
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
  // host_taxonomy filtresi: RadialTaxonomy node tıklamasından geliyor
  const [hostTaxQuery, setHostTaxQuery] = useState(() => (initialFilter?.type === "host_taxonomy" ? initialFilter.value : ""));
  const [selectedIds, setSelectedIds] = useState([]);
  const [exporting, setExporting] = useState(false);

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
      hostTaxonomy: hostTaxQuery || undefined,
      page,
      pageSize,
    })
      .then((res) => {
        setRows(res.results);
        setTotal(res.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedCats, selectedTypes, selectedSubtypes, selectedCountries, selectedYears, fermentFilter, query, hostTaxQuery, page]);

  // Herhangi bir filtre değişince 1. sayfaya dön
  useEffect(() => { setPage(1); }, [selectedCats, selectedTypes, selectedSubtypes, selectedCountries, selectedYears, fermentFilter, query, hostTaxQuery]);

  const toggle = (setFn) => (val) => setFn((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));
  const toggleId = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const pageIds = rows.map(r => r.id);
  const allSelectedOnPage = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));
  const handleSelectAll = () => {
    if (allSelectedOnPage) {
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...pageIds])]);
    }
  };

  // Tüm filtreleri sıfırla
  const resetAllFilters = () => {
    setSelectedCats([]);
    setSelectedTypes([]);
    setSelectedSubtypes([]);
    setSelectedCountries([]);
    setSelectedYears([]);
    setSelectedAnnotations([]);
    setFermentFilter(null);
    setQuery("");
    setHostTaxQuery("");
    setSelectedIds([]);
  };

  const hasAnyFilter = selectedCats.length > 0 || selectedTypes.length > 0 || selectedSubtypes.length > 0
    || selectedCountries.length > 0 || selectedYears.length > 0 || selectedAnnotations.length > 0
    || fermentFilter !== null || query !== "" || hostTaxQuery !== "";


  
  // Gerçek POST /api/downloads/export'a bağlı indirme. selectedIds varsa
  // sadece o örnekler için, yoksa boş dizi (= geçerli filtreye göre "tümü")
  // gönderilir. `annotationKeys`: Metadata (CSV) butonu için [], Download
  // Files butonu için export sözleşmesindeki TÜM anotasyon anahtarları.
  const runExport = async (annotationKeys) => {
    setExporting(true);
    try {
      await apiPostBlobDownload(
        "/api/downloads/export",
        {
          sampleIds: selectedIds,
          include: { metadata: true, annotations: annotationKeys },
        },
        "gfpr-export.zip"
      );
    } catch (e) {
      onMockAction(`İndirme başarısız oldu: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

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
              {hasAnyFilter && (
                <button
                  onClick={resetAllFilters}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors flex items-center gap-1 hover:bg-gray-50"
                  style={{ color: COLORS.orange, borderColor: COLORS.orange, fontFamily: FONT_BODY }}
                >
                  <RotateCcw size={12} /> Clear all filters
                </button>
              )}
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
                options={filterOptions.countries.map((c) => ({
                  value: c,
                  label: COUNTRY_FULL_NAMES[c] || c,
                }))}
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
              onClick={() => runExport([])}
              disabled={exporting}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-60"
              style={{ backgroundColor: COLORS.lightTeal, color: COLORS.darkTeal }}
            >
              <Download size={13} /> {exporting ? "Preparing..." : "Metadata (CSV)"}
            </button>
            <button
              onClick={() => runExport(EXPORT_ANNOTATION_KEYS)}
              disabled={exporting}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white disabled:opacity-60"
              style={{ backgroundColor: COLORS.orange }}
            >
              <Download size={13} /> {exporting ? "Preparing..." : "Download Files"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${COLORS.line}` }}>
          <table className="w-full text-sm" style={{ fontFamily: FONT_BODY }}>
            <thead>
              <tr style={{ backgroundColor: COLORS.darkTeal }}>
                <th className="w-8 py-2.5 px-3 text-center">
                  <input type="checkbox" checked={allSelectedOnPage} onChange={handleSelectAll} style={{ accentColor: COLORS.orange }} />
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-white" style={{ fontFamily: FONT_MONO }}>ID</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-white">Category</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-white">Country</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-white">Type</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-white">Date</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7}><LoadingBlock /></td></tr>
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

const GENE_TYPE_COLORS = {
  CAZyme: "#2A7B7B",
  GH: "#2A7B7B",
  GT: "#539E9E",
  PL: "#27AE60",
  CE: "#F39C12",
  CBM: "#3498DB",
  TC: "#EB7F00",
  TF: "#E74C3C",
  STP: "#9B59B6",
  Other: "#7F8C8D"
};

function getGeneColor(gene) {
  if (gene.category && GENE_TYPE_COLORS[gene.category]) return GENE_TYPE_COLORS[gene.category];
  if (gene.cazy_category && GENE_TYPE_COLORS[gene.cazy_category]) return GENE_TYPE_COLORS[gene.cazy_category];
  if (gene.gene_type && GENE_TYPE_COLORS[gene.gene_type]) return GENE_TYPE_COLORS[gene.gene_type];
  return GENE_TYPE_COLORS.Other;
}

function CgcGeneDiagram({ genes }) {
  if (!genes || genes.length === 0) return null;

  const clusters = useMemo(() => {
    const map = {};
    for (const g of genes) {
      const key = g.cgc_num || (g.contig_id ? `Contig ${g.contig_id}` : "Cluster 1");
      if (!map[key]) map[key] = [];
      map[key].push(g);
    }
    return map;
  }, [genes]);

  const legendItems = useMemo(() => {
    const types = new Set();
    for (const g of genes) {
      const label = g.category || g.cazy_category || g.gene_type || "Other";
      types.add(label);
    }
    return Array.from(types).map((t) => ({
      label: t,
      color: GENE_TYPE_COLORS[t] || GENE_TYPE_COLORS.Other,
    }));
  }, [genes]);

  return (
    <div className="mt-3 space-y-4">
      {Object.entries(clusters).map(([clusterName, clusterGenes]) => {
        const starts = clusterGenes.map((g) => g.gene_start ?? g.cluster_start ?? 0).filter((v) => v !== null);
        const stops = clusterGenes.map((g) => g.gene_stop ?? g.cluster_end ?? 1000).filter((v) => v !== null);
        const minBp = Math.min(...starts, 0);
        const maxBp = Math.max(...stops, 1000);
        const span = Math.max(maxBp - minBp, 1);

        const svgWidth = 560;
        const rowHeight = 36;
        const paddingX = 45;
        const availableWidth = svgWidth - paddingX * 2;

        return (
          <div key={clusterName} className="p-3.5 rounded-xl border" style={{ backgroundColor: COLORS.paperAlt, borderColor: COLORS.line }}>
            <div className="flex items-center justify-between text-xs font-semibold mb-2" style={{ color: COLORS.darkTeal, fontFamily: FONT_MONO }}>
              <span>{clusterName}</span>
              <span className="text-[11px] font-normal" style={{ color: COLORS.inkSoft }}>
                {minBp.toLocaleString()} bp – {maxBp.toLocaleString()} bp (span: {span.toLocaleString()} bp)
              </span>
            </div>

            <div className="overflow-x-auto">
              <svg viewBox={`0 0 ${svgWidth} ${clusterGenes.length * rowHeight + 30}`} className="w-full text-xs" style={{ minWidth: 440, height: "auto" }}>
                {/* Coordinate Backbone */}
                <line x1={paddingX} y1={18} x2={svgWidth - paddingX} y2={18} stroke={COLORS.line} strokeWidth={2} strokeDasharray="3 3" />
                <text x={paddingX} y={11} fill={COLORS.inkSoft} fontSize={9.5} textAnchor="start" fontFamily={FONT_MONO}>{minBp} bp</text>
                <text x={svgWidth - paddingX} y={11} fill={COLORS.inkSoft} fontSize={9.5} textAnchor="end" fontFamily={FONT_MONO}>{maxBp} bp</text>

                {/* Gene Arrows */}
                {clusterGenes.map((g, idx) => {
                  const gStart = g.gene_start ?? minBp;
                  const gStop = g.gene_stop ?? maxBp;
                  const x1 = paddingX + ((Math.min(gStart, gStop) - minBp) / span) * availableWidth;
                  const x2 = paddingX + ((Math.max(gStart, gStop) - minBp) / span) * availableWidth;
                  const width = Math.max(x2 - x1, 26);
                  const y = 28 + idx * rowHeight;
                  const height = 18;
                  const isReverse = g.gene_strand === "-";
                  const color = getGeneColor(g);
                  const label = g.recommend_results || g.gene_annotation || g.gene_type || "Gene";

                  const arrowHead = Math.min(8, width / 2);
                  let path = "";
                  if (!isReverse) {
                    path = `M ${x1} ${y} L ${x2 - arrowHead} ${y} L ${x2} ${y + height / 2} L ${x2 - arrowHead} ${y + height} L ${x1} ${y + height} Z`;
                  } else {
                    path = `M ${x1 + arrowHead} ${y} L ${x2} ${y} L ${x2} ${y + height} L ${x1 + arrowHead} ${y + height} L ${x1} ${y + height / 2} Z`;
                  }

                  return (
                    <g key={idx} className="group cursor-pointer">
                      <title>{`${label}\nCoordinates: ${gStart} - ${gStop} bp (${g.gene_strand || "+"})\nType: ${g.gene_type || "-"}\nSubstrate: ${g.substrate || "-"}`}</title>
                      <path d={path} fill={color} stroke="#fff" strokeWidth={1.5} className="transition-opacity hover:opacity-85" />
                      <text x={isReverse ? x2 + 5 : x1 - 5} y={y + height / 2 + 3} fill={COLORS.inkSoft} fontSize={8.5} textAnchor={isReverse ? "start" : "end"} fontFamily={FONT_MONO}>
                        {gStart}..{gStop}
                      </text>
                      <text x={x1 + width / 2} y={y + height / 2 + 3.5} fill="#fff" fontSize={9} fontWeight={600} textAnchor="middle" className="pointer-events-none">
                        {label.length > 18 ? label.slice(0, 16) + "…" : label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 pt-1 border-t" style={{ borderColor: COLORS.paperAlt }}>
        <span className="text-[11px] font-semibold" style={{ color: COLORS.inkSoft }}>Gene Legend:</span>
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: item.color }} />
            <span style={{ color: COLORS.ink, fontSize: 11 }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SampleDetailPage({ recordId, onBack, onMockAction }) {
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(null);
  const [selectedDownloads, setSelectedDownloads] = useState([]);
  // Zenodo raw-data links (byCategory / byCountry) — fetched independently
  // of the sample record so the "Download Raw Files" button can resolve as
  // soon as both the record's category and this map are ready.
  const [exporting, setExporting] = useState(false);
  const [rawLinks, setRawLinks] = useState(null);

  useEffect(() => {
    apiGet("/api/raw-data/links").then(setRawLinks).catch(() => {
      // Sessizce yut — bu buton opsiyonel bir kısayol, sayfanın geri
      // kalanını bloklamamalı. Link çözülmezse buton devre dışı görünür.
    });
  }, []);

  useEffect(() => {
    setRecord(null);
    setError(null);
    if (!recordId) return;
    apiGet(`/api/samples/${encodeURIComponent(recordId)}`)
      .then((data) => {
        setRecord(data);
        setSelectedDownloads([...data.annotations.map((a) => a.key)]);
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

  const allKeys = [...record.annotations.map((a) => a.key)];
  const toggleDownload = (key) => setSelectedDownloads((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const toggleAllDownloads = () => setSelectedDownloads((prev) => (prev.length === allKeys.length ? [] : allKeys));

  const ANNOTATION_LABELS = {
    amr: "AMR & Stress Response Genes", cazyme: "CAZymes", cgc: "Cazyme Gene Cluster",
    crispr_cas: "CRISPR-Cas Systems", amp: "Antimicrobial Peptides", acp: "Anticancer Peptides",
    pfam_ko: "Pfam & KEGG KO",
  };

  const downloadItems = [
    ...record.annotations.map((a) => ({ key: a.key, label: ANNOTATION_LABELS[a.key] || a.key, sub: `${a.count} hit(s)` })),
  ];

  const annotationsToShow = record.annotations.filter((a) => selectedDownloads.includes(a.key));

  // Bu örneğin kategorisine karşılık gelen Zenodo linki. rawLinks henüz
  // yüklenmediyse ya da kategori eşleşmiyorsa buton devre dışı gösterilir.
  const rawFilesUrl = rawLinks?.byCategory?.[record.category];

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
                        {ANNOTATION_LABELS[a.key] || a.key} <em style={{ fontWeight: 400, color: COLORS.inkSoft, marginLeft: 4 }}>{a.count} hit{a.count !== 1 && "s"}</em>
                      </div>
                      {a.key === "cgc" && a.cgcGenes && a.cgcGenes.length > 0 ? (
                        <CgcGeneDiagram genes={a.cgcGenes} />
                      ) : (
                        <div className="mt-1 space-y-0.5">
                          {a.hits.length === 0 ? (
                            <div className="text-sm" style={{ color: COLORS.inkSoft }}>—</div>
                          ) : a.hits.map((h) => (
                            <div key={h} className="text-sm" style={{ fontWeight: 400, color: COLORS.inkSoft, fontFamily: FONT_BODY }}>
                              {h}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {/* Always-visible shortcut to this sample's raw Zenodo archive,
                keyed off record.category via GET /api/raw-data/links. */}
            <div className="rounded-2xl p-4" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}>
              <div className="text-sm font-semibold mb-2" style={{ color: COLORS.darkTeal }}>Raw Files</div>
              <a
                href={rawFilesUrl || undefined}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => { if (!rawFilesUrl) e.preventDefault(); }}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg text-white"
                style={{ backgroundColor: rawFilesUrl ? COLORS.darkTeal : "#c9c9c9", cursor: rawFilesUrl ? "pointer" : "default" }}
              >
                <ExternalLink size={14} /> Download Raw Files (Zenodo)
              </a>
              {!rawLinks && (
                <p className="text-[11px] mt-2" style={{ color: COLORS.inkSoft }}>Zenodo link is loading…</p>
              )}
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
                onClick={async () => {
                  setExporting(true);
                  try {
                    await apiPostBlobDownload(
                      "/api/downloads/export",
                      {
                        sampleIds: [record.id],
                        include: { metadata: true, annotations: selectedDownloads },
                      },
                      "gfpr-export.zip"
                    );
                  } catch (e) {
                    onMockAction(`İndirme başarısız oldu: ${e.message}`);
                  } finally {
                    setExporting(false);
                  }
                }}
                disabled={selectedDownloads.length === 0 || exporting}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg text-white"
                style={{ backgroundColor: (selectedDownloads.length && !exporting) ? COLORS.orange : "#c9c9c9" }}
              >
                <Download size={14} /> {exporting ? "Preparing..." : `Download Selected (${selectedDownloads.length})`}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 11) RAW DATA PAGE (GERÇEK VERİ — GET /api/raw-data/links)
// ============================================================================
function RawDataPage() {
  const [mode, setMode] = useState("category"); // "category" | "country"
  const [links, setLinks] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet("/api/raw-data/links").then(setLinks).catch((e) => setError(e.message));
  }, []);

  const activeMap = links ? (mode === "category" ? links.byCategory : links.byCountry) : null;
  const entries = activeMap ? Object.entries(activeMap) : [];

  return (
    <div style={{ backgroundColor: COLORS.paper }} className="min-h-screen">
      <section className="max-w-5xl mx-auto px-6 py-16">
        <SectionTitle
          title="Raw Data"
          subtitle="Jump straight to the raw sequencing data archived on Zenodo, grouped by food category or by country of origin."
        />

        <div className="flex rounded-xl overflow-hidden mt-8 w-fit" style={{ border: `1.5px solid ${COLORS.line}` }}>
          {[{ key: "category", label: "By Category" }, { key: "country", label: "By Country" }].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setMode(opt.key)}
              className="px-4 py-2.5 text-sm font-medium whitespace-nowrap"
              style={{ backgroundColor: mode === opt.key ? COLORS.orange : "#fff", color: mode === opt.key ? "#fff" : COLORS.inkSoft, fontFamily: FONT_BODY }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {error && <div className="mt-8"><ErrorBlock message={error} /></div>}
        {!error && !links && <LoadingBlock />}
        {!error && links && (
          entries.length === 0 ? (
            <p className="text-sm mt-8" style={{ color: COLORS.inkSoft }}>No raw-data links available yet.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-8">
              {entries.map(([key, url]) => (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 rounded-xl px-4 py-3.5 text-sm font-medium transition-colors"
                  style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}`, color: COLORS.darkTeal }}
                >
                  <span className="truncate">{mode === "category" ? catLabel(key) : key}</span>
                  <ExternalLink size={14} style={{ color: COLORS.orange, flexShrink: 0 }} />
                </a>
              ))}
            </div>
          )
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
  } else if (page === "rawdata") PageComponent = <RawDataPage />;
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