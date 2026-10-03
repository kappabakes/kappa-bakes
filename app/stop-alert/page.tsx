"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function StopAlert() {
  return (
    <Suspense fallback={<main className="p-10 text-sm text-ink2">One moment…</main>}>
      <Stop />
    </Suspense>
  );
}

/**
 * Where the "stop these emails" link lands.
 *
 * Acts immediately rather than asking to confirm — someone clicking it has
 * already decided, and a confirmation step is one more thing between them
 * and being left alone.
 */
function Stop() {
  const id = useSearchParams().get("id");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/alerts?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      .catch(() => {})
      .finally(() => setDone(true));
  }, [id]);

  return (
    <main className="mx-auto max-w-lg px-5 py-16 text-center">
      <h1 className="font-display text-3xl text-ink">
        {done ? "That's stopped" : "One moment…"}
      </h1>
      {done && (
        <>
          <p className="mt-3 text-[15px] leading-relaxed text-ink2">
            We won&apos;t email you about that flavour again. Any order
            confirmations you&apos;re expecting aren&apos;t affected.
          </p>
          <Link
            href="/order"
            className="mt-6 inline-block rounded-btn bg-navy px-6 py-3 font-semibold text-white"
          >
            Back to ordering
          </Link>
        </>
      )}
    </main>
  );
}
