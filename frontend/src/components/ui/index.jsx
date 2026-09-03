import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";

import { CARD_SURFACE, COLORS, FONT_BODY, FONT_MONO } from "../../theme/tokens.js";

export function Eyebrow({ children, color = COLORS.orange }) {
  return (
    <div
      className="text-[11px] uppercase tracking-[0.18em] font-semibold mb-2"
      style={{ color, fontFamily: FONT_MONO }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ eyebrow, eyebrowColor, title, subtitle, align = "left" }) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      {eyebrow && <Eyebrow color={eyebrowColor}>{eyebrow}</Eyebrow>}
      <h2
        className="text-2xl sm:text-3xl font-bold mb-2"
        style={{ color: COLORS.darkTeal, fontFamily: FONT_BODY }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`text-sm max-w-3xl ${align === "center" ? "mx-auto" : ""}`}
          style={{ color: COLORS.inkSoft }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function LoadingBlock({ label = "Loading…" }) {
  return (
    <div
      className="flex items-center justify-center py-10 text-sm"
      style={{ color: COLORS.inkSoft }}
      role="status"
    >
      {label}
    </div>
  );
}

/**
 * Error state.
 *
 * The message is whatever the API reported. It deliberately does not name a
 * localhost URL — the previous version told every production visitor to check
 * that something was running on http://localhost:4000.
 */
export function ErrorBlock({ message, onRetry }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-center px-4"
      style={{ color: COLORS.deepOrange }}
      role="alert"
    >
      <span>Could not load this data{message ? `: ${message}` : "."}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-semibold underline"
          style={{ color: COLORS.darkTeal }}
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function Notice({ message, onClose }) {
  if (!message) return null;
  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg"
      style={{ backgroundColor: COLORS.darkTeal, color: "#fff", fontFamily: FONT_BODY }}
      role="status"
      aria-live="polite"
    >
      <span className="text-sm">{message}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss notification">
        <X size={14} />
      </button>
    </div>
  );
}

export function InfoRow({ label, children }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 py-1.5">
      <span
        className="text-[11px] uppercase tracking-wide min-w-[140px]"
        style={{ color: COLORS.inkSoft, fontFamily: FONT_MONO }}
      >
        {label}
      </span>
      <span className="text-sm" style={{ color: COLORS.ink }}>
        {children}
      </span>
    </div>
  );
}

/**
 * Segmented control — four hand-rolled copies of this existed, each with
 * slightly different padding.
 */
export function SegmentedControl({ options, value, onChange, label }) {
  return (
    <div
      className="inline-flex rounded-md overflow-hidden"
      style={{ border: `1px solid ${COLORS.line}` }}
      role="group"
      aria-label={label}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className="px-2.5 py-1 text-[11px] font-medium transition-colors"
            style={{
              backgroundColor: active ? COLORS.orange : "#fff",
              color: active ? "#fff" : COLORS.inkSoft,
              fontFamily: FONT_BODY,
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Card wrapper with a fullscreen toggle.
 *
 * `children` may be a function so a figure can reflow when it goes fullscreen;
 * the consuming component sits above the provider in the tree and so cannot
 * read a context.
 */
export function FigureCard({ children, className = "", style = {} }) {
  const ref = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = () => {
    if (!document.fullscreenElement) ref.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <div
      ref={ref}
      className={`relative rounded-2xl ${className}`}
      style={{
        ...CARD_SURFACE,
        ...(isFullscreen
          ? {
              overflow: "auto",
              padding: "1.75rem 2.25rem",
              width: "100vw",
              height: "100vh",
              display: "flex",
              flexDirection: "column",
            }
          : {}),
        ...style,
      }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
        title={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
        className="absolute top-2.5 right-2.5 z-10 p-1 rounded-md opacity-60 hover:opacity-100 transition-opacity"
        style={{ color: COLORS.inkSoft, lineHeight: 0 }}
      >
        {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
      </button>
      {typeof children === "function" ? children(isFullscreen) : children}
    </div>
  );
}

/**
 * A figure's header plus its loading/error handling, so every figure renders
 * those states inside the card rather than some of them outside it.
 */
export function FigureFrame({
  icon: Icon,
  title,
  description,
  loading,
  error,
  className = "",
  children,
}) {
  return (
    <FigureCard className={`p-5 ${className}`}>
      {(isFullscreen) => (
        <>
          <div className="flex items-center gap-2 mb-1 mr-6">
            {Icon && <Icon size={16} style={{ color: COLORS.darkTeal }} aria-hidden="true" />}
            <h3
              className="text-sm font-semibold"
              style={{ color: COLORS.darkTeal, fontFamily: FONT_BODY }}
            >
              {title}
            </h3>
          </div>
          {description && (
            <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>
              {description}
            </p>
          )}
          {error ? (
            <ErrorBlock message={error.message} />
          ) : loading ? (
            <LoadingBlock />
          ) : (
            children(isFullscreen)
          )}
        </>
      )}
    </FigureCard>
  );
}
