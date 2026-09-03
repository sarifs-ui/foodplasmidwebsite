import { useEffect, useRef, useState } from "react";

import { apiGet } from "./client.js";

/**
 * Fetch a GET endpoint and track its loading/error state.
 *
 * This replaces seven near-identical copies of the same effect. It also does
 * two things none of those did: aborts the request when the component
 * unmounts, and ignores responses that arrive out of order, so a fast-changing
 * query cannot have an older response overwrite a newer one.
 *
 * `params` is compared by value, so callers can pass an object literal without
 * triggering a refetch on every render.
 */
export function useApi(path, params, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const paramsKey = JSON.stringify(params ?? null);
  const requestId = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, error: null, loading: false });
      return undefined;
    }

    const id = ++requestId.current;
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: null }));

    apiGet(path, params ?? undefined, { signal: controller.signal })
      .then((data) => {
        if (id === requestId.current) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (controller.signal.aborted || id !== requestId.current) return;
        setState({ data: null, error, loading: false });
      });

    return () => controller.abort();
    // paramsKey stands in for a deep comparison of `params`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, paramsKey, enabled]);

  return state;
}

/** Debounce a rapidly changing value — used for the search box. */
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
