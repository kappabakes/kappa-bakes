import Stripe from "stripe";

/**
 * The key goes into an HTTP Authorization header, and headers reject anything
 * outside a narrow set of characters. A newline from copying is the usual
 * culprit, but zero-width spaces and smart punctuation survive a normal trim
 * and fail the same way — with a "connection error" that says nothing about
 * the real cause.
 *
 * A Stripe key is only letters, numbers and underscores, so keeping just
 * those removes every possibility at once.
 */
function cleanKey(): string {
  const raw = process.env.STRIPE_SECRET_KEY ?? "";
  const key = raw.replace(/[^A-Za-z0-9_]/g, "");

  if (!key) {
    console.error("STRIPE_SECRET_KEY is not set.");
  } else {
    if (raw.length !== key.length)
      console.warn(
        `STRIPE_SECRET_KEY had ${raw.length - key.length} character(s) that can't go in a header — stripped. Worth re-pasting it in Vercel.`
      );
    if (!/^sk_(test|live)_/.test(key))
      console.error(
        `STRIPE_SECRET_KEY should start sk_test_ or sk_live_, but starts "${key.slice(0, 8)}". If it starts pk_, that's the publishable key — you need the secret one.`
      );
  }

  return key;
}

let client: Stripe | null = null;

/**
 * Built on first use, not when the file is imported.
 *
 * Constructing it at import time meant the build itself needed a valid key —
 * and failed with "Failed to collect page data" if one wasn't there, which
 * says nothing about the cause. Nothing at build time talks to Stripe, so
 * there's no reason to need it then.
 */
export function getStripe(): Stripe {
  if (!client) client = new Stripe(cleanKey());
  return client;
}
