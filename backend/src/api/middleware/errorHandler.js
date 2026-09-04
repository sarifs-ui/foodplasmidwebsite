/**
 * JSON error handler.
 *
 * Express's default handler renders the exception — message, absolute file
 * paths and the whole internal call stack — straight into the HTTP response
 * whenever NODE_ENV is not "production". Details are logged server-side
 * instead, and the client gets a correlation id and nothing else.
 */
export function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  // Malformed JSON bodies are the client's fault, not a server failure.
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Malformed JSON body." });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large." });
  }

  const reference = Math.random().toString(36).slice(2, 10);
  console.error(`[error ${reference}] ${req.method} ${req.originalUrl}`, err);

  return res.status(500).json({
    error: "Internal server error.",
    reference,
  });
}
