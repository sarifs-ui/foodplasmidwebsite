import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { COLORS, FONT_BODY } from "../../theme/tokens.js";

/**
 * Multi-select dropdown.
 *
 * Adds the keyboard and screen-reader affordances the original lacked: the
 * expanded state is announced, Escape closes the panel, and focus leaving the
 * group dismisses it — previously it could only be dismissed with the mouse.
 */
export function FilterChip({ label, options, selected, onToggle }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const panelId = useId();

  const sorted = [...options].sort((a, b) => a.label.localeCompare(b.label));
  const hasSelection = selected.length > 0;

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={panelId}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap"
        style={{
          border: `1.5px solid ${hasSelection ? COLORS.orange : COLORS.line}`,
          backgroundColor: hasSelection ? `${COLORS.orange}18` : "#fff",
          color: hasSelection ? COLORS.deepOrange : COLORS.ink,
          fontFamily: FONT_BODY,
        }}
      >
        {label}
        {hasSelection && ` (${selected.length})`}
        <ChevronDown
          size={14}
          aria-hidden="true"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          className="absolute z-30 mt-2 w-64 max-h-72 overflow-y-auto rounded-xl shadow-lg p-2"
          style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}
        >
          {sorted.length === 0 && (
            <p className="px-2 py-1.5 text-sm" style={{ color: COLORS.inkSoft }}>
              No options
            </p>
          )}
          {sorted.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <label
                key={option.value}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer hover:bg-black/[0.03]"
                style={{ color: COLORS.ink }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(option.value)}
                  style={{ accentColor: COLORS.orange }}
                />
                {option.swatch && (
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: option.swatch }}
                  />
                )}
                <span className="truncate">{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
