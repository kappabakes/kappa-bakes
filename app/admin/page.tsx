"use client";

import { useCallback, useEffect, useState } from "react";
import { SHOP } from "@/lib/config";
import { Shell, Section } from "./Shell";
import { Dashboard } from "./Dashboard";
import { Orders } from "./Orders";
import { MenuManager } from "./Menu";
import { DaysManager } from "./Days";
import { Archive } from "./Archive";
import { Customers } from "./Customers";
import { Campaigns } from "./Campaigns";
import { Passkeys } from "./Passkeys";
import { TestTools } from "./TestTools";
import { ShopDetails } from "./ShopDetails";
import { GalleryManager } from "./GalleryManager";
import { Card, PageHead } from "./ui";

type Stage = "checking" | "password" | "code" | "in";
type Option = { index: number; masked: string };

export default function Admin() {
  const [stage, setStage] = useState<Stage>("checking");
  const [options, setOptions] = useState<Option[]>([]);
  const [target, setTarget] = useState(0);
  const [sentTo, setSentTo] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [who, setWho] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const [section, setSection] = useState<Section | null>("dashboard");

  const flash = useCallback((m: string) => {
    setFlashMsg(m);
    setTimeout(() => setFlashMsg(null), 4000);
  }, []);

  useEffect(() => {
    fetch("/api/admin/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.signedIn) {
          setWho(d.email);
          setStage("in");
        } else setStage("password");
      })
      .catch(() => setStage("password"));

    fetch("/api/admin/auth/options")
      .then((r) => r.json())
      .then((d) => setOptions(d.options ?? []));
  }, []);

  // On a phone the sections are a drill-down, so start on the menu itself.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024)
      setSection(null);
  }, []);

  async function sendCode(index = target) {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/auth/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, index }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.error) return setError(d.error);
    setTarget(index);
    setSentTo(d.sentTo);
    setCode("");
    setStage("code");
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error);
    setWho(d.email);
    setPassword("");
    setCode("");
    setStage("in");
  }

  async function passkeySignIn() {
    setBusy(true);
    setError(null);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const options = await (
        await fetch("/api/admin/auth/passkey/login")
      ).json();
      const response = await startAuthentication({ optionsJSON: options });
      const r = await fetch("/api/admin/auth/passkey/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const d = await r.json();
      if (!r.ok) setError(d.error ?? "That didn't work.");
      else {
        setWho(d.email);
        setStage("in");
      }
    } catch {
      setError(null); // cancelled, or no passkey on this device
    }
    setBusy(false);
  }

  async function signOut() {
    await fetch("/api/admin/auth/signout", { method: "POST" });
    setStage("password");
    setWho("");
  }

  /* ---------- sign in ---------- */
  if (stage === "checking")
    return <main className="p-10 text-sm text-ink2">One moment…</main>;

  if (stage !== "in") {
    const other = options.find((o) => o.index !== target);
    return (
      <main className="mx-auto max-w-sm px-5 py-24">
        <Card>
          <h1 className="font-display text-3xl text-ink">
            {SHOP.name} admin
          </h1>

          {stage === "password" && (
            <>
              <button
                onClick={passkeySignIn}
                disabled={busy}
                className="mt-6 w-full rounded-btn bg-navy py-3.5 font-semibold text-white transition-colors hover:bg-navy-hover disabled:opacity-40"
              >
                {busy ? "Waiting…" : "Sign in with Face ID"}
              </button>
              <p className="mt-2 text-center text-[12px] text-muted">
                Once you&apos;ve added this device.
              </p>

              <div className="my-6 flex items-center gap-3">
                <span className="h-px grow bg-line" />
                <span className="text-[11px] uppercase tracking-wide text-muted">
                  or
                </span>
                <span className="h-px grow bg-line" />
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-ink">
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendCode(0)}
                  className="w-full rounded-btn border border-field bg-paper px-3.5 py-2.5 text-[15px] focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/15"
                />
              </label>
              {error && <p className="mt-3 text-sm text-bad">{error}</p>}
              <button
                onClick={() => sendCode(0)}
                disabled={busy || !password}
                className="mt-5 w-full rounded-btn bg-gold py-3.5 font-semibold text-white transition-colors hover:bg-gold-hover disabled:opacity-40"
              >
                {busy ? "Sending…" : "Send me a code"}
              </button>
              {options[0] && (
                <p className="mt-2 text-center text-[12px] text-muted">
                  Goes to {options[0].masked}
                </p>
              )}
            </>
          )}

          {stage === "code" && (
            <>
              <p className="mt-3 text-sm text-ink2">
                Please enter the 6-digit code sent to{" "}
                <span className="font-semibold text-ink">{sentTo}</span>
              </p>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && verify()}
                className="mt-5 w-full rounded-btn border border-field bg-paper px-3.5 py-3 text-center text-2xl tracking-[0.4em] text-ink focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/15"
              />
              {error && <p className="mt-3 text-sm text-bad">{error}</p>}
              <button
                onClick={verify}
                disabled={busy || code.length !== 6}
                className="mt-5 w-full rounded-btn bg-navy py-3.5 font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Checking…" : "Sign in"}
              </button>

              <div className="mt-5 space-y-2 text-center text-[13px]">
                <button
                  onClick={() => sendCode(target)}
                  className="block w-full text-gold-hover underline underline-offset-4"
                >
                  Resend the code
                </button>
                {other && (
                  <button
                    onClick={() => sendCode(other.index)}
                    className="block w-full text-ink2 underline underline-offset-4"
                  >
                    Use another address — {other.masked}
                  </button>
                )}
                <button
                  onClick={() => {
                    setStage("password");
                    setCode("");
                    setError(null);
                  }}
                  className="block w-full text-ink2 underline underline-offset-4"
                >
                  Start again
                </button>
              </div>
            </>
          )}
        </Card>
      </main>
    );
  }

  /* ---------- signed in ---------- */
  return (
    <Shell
      section={section}
      setSection={setSection}
      who={who}
      onSignOut={signOut}
    >
      {flashMsg && (
        <p className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-btn bg-navy px-5 py-3 text-sm text-white shadow-card">
          {flashMsg}
        </p>
      )}

      {section === "dashboard" && (
        <Dashboard go={(s) => setSection(s)} />
      )}
      {section === "orders" && <Orders flash={flash} />}
      {section === "menu" && <MenuManager flash={flash} />}
      {section === "dates" && <DaysManager flash={flash} />}
      {section === "customers" && <Customers flash={flash} />}
      {section === "archive" && <Archive flash={flash} />}
      {section === "broadcast" && (
        <>
          <PageHead
            title="Broadcasts"
            note="Email customers who ordered and opted in."
          />
          <Campaigns />
        </>
      )}
      {section === "settings" && (
        <>
          <PageHead
            title="Settings"
            note="Shop details, sign-in devices and testing."
          />
          <ShopDetails flash={flash} />
          <GalleryManager flash={flash} />
          <Passkeys flash={flash} />
          <TestTools flash={flash} />
          <p className="mt-8 text-[13px] text-muted">
            Refunds are done in the Stripe dashboard, deliberately — not here.
          </p>
        </>
      )}
    </Shell>
  );
}
