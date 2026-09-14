"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SOCIALS, whatsappLink } from "@/lib/config";
import { RATINGS, isHappy } from "@/lib/survey";
import type { FeedbackScore } from "@prisma/client";

export default function FeedbackPage() {
  return (
    <Suspense
      fallback={<main className="p-10 text-sm text-ink2">One moment…</main>}
    >
      <Feedback />
    </Suspense>
  );
}

/**
 * Where a tap in the survey email lands.
 *
 * The rating is already in the link, so it's recorded the moment they arrive
 * — everything below is optional. Someone who closes the tab straight away
 * has still answered.
 */
function Feedback() {
  const params = useSearchParams();
  const token = params.get("t") ?? "";
  const rating = (params.get("r") ?? "") as FeedbackScore;

  const [flavours, setFlavours] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "done" | "gone">(
    "loading"
  );
  const [busy, setBusy] = useState(false);

  const chosen = RATINGS.find((r) => r.value === rating);
  const happy = chosen ? isHappy(rating) : true;

  useEffect(() => {
    if (!token || !chosen) return setState("gone");

    fetch(`/api/feedback?t=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setFlavours(d.flavours ?? []);
        // Only one flavour? Then we already know, and there's nothing to ask.
        if ((d.flavours ?? []).length === 1) setPicked(d.flavours);
        setState("ready");
      })
      .catch(() => setState("gone"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send() {
    setBusy(true);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, rating, flavours: picked, comment }),
    }).catch(() => {});
    setBusy(false);
    setState("done");
  }

  if (state === "loading")
    return <main className="p-10 text-sm text-ink2">One moment…</main>;

  if (state === "gone")
    return (
      <main className="mx-auto max-w-lg p-10 text-center">
        <h1 className="font-display text-3xl text-ink">Link not found</h1>
        <p className="mt-3 text-[15px] text-ink2">
          This link may have expired. If you'd like to tell us how it went,
          message us on WhatsApp.
        </p>
      </main>
    );

  const wa = whatsappLink();
  const reviewLink = wa
    ? `${wa}${wa.includes("?") ? "&" : "?"}text=${encodeURIComponent(
        "Hi, I'd like to leave a review for Kappa Bakes."
      )}`
    : null;

  /*
   * The thank-you screen keeps the same invitations rather than ending flat.
   * Someone who's just told you they loved it is at the most willing they'll
   * ever be — that's the moment to ask, not the one before.
   */
  if (state === "done")
    return (
      <main className="mx-auto max-w-lg px-5 py-10">
        <div className="rounded-card bg-paper p-7 text-center shadow-soft">
          <h1 className="font-display text-3xl text-ink">Thank you</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink2">
            That's recorded — anonymously. It genuinely helps.
          </p>

          {happy ? (
            <div className="mt-6 rounded-card bg-navy p-5 text-white">
              <p className="font-semibold">One more thing?</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-white/80">
                A Social Media post/story helps more than you&apos;d think.
                Please support your local baker and help me reach more
                customers. Your efforts are very much appreciated : )
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {reviewLink && (
                  <a
                    href={reviewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-btn bg-good px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    Message your review
                  </a>
                )}
                <a
                  href={SOCIALS.instagram.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-btn bg-white px-5 py-2.5 text-sm font-semibold text-navy"
                >
                  Tag us on Instagram
                </a>
              </div>
              <p className="mt-3 text-[12px] text-white/60">
                Instagram opens our profile — tag us in your post or story.
              </p>
            </div>
          ) : (
            wa && (
              <div className="mt-6 rounded-card border border-bad/30 bg-bad-light p-5">
                <p className="text-[15px] leading-relaxed text-ink">
                  If you'd like it put right, message us — we can't reply to an
                  anonymous answer.
                </p>
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block rounded-btn bg-good px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Message us on WhatsApp
                </a>
              </div>
            )
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-3 border-t border-line pt-5">
            <a
              href={SOCIALS.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-semibold text-gold-hover underline underline-offset-4"
            >
              Instagram
            </a>
            <a
              href={SOCIALS.tiktok.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-semibold text-gold-hover underline underline-offset-4"
            >
              TikTok
            </a>
            <a
              href={SOCIALS.snapchat.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-semibold text-gold-hover underline underline-offset-4"
            >
              Snapchat
            </a>
          </div>
        </div>
      </main>
    );

  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      <div className="rounded-card bg-paper p-7 shadow-soft">
        <h1 className="font-display text-3xl text-ink">
          {happy ? "Thank you" : "Sorry to hear that"}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink2">
          {happy
            ? "Your response has been recorded. Just one last step if you have a minute. All feedback is valuable and would be much appreciated if you could fill out the below. Positive and constructive feedback are both welcome. Your response is anonymous so please feel comfortable to express yourself."
            : "Tell us what went wrong — it's the useful kind of feedback."}
        </p>

        {flavours.length > 1 && (
          <>
            <p className="mt-6 text-[13px] font-bold uppercase tracking-wider text-gold-hover">
              Which flavours did you have?{" "}
              <span className="font-normal normal-case tracking-normal text-muted">
                select all that apply
              </span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {flavours.map((f) => {
                const on = picked.includes(f);
                return (
                  <button
                    key={f}
                    onClick={() =>
                      setPicked(
                        on ? picked.filter((x) => x !== f) : [...picked, f]
                      )
                    }
                    className={[
                      "rounded-full border px-3.5 py-1.5 text-[14px] transition-colors",
                      on
                        ? "border-navy bg-navy text-white"
                        : "border-field bg-paper text-ink hover:bg-cream-warm",
                    ].join(" ")}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <p className="mt-6 text-[13px] font-bold uppercase tracking-wider text-gold-hover">
          {happy ? "Anything we could do better?" : "What went wrong?"}{" "}
          {happy && (
            <span className="font-normal normal-case tracking-normal text-muted">
              optional
            </span>
          )}
        </p>
        <textarea
          value={comment}
          rows={3}
          onChange={(e) => setComment(e.target.value)}
          className="mt-2 w-full rounded-btn border border-field bg-paper px-3.5 py-2.5 text-[15px] text-ink focus:border-gold focus:outline-none"
        />
        <p className="mt-1 text-[12px] text-muted">Sent anonymously.</p>

        <button
          onClick={send}
          disabled={busy}
          className="mt-5 w-full rounded-btn bg-navy px-6 py-3 font-semibold text-white transition-colors hover:bg-navy-hover disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send"}
        </button>

        {happy ? (
          <div className="mt-6 rounded-card bg-navy p-5 text-center text-white">
            <p className="font-semibold">Glad you enjoyed it</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-white/80">
              A Social Media post/story helps more than you&apos;d think.
              Please support your local baker and help me reach more customers.
              Your efforts are very much appreciated : )
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {reviewLink && (
                <a
                  href={reviewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-btn bg-good px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Message your review
                </a>
              )}
              <a
                href={SOCIALS.instagram.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-btn bg-white px-5 py-2.5 text-sm font-semibold text-navy"
              >
                Tag us on Instagram
              </a>
            </div>
            <p className="mt-3 text-[12px] text-white/60">
              Instagram opens our profile — tag us in your post or story.
            </p>
          </div>
        ) : (
          wa && (
            <div className="mt-6 rounded-card border border-bad/30 bg-bad-light p-5 text-center">
              <p className="text-[15px] leading-relaxed text-ink">
                If you'd like it put right, message us — we can't reply to an
                anonymous answer.
              </p>
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-btn bg-good px-5 py-2.5 text-sm font-semibold text-white"
              >
                Message us on WhatsApp
              </a>
            </div>
          )
        )}
      </div>
    </main>
  );
}
