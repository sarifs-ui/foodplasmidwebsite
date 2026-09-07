import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Columns3 } from "lucide-react";

import { COLORS, FONT_BODY } from "../../theme/tokens.js";

/**
 * "Which columns do I want to see" dropdown.
 *
 * Deliberately not a FilterChip: the filter chips apply every tick immediately,
 * which is right for a filter but wrong here — reshaping the table under the
 * cursor while someone is still choosing makes the list jump. So the ticks
 * collect in a draft and nothing moves until Apply. Escape, a click outside and
 * Cancel all discard the draft.
 *
 * Props:
 *   columns   the full column definitions, in display order
 *   visible   keys currently applied
 *   onApply   called with the new key list
 *   onReset   called when the user asks for the default set back
 */
export function ColumnPicker({ columns, visible, onApply, onReset }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(visible);
  const containerRef = useRef(null);
  const panelId = useId();

  const close = () => setOpen(false);

  const openPanel = () => {
    // The draft always starts from what is on screen, so an abandoned edit
    // cannot leak into the next one.
    setDraft(visible);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const toggle = (key) => {
    setDraft((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const apply = () => {
    onApply(draft);
    close();
  };

  const reset = () => {
    onReset();
    close();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => (open ? close() : openPanel())}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap"
        style={{
          border: `1.5px solid ${COLORS.line}`,
          backgroundColor: "#fff",
          color: COLORS.ink,
          fontFamily: FONT_BODY,
        }}
      >
        <Columns3 size={14} aria-hidden="true" />
        Columns ({visible.length}/{columns.length})
        <ChevronDown
          size={14}
          aria-hidden="true"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Choose which columns to show"
          className="absolute z-30 mt-2 w-64 rounded-xl shadow-lg"
          style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.line}` }}
        >
          {/* Definition order, not alphabetical — it mirrors the table. */}
          <div className="max-h-72 overflow-y-auto p-2">
            {columns.map((column) => (
              <label
                key={column.key}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${
                  column.locked ? "cursor-default" : "cursor-pointer hover:bg-black/[0.03]"
                }`}
                style={{ color: column.locked ? COLORS.inkSoft : COLORS.ink }}
              >
                <input
                  type="checkbox"
                  checked={column.locked || draft.includes(column.key)}
                  disabled={column.locked}
                  onChange={() => toggle(column.key)}
                  style={{ accentColor: COLORS.orange }}
                />
                <span className="truncate">{column.label}</span>
                {column.locked && (
                  <span className="ml-auto text-[10px] shrink-0" style={{ color: COLORS.inkSoft }}>
                    always
                  </span>
                )}
              </label>
            ))}
          </div>

          <div
            className="flex items-center justify-between gap-2 px-2 py-2"
            style={{ borderTop: `1px solid ${COLORS.line}` }}
          >
            <button
              type="button"
              onClick={reset}
              className="text-xs px-1"
              style={{ color: COLORS.inkSoft }}
            >
              Reset
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={close}
                className="text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ color: COLORS.inkSoft }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={apply}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                style={{ backgroundColor: COLORS.orange }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
