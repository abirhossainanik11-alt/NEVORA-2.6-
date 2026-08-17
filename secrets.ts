import "server-only";
import crypto from "node:crypto";
import { prisma } from "./db";

// AES-256-GCM at-rest encryption for provider API keys.
// The master key MUST come from a real secret manager / platform env var
// (e.g. Vercel encrypted env vars, AWS KMS, etc.) — never committed to Git (§99).
const MASTER_KEY = process.env.NEVORA_SECRET_KEY;

function requireMasterKey(): Buffer {
  if (!MASTER_KEY || MASTER_KEY.length < 32) {
    throw new Error(
      "NEVORA_SECRET_KEY is missing or too short. Set a 32+ byte random secret in your environment before storing provider API keys."
    );
  }
  return crypto.createHash("sha256").update(MASTER_KEY).digest();
}

export function encryptSecret(plain: string): string {
  const key = requireMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const key = requireMasterKey();
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Save a provider's API key. Only ever call this from an admin-authorized route. */
export async function saveProviderKey(provider: "GEMINI" | "OPENAI" | "ANTHROPIC", apiKey: string) {
  const encryptedKey = encryptSecret(apiKey);
  const last4 = apiKey.slice(-4);
  await prisma.aIProviderSecret.upsert({
    where: { provider },
    update: { encryptedKey, last4 },
    create: { provider, encryptedKey, last4 },
  });
}

export async function getDecryptedKey(provider: "GEMINI" | "OPENAI" | "ANTHROPIC"): Promise<string | null> {
  const row = await prisma.aIProviderSecret.findUnique({ where: { provider } });
  if (!row) return null;
  return decryptSecret(row.encryptedKey);
}

/** Safe to send to the Admin UI — never the real key. */
export async function getMaskedKeyPreview(provider: "GEMINI" | "OPENAI" | "ANTHROPIC"): Promise<string | null> {
  const row = await prisma.aIProviderSecret.findUnique({ where: { provider } });
  if (!row) return null;
  return `••••••••••••${row.last4}`;
}
