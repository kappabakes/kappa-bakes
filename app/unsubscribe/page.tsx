"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function Inner() {
  const token = useSearchParams().get("t");
  const [state, setState] = useState<"working" | "done" | "error">("working");

  useEffect(() => {
    if (!token) return setState("error");
    fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then((r) => setState(r.ok ? "done" : "error"));
  }, [token]);

  return (
    <main className="mx-auto max-w-lg px-5 pt-32">
      {state === "working" && <p className="text-muted">One moment…</p>}
      {state === "done" && (
        <>
          <h1 className="font-display text-4xl">That&apos;s done.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            You won&apos;t get any more emails about new flavours or slices
            running low. Order confirmations still come through as normal —
            those aren&apos;t marketing, they&apos;re your receipt.
          </p>
        </>
      )}
      {state === "error" && (
        <>
          <h1 className="font-display text-4xl">That link didn&apos;t work.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            It may have already been used. Email us and we&apos;ll take you off
            the list by hand.
          </p>
        </>
      )}
      <Link
        href="/"
        className="mt-10 inline-block border-b border-caramel pb-1 text-sm text-caramel"
      >
        Back to the shop
      </Link>
    </main>
  );
}

export default function Unsubscribe() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
