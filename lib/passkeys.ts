import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { db } from "./stock";
import { SHOP } from "./config";

/**
 * The bare domain, always. A passkey registered against kappabakes.com works
 * on www.kappabakes.com too, because www is a subdomain of it — but one
 * registered against www.kappabakes.com would not work on the bare domain.
 */
const rpID = (process.env.RP_ID ?? "localhost")
  .trim()
  .replace(/^https?:\/\//, "")
  .replace(/^www\./, "")
  .replace(/\/.*$/, "");
/**
 * A passkey is bound to the exact origin it was made on, which is what makes
 * it unphishable — but it also means www and the bare domain count as two
 * different sites. Both are accepted here, so registering on one and signing
 * in from the other works.
 *
 * RP_ORIGIN can also be a comma-separated list if you ever need more.
 */
const origins = (() => {
  const configured = (process.env.RP_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  const all = new Set(configured);
  for (const o of configured) {
    if (o.includes("://www.")) all.add(o.replace("://www.", "://"));
    else all.add(o.replace("://", "://www."));
  }
  return [...all];
})();

/** Challenges live for five minutes and are deleted the moment they're used. */
async function storeChallenge(challenge: string, email?: string) {
  await db.webAuthnChallenge.create({
    data: { challenge, email, expiresAt: new Date(Date.now() + 5 * 60_000) },
  });
}

async function takeChallenge(challenge: string) {
  const row = await db.webAuthnChallenge.findFirst({
    where: { challenge, expiresAt: { gt: new Date() } },
  });
  if (row) await db.webAuthnChallenge.delete({ where: { id: row.id } });
  return row;
}

export async function registrationOptions(email: string) {
  const existing = await db.passkey.findMany({ where: { email } });

  const options = await generateRegistrationOptions({
    rpName: `${SHOP.name} admin`,
    rpID,
    userName: email,
    userDisplayName: email,
    attestationType: "none",
    // Don't offer to add a key this device already has.
    excludeCredentials: existing.map((k) => ({
      id: k.credentialId,
      transports: k.transports as never,
    })),
    authenticatorSelection: {
      // Discoverable, so signing in needs no email typed first.
      residentKey: "required",
      userVerification: "preferred",
    },
  });

  await storeChallenge(options.challenge, email);
  return options;
}

export async function verifyRegistration(
  email: string,
  response: RegistrationResponseJSON,
  label: string
) {
  const clientData = JSON.parse(
    Buffer.from(response.response.clientDataJSON, "base64url").toString()
  );
  const stored = await takeChallenge(clientData.challenge);
  if (!stored || stored.email !== email) return false;

  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: stored.challenge,
    expectedOrigin: origins,
    expectedRPID: rpID,
  });
  if (!result.verified || !result.registrationInfo) return false;

  const { credential } = result.registrationInfo;
  await db.passkey.create({
    data: {
      email,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: (credential.transports ?? []) as string[],
      label: label.trim() || "This device",
    },
  });
  return true;
}

export async function authenticationOptions() {
  // No allowCredentials: the device offers whichever passkey it holds, so
  // there's nothing to type before Face ID appears.
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });
  await storeChallenge(options.challenge);
  return options;
}

/** Returns the email the passkey belongs to, or null. */
export async function verifyAuthentication(
  response: AuthenticationResponseJSON
): Promise<string | null> {
  const clientData = JSON.parse(
    Buffer.from(response.response.clientDataJSON, "base64url").toString()
  );
  const stored = await takeChallenge(clientData.challenge);
  if (!stored) return null;

  const key = await db.passkey.findUnique({
    where: { credentialId: response.id },
  });
  if (!key) return null;

  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: stored.challenge,
    expectedOrigin: origins,
    expectedRPID: rpID,
    credential: {
      id: key.credentialId,
      publicKey: new Uint8Array(key.publicKey),
      counter: key.counter,
      transports: key.transports as never,
    },
  });
  if (!result.verified) return null;

  await db.passkey.update({
    where: { id: key.id },
    data: {
      counter: result.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    },
  });
  return key.email;
}
