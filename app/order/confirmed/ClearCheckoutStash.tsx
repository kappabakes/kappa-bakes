"use client";

import { useEffect } from "react";

/**
 * Forgets the checkout session once an order is paid for.
 *
 * The order page remembers it so a browser back button can release held
 * slices. Reaching this page means they paid, so there's nothing to release —
 * and leaving it stashed would have the next visit to the order page ask
 * Stripe about a session that's already complete. Harmless, but pointless.
 */
export function ClearCheckoutStash() {
  useEffect(() => {
    try {
      sessionStorage.removeItem("kb-checkout-session");
    } catch {
      /* private browsing */
    }
  }, []);

  return null;
}
