"use client";

import { useCallback, useEffect, useState } from "react";

type SegmentInfo = { id: string; label: string; note: string; size: number };
type Sent = {
  id: string;
  subject: string;
  segment: string;
  sentCount: number;
  failCount: number;
  sentAt: string;
};

export function Campaigns() {
  const [open, setOpen] = useState(true);
  const [segments, setSegments] = useState<SegmentInfo[]>([]);
  const [history, setHistory] = useState<Sent[]>([]);
  const [counts, setCounts] = useState({ total: 0, optedOut: 0 });
  const [segment, setSegment] = useState("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/campaign");
    if (!r.ok) return;
    const d = await r.json();
    setSegments(d.segments);
    setHistory(d.history);
    setCounts({ total: d.total, optedOut: d.optedOut });
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const chosen = segments.find((s) => s.id === segment);

  async function send() {
    if (!confirm(`Send "${subject}" to ${chosen?.size ?? 0} people? This can't be unsent.`))
      return;
    setSending(true);
    const r = await fetch("/api/admin/campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segment, subject, body }),
    });
    const d = await r.json();
    setSending(false);
    setResult(
      r.ok
        ? `Sent to ${d.sentCount} of ${d.total}${d.failCount ? `, ${d.failCount} failed` : ""}.`
        : (d.error ?? "Something went wrong.")
    );
    if (r.ok) {
      setSubject("");
      setBody("");
      load();
    }
  }

  return (
    <section className="mt-14 border-t border-line pt-8">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-baseline justify-between text-left"
      >
        <h2 className="font-display text-2xl text-ink">
          Tell people about it
        </h2>
        <span className="font-mono text-xs text-muted">
          {open ? "hide" : "open"}
        </span>
      </button>

      {open && (
        <div className="mt-5">
          <p className="text-xs text-muted">
            {counts.total} customers on record · {counts.optedOut} unsubscribed.
            Only people who ordered and left the box ticked are contactable.
          </p>

          <div className="mt-5 divide-y divide-line">
            {segments.map((sg) => (
              <label
                key={sg.id}
                className="flex cursor-pointer items-center gap-3 bg-paper px-4 py-3"
              >
                <input
                  type="radio"
                  checked={segment === sg.id}
                  onChange={() => setSegment(sg.id)}
                  className="h-4 w-4 accent-gold"
                />
                <span className="grow">
                  <span className="font-display">{sg.label}</span>
                  <span className="block text-xs text-muted">{sg.note}</span>
                </span>
                <span className="font-mono text-sm text-gold">{sg.size}</span>
              </label>
            ))}
          </div>

          <label className="mt-5 block">
            <span className="text-[13px] font-semibold text-ink">
              Subject
            </span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="New flavour: Pistachio"
              className="mt-1 w-full border-b border-line bg-transparent pb-1.5 text-sm text-ink placeholder:text-ash focus:border-navy"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-[13px] font-semibold text-ink">
              Message — {"{name}"} becomes their first name
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={7}
              className="mt-1 w-full bg-paper p-3 text-sm text-ink focus:outline-none"
            />
          </label>

          <p className="mt-2 text-xs text-muted">
            Your address and a one-click unsubscribe are added to the bottom
            automatically. Both are legally required.
          </p>

          {result && (
            <p className="mt-4 border-l-2 border-navy bg-paper px-4 py-3 text-sm">
              {result}
            </p>
          )}

          <button
            onClick={send}
            disabled={sending || !subject || !body || !chosen?.size}
            className="mt-5 w-full bg-navy py-3 font-display text-white disabled:opacity-30"
          >
            {sending
              ? "Sending…"
              : `Send to ${chosen?.size ?? 0} ${chosen?.size === 1 ? "person" : "people"}`}
          </button>

          {history.length > 0 && (
            <div className="mt-8">
              <h3 className="text-[13px] font-semibold text-ink">
                Already sent
              </h3>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {history.map((h) => (
                  <li key={h.id} className="flex flex-wrap gap-x-3">
                    <span className="text-ink">{h.subject}</span>
                    <span>{new Date(h.sentAt).toLocaleDateString("en-GB")}</span>
                    <span>{h.sentCount} sent</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
