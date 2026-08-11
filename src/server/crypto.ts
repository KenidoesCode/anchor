import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * National identifier protection (PRD §10.2).
 *
 * ASSUMPTION — UNRATIFIED / DEV-ONLY: real envelope encryption with AWS KMS is
 * not wired (no KMS in this environment). This uses AES-256-GCM with a key
 * derived from GS_DATA_KEY as a stand-in so the masking/unmasking CONTRACT is
 * real and tested. Production must swap this for KMS envelope encryption; the
 * call sites (encrypt/decrypt/mask) do not change. The plaintext NRIC never
 * leaves the server, is never logged, and is never placed in an error or URL.
 */
const KEY = scryptSync(process.env.GS_DATA_KEY ?? "dev-insecure-key-do-not-ship", "gs-nric-salt", 32);

export interface EncryptedNric {
  ciphertext: string;
  last4: string;
}

export function encryptNric(plain: string): EncryptedNric {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([iv, tag, enc]).toString("base64"),
    last4: plain.slice(-4).toUpperCase(),
  };
}

export function decryptNric(ciphertext: string): string {
  const raw = Buffer.from(ciphertext, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Masked display form — the DEFAULT everywhere (PRD §10.2). */
export function maskNric(last4: string | null): string {
  return last4 ? `•••••${last4}` : "—";
}
