// Minimal password protection for /admin (prototype only).
// The cookie holds an HMAC of the password, so changing ADMIN_PASSWORD logs everyone out
// and the password itself is never stored in the browser.

export const ADMIN_COOKIE = "pp_admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Buffer.from(signature).toString("hex");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function adminPassword(): string | null {
  return process.env.ADMIN_PASSWORD?.trim() || null;
}

export async function adminCookieValue(): Promise<string | null> {
  const password = adminPassword();
  return password ? hmacHex(password, "passaparola-admin-v1") : null;
}

export async function isValidAdminCookie(value: string | undefined): Promise<boolean> {
  const expected = await adminCookieValue();
  return Boolean(expected && value && safeEqual(value, expected));
}

/** For scheduled jobs: "Authorization: Bearer <SYNC_SECRET>". */
export function isValidSyncSecret(authorization: string | null): boolean {
  const secret = process.env.SYNC_SECRET?.trim();
  const provided = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return Boolean(secret && provided && safeEqual(provided, secret));
}
