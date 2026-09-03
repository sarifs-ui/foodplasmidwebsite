/**
 * POST /api/contact
 *
 * No mail transport is wired up: the message is written to the server log.
 * An SMTP or transactional-email integration belongs here.
 */
export function submit(req, res) {
  const { name, email, subject, message } = req.body || {};

  if (!message || !String(message).trim()) {
    return res.status(400).json({ ok: false, error: "A message is required." });
  }

  console.log("[contact] new message:", { name, email, subject, message });

  res.json({
    ok: true,
    note: "Message received. It has been written to the server log; email delivery is not yet connected.",
  });
}
