// ============================================================================
// GFPR — Global Food Plasmidome Catalog
// ============================================================================
// WHAT THIS FILE IS
// Frontend-only prototype for the GFPR (food-derived plasmidome database)
// website. There is no real backend / data-fetching logic yet — this is
// navigation between pages (via React state instead of routing), overall
// visual identity, and interactive UI wired up with mock data. The real
// backend will be connected to these same components later.
//
// PAGE STRUCTURE (top to bottom of the app shell):
//   Masthead   -> Full-width, left-aligned, all-caps title band, over a
//                 toned-down, layered illustration (soft-focus "colony"
//                 bokeh + plasmid ring + double helix) in a teal→orange
//                 duotone that fades out near the title text.
//   Tab bar    -> Plain text tabs, no icons, sits directly under the
//                 masthead and stays pinned while the page scrolls.
//   Page body  -> One of six views:
//     1) Home         -> Mission line + four large, single-column link
//                         panels (About / Data / Analysis / Contact).
//     2) About GFPR   -> Plain-language paper summary, a full-width overview
//                         stats strip, then four interactive figures: a
//                         RADIAL phylogenetic tree, category share bars, a
//                         circular "Figure A" chord diagram, and a zoomable
//                         world sample map. Every figure is clickable —
//                         selecting a branch / bar / ribbon / country surfaces
//                         a "See samples" link that jumps to Data Access
//                         pre-filtered accordingly.
//     3) Data Access  -> Category / type / subtype / fermented / country /
//                         date / annotation filters as side-by-side dropdown
//                         chips, a results table, and a per-sample detail page.
//                         Can arrive pre-filtered from an About-page figure.
//     4) Sample detail-> Opened by clicking a row: an inline meta line
//                         (country / category → type → subtype / fermented /
//                         host / size / date), a FASTA preview, an annotation
//                         hit summary, and a single Downloads panel with
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
//             reads as calmer and more photographic.
//   Type   -> A single plain system-sans stack (Calibri/Segoe/Arial) for
//             everything, display and body alike. Data labels (accession
//             IDs, table values) use a plain monospace stack.
//   Layout -> Masthead, sticky text-only tab bar, then content.
//   Signature -> The masthead illustration and the circular "Figure A" chord
//             diagram are both drawn from the dataset's own shape rather than
//             a stock illustration or template chart.
// ============================================================================

import React, { useState, useMemo, useRef } from "react";
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
  Github,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowRight,
} from "lucide-react";

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
  ink: "#0C2B2B",
  inkSoft: "#3E5C5C",
  line: "#CFE3E1",
};

const FONT_BODY = "Calibri, 'Segoe UI', Arial, Helvetica, sans-serif";
const FONT_DISPLAY = FONT_BODY;
const FONT_MONO = "'Courier New', Consolas, monospace";

// Small shared utility
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// ============================================================================
// 2) CATEGORIES — the 17 food categories, in the exact given order
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

// Category → fermented / non-fermented metadata. Categories whose name
// already encodes fermentation (or that are inherently fermented, like
// alcohol / probiotics) are tagged fermented; everything else is not.
const FERMENTED_CATEGORIES = new Set([
  "alcohol",
  "ferm_bev",
  "ferm_fruit_veg",
  "ferm_grains",
  "ferm_legumes",
  "ferm_meat",
  "ferm_seeds",
  "ferm_tubers",
  "probiotics",
]);
const isFermented = (categoryKey) => FERMENTED_CATEGORIES.has(categoryKey);

// ============================================================================
// 3) ANNOTATIONS — the 7 functional annotation dimensions + their tools
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

// Deterministic mock hit generator, so a given sample always shows the same
// "hits" for a given annotation type without needing a real backend yet.
function mockHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
const MOCK_HIT_POOL = {
  amr: ["blaTEM-1", "tetM", "mecA", "aac(6')-Ib", "sul1", "qnrS1"],
  cazyme: ["GH1", "GH13", "GT2", "CE4", "PL1", "GH43"],
  cgc: ["CGC_01", "CGC_02", "CGC_03"],
  crispr: ["CRISPR array I", "CRISPR array II", "Cas9 locus"],
  amp: ["Nisin-like AMP", "Bacteriocin class II", "Lantibiotic precursor"],
  acp: ["ACP-1 candidate", "ACP-2 candidate"],
  pfam_kegg: ["PF00069 (Kinase)", "K01990 (ABC transporter)", "PF07690 (MFS)"],
};
function mockHitsFor(recordId, annKey) {
  const pool = MOCK_HIT_POOL[annKey] || [];
  if (!pool.length) return [];
  const h = mockHash(recordId + annKey);
  const count = 1 + (h % Math.min(pool.length, 4));
  const hits = [];
  for (let i = 0; i < count; i++) hits.push(pool[(h + i * 7) % pool.length]);
  return Array.from(new Set(hits));
}
function fastaSequenceFor(recordId) {
  const bases = "ACGT";
  const h = mockHash(recordId);
  let seq = "";
  for (let i = 0; i < 240; i++) seq += bases[(h + i * 13 + i * i) % 4];
  return seq;
}
function wrapSequence(seq, width = 60) {
  const lines = [];
  for (let i = 0; i < seq.length; i += width) lines.push(seq.slice(i, i + width));
  return lines.join("\n");
}

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

// Each card's `image` is a placeholder path — see the note above HERO_IMAGE_URL
// for the two ways to point these at a real photo (local file vs hosted URL).
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

// ============================================================================
// 6) MASTHEAD — real photo, faded left-to-right behind the title
// ============================================================================
// Swap this for your own photo. Two ways to point at an image:
//  (a) Local file: drop it in `public/images/` in your project, then use a
//      path like "/images/masthead-plasmid-microscope.jpg" (works after
//      `npm run dev`, not in this chat preview).
//  (b) Hosted URL: paste a direct https:// link to an image — works
//      immediately, including right here in the chat preview.
const HERO_IMAGE_URL = "/images/masthead-plasmid-microscope.jpg";

function Masthead() {
  return (
    <div className="relative overflow-hidden" style={{ backgroundColor: COLORS.darkTeal }}>
      <img
        src={HERO_IMAGE_URL}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: "70% 50%" }}
      />
      {/* Left-to-right fade: solid near the title (left), transparent toward the photo (right). */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, ${COLORS.darkTeal}F5 0%, ${COLORS.darkTeal}DB 30%, ${COLORS.deepOrange}66 58%, transparent 92%)`,
        }}
      />
      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-14 md:pt-20 md:pb-16 text-left">
        <h1 className="uppercase text-5xl md:text-7xl font-extrabold leading-[1.02] tracking-tight" style={{ fontFamily: FONT_DISPLAY, color: "#fff" }}>
          Global Food<br />Plasmidome Catalog
        </h1>
        <p className="mt-4 text-sm md:text-base tracking-wide" style={{ color: COLORS.paper, fontFamily: FONT_BODY }}>
          Open Food-Derived Plasmidome Database
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// 7) TAB BAR — plain text tabs, no icons, orange active state
// ============================================================================
function TabBar({ page, setPage }) {
  return (
    <header className="sticky top-0 z-40 w-full" style={{ backgroundColor: "#fff", borderBottom: `1px solid ${COLORS.line}` }}>
      <nav className="max-w-6xl mx-auto flex items-center justify-center gap-1 px-6 py-3 overflow-x-auto">
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
                {/* Left-to-right fade: card background solid near the title (left), photo visible toward the right. */}
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

// ---- 9.1 Radial (circular) taxonomy tree -----------------------------------
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

// ---- 9.2 Category share bars ------------------------------------------------
const CATEGORY_SHARE = [
  { key: "dairy", value: 21 },
  { key: "ferm_bev", value: 16 },
  { key: "meat", value: 12 },
  { key: "seafood", value: 10 },
  { key: "fruit_veg", value: 9 },
  { key: "ferm_grains", value: 8 },
  { key: "alcohol", value: 7 },
  { key: "ferm_meat", value: 5 },
  { key: "probiotics", value: 4 },
  { key: "other", value: 8 },
];
function CategoryBarChart({ onSeeSamples }) {
  const [selected, setSelected] = useState(null);
  const max = Math.max(...CATEGORY_SHARE.map((d) => d.value));
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}>
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={16} style={{ color: COLORS.darkTeal }} />
        <span className="text-sm font-semibold" style={{ color: COLORS.darkTeal, fontFamily: FONT_BODY }}>
          Sample Share by Category
        </span>
      </div>
      <div className="space-y-2.5">
        {CATEGORY_SHARE.map((d) => (
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

// ---- 9.3 "Figure A" — circular chord diagram: Category -> Annotation ------
const RIBBON_CATEGORIES = [
  { key: "dairy", values: { amr: 20, cazyme: 18, cgc: 10, crispr: 12, amp: 15, acp: 8, pfam_kegg: 17 } },
  { key: "ferm_bev", values: { amr: 10, cazyme: 14, cgc: 8, crispr: 22, amp: 10, acp: 14, pfam_kegg: 22 } },
  { key: "seafood", values: { amr: 25, cazyme: 10, cgc: 7, crispr: 8, amp: 18, acp: 10, pfam_kegg: 22 } },
  { key: "meat", values: { amr: 28, cazyme: 8, cgc: 6, crispr: 8, amp: 12, acp: 16, pfam_kegg: 22 } },
  { key: "fruit_veg", values: { amr: 8, cazyme: 24, cgc: 14, crispr: 14, amp: 10, acp: 12, pfam_kegg: 18 } },
].map((c) => ({ ...c, label: catLabel(c.key), color: catColor(c.key) }));

function buildChordLayout(categories, targets, gapDeg = 3) {
  const catStart = 100, catEnd = 260;
  const tgtStart = -75, tgtEnd = 75;

  const catTotals = categories.map((c) => Object.values(c.values).reduce((a, b) => a + b, 0));
  const catSpanTotal = catEnd - catStart - gapDeg * (categories.length - 1);
  let cursor = catStart;
  const catBlocks = categories.map((c, i) => {
    const span = (catTotals[i] / catTotals.reduce((a, b) => a + b, 0)) * catSpanTotal;
    const block = { ...c, a0: cursor, a1: cursor + span, total: catTotals[i] };
    cursor += span + gapDeg;
    return block;
  });

  const tgtTotals = targets.map((t) => categories.reduce((s, c) => s + (c.values[t.key] || 0), 0));
  const tgtSpanTotal = tgtEnd - tgtStart - gapDeg * (targets.length - 1);
  cursor = tgtStart;
  const tgtBlocks = targets.map((t, i) => {
    const span = (tgtTotals[i] / tgtTotals.reduce((a, b) => a + b, 0)) * tgtSpanTotal;
    const block = { ...t, a0: cursor, a1: cursor + span, total: tgtTotals[i] };
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
  const [selected, setSelected] = useState(null); // { type: 'category' | 'annotation', key, label }
  const width = 820, height = 560;
  const cx = 460, cy = 280;
  const R = 185, outerR = 200, labelR = 218;

  const { catBlocks, tgtBlocks, ribbons } = useMemo(
    () => buildChordLayout(RIBBON_CATEGORIES, ANNOTATIONS.map((a) => ({ key: a.key, label: a.short }))),
    []
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

// ---- 9.4 World sample map (zoomable, clickable heat map) -------------------
const CONTINENTS = [
  { id: "na", d: "M70,90 L180,60 L250,110 L230,180 L190,260 L140,230 L90,200 L60,140 Z" },
  { id: "sa", d: "M230,270 L300,260 L320,340 L290,430 L250,460 L220,400 L210,320 Z" },
  { id: "eu", d: "M450,70 L540,60 L560,120 L520,170 L460,160 L440,110 Z" },
  { id: "af", d: "M460,190 L560,180 L590,230 L580,320 L540,410 L480,420 L450,340 L440,250 Z" },
  { id: "as", d: "M580,50 L760,40 L900,90 L880,180 L820,230 L750,280 L650,260 L600,190 L585,120 Z" },
  { id: "au", d: "M790,350 L900,340 L920,400 L870,430 L800,420 L780,380 Z" },
];
const SAMPLE_POINTS = [
  { label: "Italy", x: 505, y: 138, count: 420, category: "dairy" },
  { label: "Türkiye", x: 568, y: 150, count: 260, category: "ferm_bev" },
  { label: "France", x: 470, y: 118, count: 310, category: "dairy" },
  { label: "Germany", x: 492, y: 98, count: 180, category: "ferm_grains" },
  { label: "United Kingdom", x: 452, y: 85, count: 120, category: "other" },
  { label: "Netherlands", x: 474, y: 92, count: 90, category: "dairy" },
  { label: "Poland", x: 512, y: 92, count: 100, category: "fruit_veg" },
  { label: "USA", x: 150, y: 150, count: 480, category: "meat" },
  { label: "Mexico", x: 140, y: 230, count: 150, category: "ferm_bev" },
  { label: "Brazil", x: 260, y: 360, count: 200, category: "meat" },
  { label: "China", x: 760, y: 150, count: 350, category: "fruit_veg" },
  { label: "Japan", x: 872, y: 148, count: 300, category: "ferm_bev" },
  { label: "South Korea", x: 830, y: 143, count: 240, category: "fruit_veg" },
  { label: "India", x: 680, y: 210, count: 220, category: "dairy" },
  { label: "Thailand", x: 720, y: 230, count: 160, category: "seafood" },
  { label: "Vietnam", x: 742, y: 225, count: 140, category: "seafood" },
  { label: "Egypt", x: 500, y: 230, count: 90, category: "other" },
  { label: "Nigeria", x: 470, y: 280, count: 70, category: "ferm_grains" },
  { label: "Kenya", x: 545, y: 300, count: 60, category: "dairy" },
  { label: "Australia", x: 850, y: 390, count: 130, category: "meat" },
];
function WorldHeatMap({ onSeeSamples }) {
  const [mode, setMode] = useState("count");
  const [active, setActive] = useState(null);
  const [locked, setLocked] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // top-left of the view rect, in original coords
  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const baseW = 1000, baseH = 500;
  const viewW = baseW / zoom, viewH = baseH / zoom;
  const vx = clamp(pan.x, 0, Math.max(0, baseW - viewW));
  const vy = clamp(pan.y, 0, Math.max(0, baseH - viewH));

  const zoomBy = (factor) => setZoom((z) => clamp(z * factor, 1, 4));
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const onWheel = (e) => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15); };
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

  const maxCount = Math.max(...SAMPLE_POINTS.map((p) => p.count));
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
    <div className="rounded-2xl p-5" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}>
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
      <svg
        ref={svgRef}
        viewBox={`${vx} ${vy} ${viewW} ${viewH}`}
        className="w-full"
        style={{ maxHeight: 380, cursor: zoom > 1 ? "grab" : "default", touchAction: "none" }}
        onWheel={onWheel}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
      >
        {CONTINENTS.map((c) => <path key={c.id} d={c.d} fill={COLORS.paperAlt} stroke={COLORS.line} strokeWidth={1.5} />)}
        {SAMPLE_POINTS.map((p) => {
          const fill = mode === "count" ? countColor(p.count) : catColor(p.category);
          const r = 5 + (p.count / maxCount) * 12;
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
              <circle cx={p.x} cy={p.y} r={r} fill={fill} opacity={0.8} stroke={isActive ? COLORS.ink : "#fff"} strokeWidth={isActive ? 2 : 1.2} />
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
              <span className="px-2 py-0.5 rounded-full text-xs text-white" style={{ backgroundColor: catColor(active.category) }}>{catLabel(active.category)}</span>
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
            country. (Continents are stylized, not to scale.)
          </span>
        )}
      </div>
    </div>
  );
}

// ---- 9.5 Overview stats -----------------------------------------------------
const OVERVIEW_STATS = [
  { label: "Total Samples", value: "4,687" },
  { label: "Food Categories", value: "17" },
  { label: "Category Types", value: "146+" },
  { label: "Host Species", value: "312" },
  { label: "Countries", value: "30" },
  { label: "Source Databases", value: "NCBI · cFMD · MGnify · In-house" },
  { label: "Annotation Dimensions", value: "7" },
  { label: "Total Plasmid Contigs", value: "~5,038,000" },
];

// ---- 9.6 About page shell --------------------------------------------------
function AboutPage({ onNavigate }) {
  return (
    <div style={{ backgroundColor: COLORS.paper }}>
      <section className="max-w-6xl mx-auto px-6 py-16">
        <SectionTitle
          title="What is GFPR, and why does it matter?"
          subtitle="A plain-language outline of the paper follows below; see the full article for technical detail and references."
        />

        <div className="max-w-3xl mt-10 space-y-4 text-[15px] leading-relaxed" style={{ color: COLORS.ink, fontFamily: FONT_BODY }}>
          <p>
            Food is not just a cultural product — it is a living microbial ecosystem. At the center of that
            ecosystem sit <strong>plasmids</strong>: circular DNA elements that move between bacteria, carrying
            traits like antibiotic resistance, stress tolerance, and enzyme production.
          </p>
          <p>
            Plasmid research to date has focused mostly on the human gut and clinical settings; the food-derived
            plasmidome remains largely unexplored. GFPR was built to close that gap, analyzing{" "}
            <strong>4,687 food metagenome samples</strong> compiled from NCBI, cFMD, MGnify, and in-house sequencing.
          </p>
          <p>
            For every sample, plasmid contigs are predicted, host taxonomy is assigned, and annotation is run
            across seven functional dimensions, from <strong>AMR &amp; stress response genes</strong> to{" "}
            <strong>CRISPR-Cas systems</strong> and <strong>antimicrobial / anticancer peptides</strong>.
          </p>
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>
            Every sample follows a <strong>Category → Type → Subtype</strong> hierarchy, and is separately tagged as{" "}
            <strong>fermented</strong> or <strong>non-fermented</strong> — both are filterable on the Data Access page.
          </p>
          <div className="flex flex-wrap items-center gap-5 mt-2">
            <a href="#" className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: COLORS.orange }}>
              View the full paper <ExternalLink size={14} />
            </a>
            <a href="#" className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: COLORS.berry }}>
              <Github size={15} /> View on GitHub
            </a>
            <a href="https://arikanlab.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: COLORS.darkTeal }}>
              Arıkan Lab <ExternalLink size={14} />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10">
          {OVERVIEW_STATS.map((s) => (
            <div key={s.label} className="rounded-xl p-4" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}>
              <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}>{s.label}</div>
              <div className="text-base font-semibold" style={{ color: COLORS.darkTeal, fontFamily: FONT_MONO }}>{s.value}</div>
            </div>
          ))}
        </div>

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
// 10) DATA ACCESS PAGE + SAMPLE DETAIL
// ============================================================================
const MOCK_RECORDS = [
  { id: "GFPR-000104", category: "dairy", country: "Italy", sampleType: "Cheese", subtype: "Soft-Ripened", host: "Lactobacillus", sizeKb: 42, year: 2021 },
  { id: "GFPR-000212", category: "ferm_bev", country: "Türkiye", sampleType: "Boza", subtype: "Cereal-Based", host: "Leuconostoc", sizeKb: 31, year: 2022 },
  { id: "GFPR-000318", category: "seafood", country: "Thailand", sampleType: "Fish Sauce", subtype: "Liquid Ferment", host: "Vibrio", sizeKb: 58, year: 2020 },
  { id: "GFPR-000401", category: "meat", country: "USA", sampleType: "Sausage", subtype: "Fresh", host: "Staphylococcus", sizeKb: 27, year: 2023 },
  { id: "GFPR-000512", category: "dairy", country: "France", sampleType: "Yogurt", subtype: "Set-Style", host: "Streptococcus", sizeKb: 39, year: 2019 },
  { id: "GFPR-000633", category: "alcohol", country: "Germany", sampleType: "Beer", subtype: "Lager", host: "Saccharomyces*", sizeKb: 22, year: 2022 },
  { id: "GFPR-000745", category: "ferm_grains", country: "China", sampleType: "Sourdough", subtype: "Wheat-Based", host: "Lactobacillus", sizeKb: 35, year: 2024 },
  { id: "GFPR-000856", category: "fruit_veg", country: "Spain", sampleType: "Pickles", subtype: "Brine-Fermented", host: "Pediococcus", sizeKb: 19, year: 2021 },
  { id: "GFPR-000967", category: "dairy", country: "Netherlands", sampleType: "Cheese", subtype: "Semi-Hard", host: "Lactococcus", sizeKb: 44, year: 2020 },
  { id: "GFPR-001078", category: "probiotics", country: "South Korea", sampleType: "Kimchi", subtype: "Napa Cabbage", host: "Weissella", sizeKb: 28, year: 2023 },
  { id: "GFPR-001189", category: "ferm_bev", country: "Japan", sampleType: "Sake Yeast", subtype: "Rice-Based", host: "Lactobacillus", sizeKb: 33, year: 2019 },
  { id: "GFPR-001290", category: "meat", country: "Brazil", sampleType: "Salami", subtype: "Dry-Cured", host: "Staphylococcus", sizeKb: 25, year: 2022 },
  { id: "GFPR-001301", category: "water", country: "Egypt", sampleType: "Spring Water", subtype: "Natural Mineral", host: "Pseudomonas", sizeKb: 15, year: 2024 },
  { id: "GFPR-001412", category: "seafood", country: "Vietnam", sampleType: "Fermented Fish", subtype: "Whole Fish", host: "Vibrio", sizeKb: 52, year: 2021 },
  { id: "GFPR-001523", category: "feed", country: "India", sampleType: "Animal Feed", subtype: "Silage", host: "Bacillus", sizeKb: 30, year: 2020 },
  { id: "GFPR-001634", category: "dairy", country: "Türkiye", sampleType: "Kefir", subtype: "Milk Kefir", host: "Lactobacillus", sizeKb: 41, year: 2023 },
  { id: "GFPR-001745", category: "ferm_grains", country: "Mexico", sampleType: "Pulque", subtype: "Agave Sap", host: "Zymomonas", sizeKb: 24, year: 2019 },
  { id: "GFPR-001856", category: "other", country: "Kenya", sampleType: "Mixed Ferment", subtype: "Unclassified", host: "Unknown", sizeKb: 18, year: 2022 },
  { id: "GFPR-001967", category: "supplement", country: "USA", sampleType: "Probiotic Supplement", subtype: "Capsule", host: "Bifidobacterium", sizeKb: 20, year: 2024 },
  { id: "GFPR-002078", category: "meat", country: "Australia", sampleType: "Pastırma", subtype: "Dry-Cured", host: "Staphylococcus", sizeKb: 26, year: 2021 },
  { id: "GFPR-002189", category: "fruit_veg", country: "Italy", sampleType: "Olives", subtype: "Brine-Cured", host: "Lactobacillus", sizeKb: 21, year: 2020 },
  { id: "GFPR-002290", category: "ferm_bev", country: "France", sampleType: "Wine", subtype: "Red Wine", host: "Oenococcus", sizeKb: 29, year: 2023 },
  { id: "GFPR-002301", category: "dairy", country: "Greece", sampleType: "Whey", subtype: "Sweet Whey", host: "Streptococcus", sizeKb: 37, year: 2019 },
  { id: "GFPR-002412", category: "seafood", country: "Norway", sampleType: "Salmon", subtype: "Cold-Smoked", host: "Photobacterium", sizeKb: 46, year: 2024 },
];
const ALL_COUNTRIES = Array.from(new Set(MOCK_RECORDS.map((r) => r.country))).sort();

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
  const [selectedCats, setSelectedCats] = useState(() => (initialFilter?.type === "category" ? [initialFilter.value] : []));
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedSubtypes, setSelectedSubtypes] = useState([]);
  const [selectedCountries, setSelectedCountries] = useState(() => (initialFilter?.type === "country" ? [initialFilter.value] : []));
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedAnnotations, setSelectedAnnotations] = useState(() => (initialFilter?.type === "annotation" ? [initialFilter.value] : []));
  const [fermentFilter, setFermentFilter] = useState(null); // null | true | false
  const [query, setQuery] = useState(() => (initialFilter?.type === "query" ? initialFilter.value : ""));
  const [selectedIds, setSelectedIds] = useState([]);

  const usedCategories = Array.from(new Set(MOCK_RECORDS.map((r) => r.category)));
  const usedTypes = Array.from(new Set(MOCK_RECORDS.map((r) => r.sampleType)));
  const usedSubtypes = Array.from(new Set(MOCK_RECORDS.map((r) => r.subtype)));
  const usedYears = Array.from(new Set(MOCK_RECORDS.map((r) => String(r.year))));

  const toggle = (setFn) => (val) => setFn((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));

  const filtered = useMemo(() => {
    return MOCK_RECORDS.filter((r) => {
      if (selectedCats.length && !selectedCats.includes(r.category)) return false;
      if (selectedTypes.length && !selectedTypes.includes(r.sampleType)) return false;
      if (selectedSubtypes.length && !selectedSubtypes.includes(r.subtype)) return false;
      if (selectedCountries.length && !selectedCountries.includes(r.country)) return false;
      if (selectedYears.length && !selectedYears.includes(String(r.year))) return false;
      if (fermentFilter !== null && isFermented(r.category) !== fermentFilter) return false;
      if (query && !`${r.id} ${r.sampleType} ${r.subtype} ${r.host}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [selectedCats, selectedTypes, selectedSubtypes, selectedCountries, selectedYears, fermentFilter, query]);

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

        <div className="flex items-center gap-2 mt-8 mb-3">
          <Filter size={14} style={{ color: COLORS.inkSoft }} />
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}>Filters</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilterChip
            label="Category"
            options={usedCategories.map((k) => ({ value: k, label: catLabel(k), swatch: catColor(k) }))}
            selected={selectedCats}
            onToggle={toggle(setSelectedCats)}
          />
          <FilterChip
            label="Type"
            options={usedTypes.map((t) => ({ value: t, label: t }))}
            selected={selectedTypes}
            onToggle={toggle(setSelectedTypes)}
          />
          <FilterChip
            label="Subtype"
            options={usedSubtypes.map((t) => ({ value: t, label: t }))}
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
            options={ALL_COUNTRIES.map((c) => ({ value: c, label: c }))}
            selected={selectedCountries}
            onToggle={toggle(setSelectedCountries)}
          />
          <FilterChip
            label="Date"
            options={usedYears.map((y) => ({ value: y, label: y }))}
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
              placeholder="Search ID, type, subtype, host..."
              className="w-full text-sm pl-8 pr-3 py-2.5 rounded-xl outline-none"
              style={{ border: `1.5px solid ${COLORS.line}`, fontFamily: FONT_BODY }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 mb-3 flex-wrap gap-2">
          <span className="text-sm" style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}>
            {filtered.length} results {selectedIds.length > 0 && `· ${selectedIds.length} selected`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onMockAction(`Metadata (CSV) will be downloaded for ${selectedIds.length || filtered.length} sample(s).`)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
              style={{ backgroundColor: COLORS.lightTeal, color: COLORS.darkTeal }}
            >
              <Download size={13} /> Metadata (CSV)
            </button>
            <button
              onClick={() => onMockAction(`For ${selectedIds.length || filtered.length} sample(s), ${annotationNote} will be downloaded.`)}
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
              {filtered.map((r, i) => (
                <tr key={r.id} style={{ backgroundColor: i % 2 ? COLORS.paperAlt : "#fff" }}>
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleId(r.id)} style={{ accentColor: COLORS.orange }} />
                  </td>
                  <td className="px-3 py-2 cursor-pointer" style={{ fontFamily: FONT_MONO, color: COLORS.darkTeal }} onClick={() => onOpenSample(r.id)}>
                    {r.id}
                  </td>
                  <td className="px-3 py-2 cursor-pointer" onClick={() => onOpenSample(r.id)}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: catColor(r.category) }} />
                      {catLabel(r.category)}
                    </span>
                  </td>
                  <td className="px-3 py-2 cursor-pointer" style={{ color: COLORS.inkSoft }} onClick={() => onOpenSample(r.id)}>{r.country}</td>
                  <td className="px-3 py-2 cursor-pointer" style={{ color: COLORS.inkSoft }} onClick={() => onOpenSample(r.id)}>{r.sampleType}</td>
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
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-sm" style={{ color: COLORS.inkSoft }}>No samples match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SampleDetailPage({ record, onBack, onMockAction }) {
  const allKeys = record ? ["fasta", ...ANNOTATIONS.map((a) => a.key)] : [];
  const [selectedDownloads, setSelectedDownloads] = useState(allKeys);

  if (!record) {
    return (
      <div style={{ backgroundColor: COLORS.paper }} className="min-h-screen">
        <section className="max-w-4xl mx-auto px-6 py-16">
          <p style={{ color: COLORS.inkSoft }}>Sample not found.</p>
          <button onClick={onBack} className="mt-4 text-sm font-semibold" style={{ color: COLORS.orange }}>Back to Data Access</button>
        </section>
      </div>
    );
  }

  const toggleDownload = (key) => setSelectedDownloads((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const toggleAllDownloads = () => setSelectedDownloads((prev) => (prev.length === allKeys.length ? [] : allKeys));

  const downloadItems = [
    { key: "fasta", label: "Raw DNA Sequence (FASTA)", sub: `${record.id}.fasta` },
    ...ANNOTATIONS.map((a) => ({ key: a.key, label: a.label, sub: a.tool })),
  ];

  const seq = fastaSequenceFor(record.id);
  const fermented = isFermented(record.category);
  const annotationsToShow = ANNOTATIONS.filter((a) => selectedDownloads.includes(a.key));

  return (
    <div style={{ backgroundColor: COLORS.paper }} className="min-h-screen">
      <section className="max-w-5xl mx-auto px-6 py-16">
        <button onClick={onBack} className="text-sm font-semibold mb-6 flex items-center gap-1" style={{ color: COLORS.orange }}>
          <ChevronLeft size={16} /> Back to Data Access
        </button>

        <h2 className="text-3xl font-semibold mb-2" style={{ color: COLORS.darkTeal, fontFamily: FONT_MONO }}>{record.id}</h2>
        <p className="text-sm leading-relaxed" style={{ color: COLORS.inkSoft, fontFamily: FONT_BODY }}>
          Country: <strong style={{ color: COLORS.ink }}>{record.country}</strong>
          <span className="mx-2">·</span>
          Category: <strong style={{ color: COLORS.ink }}>{catLabel(record.category)}</strong> → {record.sampleType} → {record.subtype}
          <span className="mx-2">·</span>
          <span
            className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ backgroundColor: fermented ? COLORS.lightTeal : COLORS.paperAlt, color: fermented ? COLORS.darkTeal : COLORS.inkSoft }}
          >
            {fermented ? "Fermented" : "Non-Fermented"}
          </span>
          <span className="mx-2">·</span>
          Host: <em>{record.host}</em>
          <span className="mx-2">·</span>
          Plasmid Size: {record.sizeKb} kb
          <span className="mx-2">·</span>
          Date: {record.year}
        </p>

        <div className="grid md:grid-cols-[1fr_320px] gap-6 mt-8">
          <div className="space-y-6">
            <div className="rounded-2xl p-5" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold" style={{ color: COLORS.darkTeal }}>FASTA Preview</span>
                <span className="text-xs" style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}>{record.sizeKb} kb total</span>
              </div>
              <pre className="text-xs overflow-x-auto p-3 rounded-lg whitespace-pre" style={{ backgroundColor: COLORS.paperAlt, fontFamily: FONT_MONO, color: COLORS.ink, lineHeight: 1.6 }}>
{`>${record.id} predicted_plasmid length=${record.sizeKb}kb
${wrapSequence(seq)}`}
              </pre>
              <p className="text-[11px] mt-2" style={{ color: COLORS.inkSoft }}>Showing the first 240 bp — download the full FASTA file for the complete sequence.</p>
            </div>

            <div className="rounded-2xl p-5" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}>
              <span className="text-sm font-semibold" style={{ color: COLORS.darkTeal }}>Annotation Summary</span>
              {annotationsToShow.length === 0 ? (
                <p className="text-xs mt-3" style={{ color: COLORS.inkSoft }}>Check an annotation file in Downloads to see its hit summary here.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  {annotationsToShow.map((a) => {
                    const hits = mockHitsFor(record.id, a.key);
                    return (
                      <div key={a.key} className="rounded-xl p-3" style={{ backgroundColor: COLORS.paperAlt }}>
                        <div className="text-xs font-semibold mb-1.5" style={{ color: COLORS.darkTeal, fontFamily: FONT_MONO }}>
                          {a.short} · {hits.length} hit{hits.length > 1 ? "s" : ""}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {hits.map((h) => (
                            <span key={h} className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>{h}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
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
// 11) ANALYSIS PAGE
// ============================================================================
function AnalysisPage({ onMockAction }) {
  const [fileName, setFileName] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const [showExample, setShowExample] = useState(false);

  const handleFiles = (files) => { if (files && files[0]) setFileName(files[0].name); };

  const runMockAnalysis = () => {
    if (!fileName) { onMockAction("Please upload a file first."); return; }
    setShowExample(true);
  };

  const EXAMPLE_MATCHES = MOCK_RECORDS.slice(0, 10).map((r, i) => ({
    id: r.id,
    similarity: `${Math.max(97 - i * 2.4, 68).toFixed(1)}%`,
    category: r.category,
    sampleType: r.sampleType,
    host: r.host,
    country: r.country,
  }));
  const top = EXAMPLE_MATCHES[0];

  return (
    <div style={{ backgroundColor: COLORS.paper }} className="min-h-screen">
      <section className="max-w-4xl mx-auto px-6 py-16">
        <SectionTitle
          title="Analysis"
          subtitle="Upload a file in FASTA, GFA, or protein/DNA format and we'll surface the closest matches in our database."
        />
        <p className="mt-4 max-w-2xl text-sm leading-relaxed" style={{ color: COLORS.inkSoft, fontFamily: FONT_BODY }}>
          This tool compares your upload against every plasmid in GFPR and returns the 10 most similar samples.
          Based on those closest matches, it also predicts the likely sample type, host bacterium, and origin of
          whatever you uploaded.
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
          <button onClick={runMockAnalysis} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: COLORS.orange }}>
            Run Analysis
          </button>
        </div>

        {showExample && (
          <>
            <div className="mt-10 rounded-2xl p-5" style={{ backgroundColor: COLORS.lightTeal }}>
              <div className="text-xs uppercase tracking-wide font-semibold mb-2" style={{ color: COLORS.darkTeal, fontFamily: FONT_MONO }}>Predicted Origin</div>
              <div className="text-lg font-semibold" style={{ fontFamily: FONT_DISPLAY, color: COLORS.darkTeal }}>
                {catLabel(top.category)} · {top.sampleType} · {top.host} · {top.country}
              </div>
              <p className="text-sm mt-1" style={{ color: COLORS.darkTeal }}>Based on the closest match, {top.id} ({top.similarity} similarity).</p>
            </div>

            <div className="mt-6 rounded-2xl p-5" style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold" style={{ color: COLORS.darkTeal }}>10 Closest Samples</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: COLORS.yellow, color: COLORS.deepOrange, fontFamily: FONT_MONO }}>
                  mock — will go live once the backend is connected
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
                  {EXAMPLE_MATCHES.map((m) => (
                    <tr key={m.id} style={{ borderBottom: `1px solid ${COLORS.paperAlt}` }}>
                      <td className="py-2.5" style={{ fontFamily: FONT_MONO, color: COLORS.darkTeal }}>{m.id}</td>
                      <td className="py-2.5">{m.similarity}</td>
                      <td className="py-2.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: catColor(m.category) }} />
                          {catLabel(m.category)}
                        </span>
                      </td>
                      <td className="py-2.5" style={{ color: COLORS.inkSoft }}>{m.sampleType}</td>
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
  const submit = (e) => {
    e.preventDefault();
    setSent(true);
    onMockAction("Your message was received (mock). Real delivery will go live once the backend is connected.");
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
                <input required value={form.name} onChange={update("name")} className="w-full mt-1 text-sm px-3 py-2 rounded-lg outline-none" style={{ border: `1px solid ${COLORS.line}` }} />
              </div>
              <div>
                <label className="text-xs font-semibold" style={{ color: COLORS.inkSoft }}>Email</label>
                <input required type="email" value={form.email} onChange={update("email")} className="w-full mt-1 text-sm px-3 py-2 rounded-lg outline-none" style={{ border: `1px solid ${COLORS.line}` }} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold" style={{ color: COLORS.inkSoft }}>Subject</label>
              <input value={form.subject} onChange={update("subject")} className="w-full mt-1 text-sm px-3 py-2 rounded-lg outline-none" style={{ border: `1px solid ${COLORS.line}` }} />
            </div>
            <div>
              <label className="text-xs font-semibold" style={{ color: COLORS.inkSoft }}>Message</label>
              <textarea required rows={5} value={form.message} onChange={update("message")} className="w-full mt-1 text-sm px-3 py-2 rounded-lg outline-none resize-none" style={{ border: `1px solid ${COLORS.line}` }} />
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
          © {new Date().getFullYear()} GFPR — Global Food Plasmidome Catalog
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

  // Generic navigation (tab bar, footer, home cards) — no filter carried over.
  const handleSetPage = (p) => {
    setPendingFilter(null);
    setPage(p);
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  // Navigation from an About-page figure ("See samples") — carries a filter.
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
    const record = MOCK_RECORDS.find((r) => r.id === selectedRecordId);
    PageComponent = <SampleDetailPage record={record} onBack={backToData} onMockAction={showNotice} />;
  } else if (page === "analysis") PageComponent = <AnalysisPage onMockAction={showNotice} />;
  else if (page === "contact") PageComponent = <ContactPage onMockAction={showNotice} />;

  const activeTab = page === "sampleDetail" ? "data" : page;

  return (
    <div style={{ fontFamily: FONT_BODY, backgroundColor: COLORS.paper }}>
      <Masthead />
      <TabBar page={activeTab} setPage={handleSetPage} />
      {PageComponent}
      <Footer setPage={handleSetPage} />
      {notice && <MockNotice message={notice} onClose={() => setNotice(null)} />}
    </div>
  );
}