import crypto from "crypto";
import { cookies } from "next/headers";

const SECRET = process.env.SESSION_SECRET ?? "";
const COOKIE = "kb_session";
const SESSION_DAYS = 7;

/**
 * Emails allowed to sign in, comma-separated in ADMIN_EMAILS. Order matters:
 * the first is the one codes go to by default, the rest are the fallbacks
 * behind "use another address".
 */
export const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "").replace(/\s+/g, "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export const isAdminEmail = (email: string) =>
  adminEmails().includes(email.trim().toLowerCase());

export const emailAt = (index: number): string | null =>
  adminEmails()[index] ?? null;

/**
 * "kap•••••@gmail.com" — enough for you to tell which inbox to check, not
 * enough for a stranger who loads the sign-in page to harvest the addresses.
 */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return "•••";
  const head = name.slice(0, 3);
  return `${head}${"•".repeat(Math.max(3, name.length - 3))}@${domain}`;
}

const b64 = (s: string | Buffer) =>
  Buffer.from(s).toString("base64url");

function sign(payload: string) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/** payload.signature — the signature is what makes it unforgeable. */
export function createSession(email: string) {
  const payload = b64(
    JSON.stringify({
      email: email.toLowerCase(),
      exp: Date.now() + SESSION_DAYS * 86_400_000,
    })
  );
  return `${payload}.${sign(payload)}`;
}

export function readSession(token?: string): string | null {
  if (!token || !SECRET) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  // Constant-time compare, so the signature can't be guessed byte by byte.
  const expected = sign(payload);
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  )
    return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data.exp || data.exp < Date.now()) return null;
    if (!isAdminEmail(data.email)) return null; // removed from the allowlist
    return data.email as string;
  } catch {
    return null;
  }
}

/** Every admin route calls this. No session, no data. */
export function currentAdmin(): string | null {
  return readSession(cookies().get(COOKIE)?.value);
}

export const SESSION_COOKIE = COOKIE;

export const cookieOptions = {
  httpOnly: true, // JavaScript can't read it, so a script injection can't steal it
  /**
   * A "secure" cookie is only stored over HTTPS. Browsers treat localhost as
   * secure, but a phone hitting your Mac at 192.168.x.x over plain HTTP is
   * not — so the cookie would be silently dropped, sign-in would appear to
   * work, and every admin request would come back unauthorised with no
   * explanation.
   *
   * ALLOW_INSECURE_COOKIE lets a production build be tested over the local
   * network. Never set it on Vercel: everything there is HTTPS.
   */
  secure:
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_INSECURE_COOKIE !== "true",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 86_400,
};

/** Six digits, generated with real randomness rather than Math.random. */
export const newCode = () =>
  String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

export const hashCode = (code: string) =>
  crypto.createHash("sha256").update(code + SECRET).digest("hex");
