import { COLORS } from "./tokens.js";

/**
 * Page-level styles that Tailwind's utility classes cannot express.
 *
 * The heavy `!important` resets that used to live here are gone: index.css no
 * longer ships the Vite starter boilerplate that forced #root to a fixed
 * 1126px centred column, so there is nothing left to fight.
 */
export function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

      html, body, #root {
        min-height: 100%;
        background: linear-gradient(135deg, #F7FBFA 0%, ${COLORS.paperWarm} 100%);
      }

      .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
      .no-scrollbar::-webkit-scrollbar { display: none; }

      /* The palette is light-only, so form controls must not be repainted by a
         dark OS preference. */
      input, textarea, select {
        background-color: #ffffff;
        color: ${COLORS.ink};
        color-scheme: light;
      }

      /* Inputs previously removed the focus ring outright, leaving keyboard
         users with no visible focus at all. */
      :focus-visible {
        outline: 2px solid ${COLORS.orange};
        outline-offset: 2px;
      }
    `}</style>
  );
}
