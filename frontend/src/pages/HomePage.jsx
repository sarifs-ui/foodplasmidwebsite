import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useApi } from "../api/useApi.js";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme/tokens.js";

const PLASMID_TEM =
  "/images/bacterial-plasmids-coloured-transmission-electron-micrograph-tem-of-two-circles-or-plasmids-of-dna-from-bacteria-a-plasmid-is-a-length-of-dna-t-2ADG4FH.jpg";

/**
 * Each card's image previews what the page actually holds: a micrograph of
 * plasmids for the overview, the metadata table for the browser, and FASTA
 * records for the download archives. The two schematic images are SVGs drawn
 * from real column names and record shapes rather than stock photography.
 */
const HOME_CARDS = [
  {
    to: "/about",
    title: "About GFPR",
    teaser: "What is the GFPR? Explore the GFPR",
    description:
      "See what GFPR is, what it includes, and why it matters. Click to explore.",
    image: PLASMID_TEM,
  },
  {
    to: "/samples",
    title: "Data Access",
    teaser: "Filter and browse the database metadata",
    description:
      "Filter by category, type, subtype, fermentation status, country and year. Download metadata as CSV, or go straight to the raw output for the records you select. Click to explore.",
    image: "/images/card-metadata-table.svg",
  },
  {
    to: "/downloads",
    title: "Download Data",
    teaser: "Direct links to plasmid contig archives",
    description:
      "Browse archives of plasmid contigs grouped by food category or country of origin. Pick a group and open its archive directly. Click to explore.",
    image: "/images/card-fasta-contigs.svg",
  },
  {
    to: "/contact",
    title: "Contact",
    teaser: "Questions? Reach the team directly.",
    description:
      "Use the form for questions about the data, collaboration, or anything technical. Click to explore.",
    image: "/images/plasmid.jpg",
  },
];

const GRADIENTS = [
  [COLORS.deepOrange, COLORS.orange],
  [COLORS.darkTeal, COLORS.medTeal],
  [COLORS.berry, COLORS.deepOrange],
  [COLORS.orange, COLORS.berry],
];

export function HomePage() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);
  const { data: overview } = useApi("/api/stats/overview");

  const sampleCount = overview?.totalSamples?.toLocaleString("en-US");

  return (
    <div style={{ backgroundColor: COLORS.paper }}>
      <section className="max-w-3xl mx-auto px-6 pt-14 pb-8 text-center">
        <p
          className="text-base md:text-lg leading-relaxed"
          style={{ color: COLORS.inkSoft, fontFamily: FONT_BODY }}
        >
          GFPR is an open-source plasmidome database comprising{" "}
          {sampleCount ? `${sampleCount} samples` : "thousands of samples"} from around the
          world, together with their functional annotations.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="flex flex-col gap-5">
          {HOME_CARDS.map((card, i) => {
            const isHovered = hovered === card.to;
            const [from, to] = GRADIENTS[i % GRADIENTS.length];
            return (
              <button
                key={card.to}
                type="button"
                onClick={() => navigate(card.to)}
                onMouseEnter={() => setHovered(card.to)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(card.to)}
                onBlur={() => setHovered(null)}
                className="relative overflow-hidden rounded-2xl text-left w-full h-40 md:h-48"
                style={{
                  backgroundColor: COLORS.paperAlt,
                  border: `1px solid ${COLORS.line}`,
                }}
              >
                <img
                  src={card.image}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(90deg, ${COLORS.paperAlt}F5 0%, ${COLORS.paperAlt}D9 38%, transparent 88%)`,
                  }}
                />
                <div className="relative z-10 h-full flex flex-col justify-center p-8">
                  <h2
                    className="text-2xl md:text-3xl font-semibold mb-1"
                    style={{ fontFamily: FONT_DISPLAY, color: COLORS.darkTeal }}
                  >
                    {card.title}
                  </h2>
                  <p className="text-sm md:text-base" style={{ color: COLORS.inkSoft }}>
                    {card.teaser}
                  </p>
                </div>
                <div
                  className="absolute inset-0 z-20 flex items-center p-8 transition-all duration-300 ease-out"
                  style={{
                    backgroundImage: `linear-gradient(120deg, ${from}, ${to})`,
                    opacity: isHovered ? 1 : 0,
                    transform: isHovered ? "translateY(0)" : "translateY(8px)",
                    pointerEvents: "none",
                  }}
                >
                  <p
                    className="text-white text-base md:text-lg leading-relaxed font-medium max-w-xl"
                    style={{ fontFamily: FONT_BODY }}
                  >
                    {card.description}
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
