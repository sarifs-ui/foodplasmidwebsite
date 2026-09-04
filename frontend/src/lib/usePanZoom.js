import { useCallback, useEffect, useRef, useState } from "react";

import { clamp } from "../theme/tokens.js";

/**
 * Pan and zoom over an SVG viewBox.
 *
 * Zooming alone is not much use on a dense circular figure — you can magnify
 * the middle but never reach the rim — so this pairs wheel zoom (centred on the
 * cursor, not the canvas) with left-button drag panning.
 *
 * The wheel listener is attached manually because React registers onWheel
 * passively: preventDefault() inside a JSX handler is ignored and the page
 * scrolls instead of the figure zooming. A callback ref drives the binding, so
 * it happens when the element actually mounts — which for a figure is after its
 * data has loaded, not on first render.
 *
 * @param width   viewBox width at zoom 1
 * @param height  viewBox height at zoom 1
 */
export function usePanZoom({ width, height, minZoom = 1, maxZoom = 8 } = {}) {
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [dragging, setDragging] = useState(false);
  const [node, setNode] = useState(null);
  const dragState = useRef(null);

  const containerRef = useCallback((element) => setNode(element), []);

  /** Keep the visible window inside the canvas so the figure cannot be lost. */
  const clampView = useCallback(
    (next) => {
      const w = width / next.zoom;
      const h = height / next.zoom;
      return {
        zoom: next.zoom,
        x: clamp(next.x, 0, Math.max(0, width - w)),
        y: clamp(next.y, 0, Math.max(0, height - h)),
      };
    },
    [width, height]
  );

  const reset = useCallback(() => setView({ x: 0, y: 0, zoom: 1 }), []);

  /**
   * Zoom by `factor`. `focus` is a function of the previous view returning the
   * viewBox point to hold still; omitted, the window centre is used.
   */
  const zoomWith = useCallback(
    (factor, focus) => {
      setView((prev) => {
        const zoom = clamp(prev.zoom * factor, minZoom, maxZoom);
        if (zoom === prev.zoom) return prev;
        const [fx, fy] = focus
          ? focus(prev)
          : [prev.x + width / prev.zoom / 2, prev.y + height / prev.zoom / 2];
        // Hold the focus point still: its offset within the window is preserved.
        return clampView({
          zoom,
          x: fx - (fx - prev.x) * (prev.zoom / zoom),
          y: fy - (fy - prev.y) * (prev.zoom / zoom),
        });
      });
    },
    [clampView, width, height, minZoom, maxZoom]
  );

  const zoomBy = useCallback((factor) => zoomWith(factor), [zoomWith]);

  useEffect(() => {
    if (!node) return undefined;

    const onWheel = (event) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      zoomWith(event.deltaY < 0 ? 1.15 : 1 / 1.15, (prev) => [
        prev.x + ((event.clientX - rect.left) / rect.width) * (width / prev.zoom),
        prev.y + ((event.clientY - rect.top) / rect.height) * (height / prev.zoom),
      ]);
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [node, zoomWith, width, height]);

  const onPointerDown = useCallback((event) => {
    // Left button only, so context menus and middle-click paste still work.
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      rectWidth: rect.width,
      rectHeight: rect.height,
      origin: null,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  }, []);

  const onPointerMove = useCallback(
    (event) => {
      const drag = dragState.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      setView((prev) => {
        // The pan origin is captured on the first move, when `prev` is known.
        if (!drag.origin) drag.origin = { x: prev.x, y: prev.y };
        return clampView({
          zoom: prev.zoom,
          x: drag.origin.x - dx * (width / prev.zoom / drag.rectWidth),
          y: drag.origin.y - dy * (height / prev.zoom / drag.rectHeight),
        });
      });
    },
    [clampView, width, height]
  );

  const endDrag = useCallback((event) => {
    const drag = dragState.current;
    if (!drag) return;
    event?.currentTarget?.releasePointerCapture?.(drag.pointerId);
    dragState.current = null;
    setDragging(false);
  }, []);

  const viewBox = `${view.x} ${view.y} ${width / view.zoom} ${height / view.zoom}`;

  return {
    containerRef,
    viewBox,
    zoom: view.zoom,
    zoomBy,
    reset,
    dragging,
    /** Spread onto the element that should capture the drag. */
    panHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      style: { cursor: dragging ? "grabbing" : "grab", touchAction: "none" },
    },
  };
}
