"use client";

import { useCallback, useEffect, useState } from "react";
import { RATINGS, ratingLabel } from "@/lib/survey";
import { Card, PageHead, readError } from "./ui";

type Row = {
  id: string;
  rating: keyof typeof labels;
  flavours: string[];
  comment: string | null;
  kind: string;
  forDate: string;
  createdOn: string;
};

const labels = {
  LOVED: "Loved it",
  REALLY_GOOD: "Really good",
  GOOD: "Good",
  JUST_OK: "Just OK",
  NOT_GREAT: "Not great",
};

/**
 * What customers said, with nothing attached to who said it.
 *
 * There's no name here because there's none in the database — the answer and
 * the order are stored apart on purpose.
 */
export function Feedback({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [days, setDays] = useState(30);
  const [asked, setAsked] = useState(0);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/feedback?days=${days}`);
    if (!r.ok) return flash(await readError(r));
    const d = await r.json();
    setRows(d.feedback);
    setAsked(d.asked);
  }, [days, flash]);

  useEffect(() => {
    load();
  }, [load]);

  if (rows === null)
    return (
      <>
        <PageHead title="Feedback" note="Anonymous answers from customers." />
        <p className="text-sm text-ink2">Loading…</p>
      </>
    );

  const counts = RATINGS.map((r) => ({
    ...r,
    n: rows.filter((x) => x.rating === r.value).length,
  }));
  const most = Math.max(1, ...counts.map((c) => c.n));

  // A flavour's standing, from everyone who ate it — slices and whole cakes
  // together.
  const byFlavour = new Map<string, Row[]>();
  for (const row of rows)
    for (const f of row.flavours)
      byFlavour.set(f, [...(byFlavour.get(f) ?? []), row]);

  const comments = rows.filter((r) => r.comment);

  return (
    <>
      <PageHead
        title="Feedback"
        note={`Anonymous. ${rows.length} ${rows.length === 1 ? "reply" : "replies"} from ${asked} asked${
          asked ? ` (${Math.round((rows.length / asked) * 100)}%)` : ""
        }.`}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {[30, 90, 365].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={[
              "rounded-btn px-3 py-1.5 text-[13px] font-medium transition-colors",
              days === d
                ? "bg-navy text-white"
                : "bg-cream-beige text-ink2 hover:bg-cream-warm",
            ].join(" ")}
          >
            {d === 365 ? "Last year" : `Last ${d} days`}
          </button>
        ))}
      </div>

      <Card>
        <ul className="space-y-2">
          {counts.map((c) => (
            <li key={c.value} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-[14px] text-ink">
                {c.label}
              </span>
              <span
                className="h-4 rounded-sm"
                style={{
                  background: c.colour,
                  width: `${Math.round((c.n / most) * 70)}%`,
                  minWidth: c.n ? "6px" : "0",
                }}
              />
              <span className="text-[13px] text-ink2">{c.n || ""}</span>
            </li>
          ))}
        </ul>
      </Card>

      {byFlavour.size > 0 && (
        <Card className="mt-5">
          <h2 className="font-display text-xl text-ink">By flavour</h2>
          <ul className="mt-3 space-y-2">
            {[...byFlavour]
              .sort((a, b) => b[1].length - a[1].length)
              .map(([flavour, list]) => {
                const tally = new Map<string, number>();
                for (const r of list)
                  tally.set(r.rating, (tally.get(r.rating) ?? 0) + 1);
                const top = [...tally].sort((a, b) => b[1] - a[1])[0];
                const mixed = tally.size > 2;

                return (
                  <li
                    key={flavour}
                    className="flex flex-wrap items-baseline justify-between gap-2 text-[15px]"
                  >
                    <span className="text-ink">{flavour}</span>
                    <span className="text-[13px] text-ink2">
                      {list.length}{" "}
                      {list.length === 1 ? "reply" : "replies"} ·{" "}
                      {mixed ? (
                        "mixed"
                      ) : (
                        <>mostly <strong>{ratingLabel(top[0] as never)}</strong></>
                      )}
                    </span>
                  </li>
                );
              })}
          </ul>
        </Card>
      )}

      {comments.length > 0 && (
        <Card className="mt-5">
          <h2 className="font-display text-xl text-ink">Comments</h2>
          <ul className="mt-3 space-y-2">
            {comments.map((c) => {
              const r = RATINGS.find((x) => x.value === c.rating);
              return (
                <li
                  key={c.id}
                  className="rounded-card border-l-4 bg-cream-warm p-3"
                  style={{ borderLeftColor: r?.colour ?? "#ccc" }}
                >
                  <p className="text-[12px] text-muted">
                    {labels[c.rating]}
                    {c.flavours.length > 0 && ` · ${c.flavours.join(", ")}`} ·{" "}
                    {new Date(c.forDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })}
                    {c.kind === "WHOLE" && " · whole cake"}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-[15px] text-ink">
                    {c.comment}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {rows.length === 0 && (
        <Card className="mt-5">
          <p className="text-sm text-ink2">
            Nothing yet. Surveys go out at noon the day after collection.
          </p>
        </Card>
      )}
    </>
  );
}
