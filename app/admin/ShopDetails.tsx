"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Card, Area, readError } from "./ui";

/**
 * The collection address. Kept here rather than in code because a change of
 * address shouldn't need a developer — and because it appears in four places
 * at once: the confirmation screen, the confirmation email, the tracking page
 * and the order record.
 */
export function ShopDetails({ flash }: { flash: (m: string) => void }) {
  const [address, setAddress] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/settings");
    if (!r.ok) return;
    const d = await r.json();
    setAddress(d.collectionAddress ?? "");
    setSaved(d.collectionAddress ?? "");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setBusy(true);
    const r = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionAddress: address }),
    });
    setBusy(false);
    if (!r.ok) return flash(await readError(r));
    const d = await r.json();
    setSaved(d.collectionAddress);
    flash("Collection address updated");
  }

  return (
    <Card className="mb-5">
      <h2 className="font-display text-xl text-ink">Collection address</h2>
      <p className="mt-1 text-[13px] text-ink2">
        One line per line. Customers only see this after they&apos;ve paid —
        it appears on the confirmation screen, in the confirmation email, on
        the tracking page and on the order record.
      </p>

      <div className="mt-4 max-w-md">
        <Area
          label="Address"
          value={address}
          onChange={setAddress}
          rows={4}
          placeholder={"95 Woodfield Avenue\nBatley\nWest Yorkshire\nWF17 7DU"}
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Btn onClick={save} disabled={busy || address === saved || !address.trim()}>
          {busy ? "Saving…" : "Save address"}
        </Btn>
        {address !== saved && (
          <span className="text-[13px] text-gold-hover">Unsaved changes</span>
        )}
      </div>

      <p className="mt-3 text-[12px] text-muted">
        Changing this doesn&apos;t rewrite confirmations already sent. Resend
        any affected orders from the Orders screen.
      </p>
    </Card>
  );
}
