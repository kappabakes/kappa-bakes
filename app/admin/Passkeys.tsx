"use client";

import { useCallback, useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";

type Key = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function Passkeys({ flash }: { flash: (m: string) => void }) {
  const [keys, setKeys] = useState<Key[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/auth/passkey/list");
    if (r.ok) setKeys((await r.json()).keys);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    const label = prompt("Name this device", "My iPhone");
    if (label === null) return;
    setBusy(true);
    try {
      const options = await (await fetch("/api/admin/auth/passkey/register")).json();
      const response = await startRegistration({ optionsJSON: options });
      const r = await fetch("/api/admin/auth/passkey/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, label }),
      });
      flash(r.ok ? "Passkey added" : "That didn't work — try again.");
      load();
    } catch {
      flash("Cancelled.");
    }
    setBusy(false);
  }

  async function remove(k: Key) {
    if (!confirm(`Remove ${k.label}? You'll need the password and a code to sign in on it again.`))
      return;
    await fetch(`/api/admin/auth/passkey/list?id=${k.id}`, { method: "DELETE" });
    flash("Passkey removed");
    load();
  }

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl text-ink">
          Sign-in devices
        </h2>
        <button
          onClick={add}
          disabled={busy}
          className="border border-navy px-3 py-1.5 text-xs text-gold disabled:opacity-30"
        >
          {busy ? "Waiting…" : "Add this device"}
        </button>
      </div>

      <p className="mt-3 text-xs text-muted">
        Adds Face ID or Touch ID sign-in for this device. Apple syncs it through
        iCloud Keychain, so your other Apple devices get it too. Free, instant,
        and nothing to type.
      </p>

      <ul className="mt-4 divide-y divide-line">
        {keys.map((k) => (
          <li key={k.id} className="flex flex-wrap items-center gap-3 bg-paper px-4 py-3 text-sm">
            <span className="grow font-display text-[15px]">{k.label}</span>
            <span className="font-mono text-[11px] text-muted">
              {k.lastUsedAt
                ? `last used ${new Date(k.lastUsedAt).toLocaleDateString("en-GB")}`
                : "not used yet"}
            </span>
            <button
              onClick={() => remove(k)}
              className="border border-line px-3 py-1 text-xs text-muted"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      {keys.length === 0 && (
        <p className="mt-4 text-sm text-muted">
          No devices yet. Add one and you&apos;ll never type the password again.
        </p>
      )}
    </section>
  );
}
