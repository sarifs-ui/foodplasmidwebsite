import { useState } from "react";
import { CheckCircle2, ExternalLink, Send } from "lucide-react";

import { apiPost } from "../api/client.js";
import { SectionTitle } from "../components/ui/index.jsx";
import { CARD_SURFACE, COLORS, FONT_BODY } from "../theme/tokens.js";

const FIELD_STYLE = {
  border: `1.5px solid ${COLORS.line}`,
  fontFamily: FONT_BODY,
  backgroundColor: "#fff",
  color: COLORS.ink,
};

export function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState({ state: "idle", message: "" });

  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const onSubmit = async (event) => {
    event.preventDefault();
    setStatus({ state: "sending", message: "" });
    try {
      const response = await apiPost("/api/contact", form);
      setStatus({
        state: "sent",
        message: response.note || "Message received.",
      });
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      setStatus({ state: "error", message: err.message });
    }
  };

  return (
    <div style={{ backgroundColor: COLORS.paper }} className="min-h-[60vh]">
      <section className="max-w-3xl mx-auto px-6 py-12">
        <SectionTitle
          eyebrow="Contact"
          title="Get in touch"
          subtitle="Questions about the data, collaboration proposals, or anything technical."
        />

        <form onSubmit={onSubmit} className="rounded-2xl p-6 mt-8 space-y-4" style={CARD_SURFACE}>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium" style={{ color: COLORS.inkSoft }}>
                Name
              </span>
              <input
                value={form.name}
                onChange={update("name")}
                className="w-full text-sm px-3 py-2.5 rounded-xl mt-1"
                style={FIELD_STYLE}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium" style={{ color: COLORS.inkSoft }}>
                Email
              </span>
              <input
                type="email"
                value={form.email}
                onChange={update("email")}
                className="w-full text-sm px-3 py-2.5 rounded-xl mt-1"
                style={FIELD_STYLE}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium" style={{ color: COLORS.inkSoft }}>
              Subject
            </span>
            <input
              value={form.subject}
              onChange={update("subject")}
              className="w-full text-sm px-3 py-2.5 rounded-xl mt-1"
              style={FIELD_STYLE}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium" style={{ color: COLORS.inkSoft }}>
              Message <span aria-hidden="true">*</span>
            </span>
            <textarea
              required
              rows={6}
              value={form.message}
              onChange={update("message")}
              className="w-full text-sm px-3 py-2.5 rounded-xl mt-1 resize-y"
              style={FIELD_STYLE}
            />
          </label>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="submit"
              disabled={status.state === "sending"}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl text-white disabled:opacity-60"
              style={{ backgroundColor: COLORS.orange }}
            >
              <Send size={14} aria-hidden="true" />
              {status.state === "sending" ? "Sending…" : "Send message"}
            </button>

            {status.state === "sent" && (
              <span
                className="inline-flex items-center gap-1.5 text-xs"
                style={{ color: COLORS.darkTeal }}
                role="status"
              >
                <CheckCircle2 size={14} aria-hidden="true" /> {status.message}
              </span>
            )}
            {status.state === "error" && (
              <span className="text-xs" style={{ color: COLORS.deepOrange }} role="alert">
                Could not send: {status.message}
              </span>
            )}
          </div>
        </form>

        <div className="mt-8 text-sm" style={{ color: COLORS.inkSoft }}>
          <p>
            You can also reach the research group directly:{" "}
            <a
              href="https://arikanlab.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold"
              style={{ color: COLORS.darkTeal }}
            >
              Arıkan Lab <ExternalLink size={12} aria-hidden="true" />
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
