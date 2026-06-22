import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Secret, TOTP } from "otpauth";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const PRIVILEGED_ROLES = new Set(["chairman", "secretary", "treasurer", "facility_manager"]);

export type MfaLoginRequirement = "not_required" | "enrollment_required" | "verification_required";

function getEncryptionKey(): Buffer {
  const configuredKey = process.env.MFA_ENCRYPTION_KEY?.trim();

  if (!configuredKey || configuredKey.length < 32) {
    throw new Error("MFA_ENCRYPTION_KEY must be configured with at least 32 characters.");
  }

  return createHash("sha256").update(configuredKey).digest();
}

function createTotp(secret: string): TOTP {
  return new TOTP({
    secret: Secret.fromBase32(secret),
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
  });
}

export function requiresMfa(role: string): boolean {
  return PRIVILEGED_ROLES.has(role);
}

export function resolveMfaLoginRequirement(
  role: string,
  encryptedSecret: string | null,
  enrolledAt: Date | null,
): MfaLoginRequirement {
  if (!requiresMfa(role)) return "not_required";
  return encryptedSecret && enrolledAt ? "verification_required" : "enrollment_required";
}

export function generateTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function encryptTotpSecret(secret: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptTotpSecret(encryptedSecret: string): string {
  const [version, iv, tag, ciphertext, ...extraParts] = encryptedSecret.split(".");

  if (version !== "v1" || !iv || !tag || !ciphertext || extraParts.length > 0) {
    throw new Error("Invalid encrypted MFA secret.");
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Invalid encrypted MFA secret.");
  }
}

export function generateTotpToken(secret: string, timestamp = Date.now()): string {
  return createTotp(secret).generate({ timestamp });
}

export function verifyTotpToken(secret: string, token: string, timestamp = Date.now()): boolean {
  if (!/^\d{6}$/.test(token)) return false;

  try {
    return createTotp(secret).validate({ token, timestamp, window: 1 }) !== null;
  } catch {
    return false;
  }
}
