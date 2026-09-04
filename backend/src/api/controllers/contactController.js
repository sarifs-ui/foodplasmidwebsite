/**
 * POST /api/contact
 *
 * No mail transport is wired up: the message is written to the server log.
 * An SMTP or transactional-email integration belongs here.
 */
/** Trim and bound a free-text field before it reaches the log. */
function field(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function submit(req, res) {
  const name = field(req.body?.name, 200);
  const email = field(req.body?.email, 320);
  const subject = field(req.body?.subject, 300);
  const message = field(req.body?.message, 5000);

  if (!message) {
    return res.status(400).json({ ok: false, error: "A message is required." });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "That email address is not valid." });
  }

  // Logged as a structured object: console.log escapes control characters in
  // string values, so a newline in a field cannot forge an extra log line.
  console.log("[contact] new message:", { name, email, subject, message });

  res.json({
    ok: true,
    note: "Message received. It has been written to the server log; email delivery is not yet connected.",
  });
}
