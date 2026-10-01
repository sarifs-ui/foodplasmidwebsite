import { NavLink } from "react-router-dom";
import { FaGithub } from "react-icons/fa";

import { NAV_ITEMS } from "../domain/navigation.js";
import { COLORS, FONT_BODY, FONT_DISPLAY } from "../theme/tokens.js";

const HERO_IMAGE =
  "/images/bacterial-plasmids-coloured-transmission-electron-micrograph-tem-of-two-circles-or-plasmids-of-dna-from-bacteria-a-plasmid-is-a-length-of-dna-t-2ADG4FH.jpg";

export function Masthead() {
  return (
    <div
      className="relative overflow-hidden w-full"
      style={{ backgroundColor: COLORS.darkTeal }}
    >
      <img
        src={HERO_IMAGE}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: "70% 50%" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, ${COLORS.darkTeal}F5 0%, ${COLORS.darkTeal}DB 30%, ${COLORS.deepOrange}66 58%, transparent 92%)`,
        }}
      />
      <div className="relative z-10 w-full px-6 md:px-12 pt-14 pb-12 md:pt-16 md:pb-14 text-left">
        <h1
          className="uppercase text-5xl md:text-7xl font-extrabold leading-none tracking-tight"
          style={{ fontFamily: FONT_DISPLAY, color: "#fff" }}
        >
          PLATE
        </h1>
        <p
          className="mt-2 text-xl md:text-2xl font-bold tracking-tight text-white/95"
          style={{ fontFamily: FONT_DISPLAY }}
        >
          Plasmid Atlas of Food Ecosystems
        </p>
        <p
          className="mt-2 text-xs md:text-sm tracking-wide font-medium"
          style={{ color: COLORS.paper, fontFamily: FONT_BODY }}
        >
          Open-Source Food-Associated Plasmidome Database
        </p>
      </div>
    </div>
  );
}

export function TabBar() {
  return (
    <header
      className="sticky top-0 z-40 w-full"
      style={{ backgroundColor: "#fff", borderBottom: `1px solid ${COLORS.line}` }}
    >
      <nav
        className="no-scrollbar max-w-6xl mx-auto flex items-center justify-center gap-1 px-6 py-3 overflow-x-auto"
        aria-label="Primary"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className="relative px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors"
            style={({ isActive }) => ({
              color: isActive ? COLORS.orange : COLORS.inkSoft,
              fontFamily: FONT_BODY,
            })}
          >
            {({ isActive }) => (
              <>
                {item.label}
                {isActive && (
                  <span
                    className="absolute left-3 right-3 -bottom-[13px] h-[3px] rounded-full"
                    style={{ backgroundColor: COLORS.orange }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer
      className="w-full mt-auto"
      style={{ backgroundColor: COLORS.darkTeal, color: COLORS.paper }}
    >
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-semibold" style={{ fontFamily: FONT_DISPLAY }}>
            PLATE — Plasmid Atlas of Food Ecosystems
          </div>
          <p className="text-xs mt-1" style={{ color: COLORS.lightTeal }}>
            An open catalogue of plasmids from food-associated metagenomes.
          </p>
        </div>
        <nav className="flex items-center gap-4" aria-label="Footer">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="text-xs hover:underline"
              style={{ color: COLORS.paper }}
            >
              {item.label}
            </NavLink>
          ))}
          <a
            href="https://github.com/sarifs-ui/foodplasmidwebsite"
            target="_blank"
            rel="noreferrer"
            aria-label="PLATE on GitHub"
            style={{ color: COLORS.paper }}
          >
            <FaGithub size={16} />
          </a>
        </nav>
      </div>
    </footer>
  );
}
