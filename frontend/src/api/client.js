/**
 * API client.
 *
 * `API_BASE` is empty by default, so requests go to the page's own origin. In
 * production the backend serves both the API and this bundle from one port; in
 * development Vite proxies /api to the backend (see vite.config.js). Set
 * VITE_API_BASE only to point the UI at a backend on another host.
 */
const API_BASE = import.meta.env?.VITE_API_BASE || "";

export class ApiError extends Error {
  constructor(message, status, path) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
  }
}
 
function buildUrl(path, params) {
  // A relative path still needs an absolute base for the URL constructor.
  const url = new URL(API_BASE + path, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, item);
      } else {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
}


/**
 * Collect a streamed response, reporting progress as it arrives.
 *
 * `onProgress(received, total)` — `total` is the server's estimate from
 * X-Export-Estimated-Bytes, or 0 when it did not send one.
 */
async function readWithProgress(res, onProgress) {
  const total =
    Number(res.headers.get("X-Export-Estimated-Bytes")) ||
    Number(res.headers.get("Content-Length")) ||
    0;
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(received, total);
  }
  return new Blob(chunks, { type: res.headers.get("Content-Type") || "application/octet-stream" });
}

async function readError(res, path) {
  let detail = "";
  try {
    const body = await res.json();
    detail = body?.error || "";
  } catch {
    // Non-JSON error body; the status alone will have to do.
  }
  return new ApiError(detail || `Request failed (${res.status})`, res.status, path);
}

export async function apiGet(path, params, { signal } = {}) {
  const res = await fetch(buildUrl(path, params), { signal });
  if (!res.ok) throw await readError(res, path);
  return res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw await readError(res, path);
  return res.json();
}

/**
 * POST that streams back a file rather than JSON — used by the export
 * endpoint. Triggers a browser download through a temporary anchor.
 *
 * `onProgress(received, total)` reports the bytes received against the size
 * the server estimated for the archive — it is built while it is sent, so a
 * real Content-Length does not exist.
 */
export async function apiPostDownload(path, body, filename = "download.zip", { onProgress } = {}) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw await readError(res, path);

  const blob =
    onProgress && res.body?.getReader
      ? await readWithProgress(res, onProgress)
      : await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
