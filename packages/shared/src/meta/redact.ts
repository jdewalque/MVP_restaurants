// Helpers that keep access tokens and secrets out of logs and out of the browser.

const SECRET_PARAMS = ["access_token", "client_secret", "input_token", "fb_exchange_token", "code"];
const SECRET_KEYS = new Set(["access_token", "accessToken", "client_secret", "token", "input_token"]);

/** "EAAGm0PX4ZCpsBA…9FzD (212 chars)" — enough to tell tokens apart, never the whole token. */
export function redactToken(token: string | null | undefined): string {
  if (!token) return "(none)";
  if (token.length <= 12) return `*** (${token.length} chars)`;
  return `${token.slice(0, 6)}…${token.slice(-4)} (${token.length} chars)`;
}

/** Replaces secret query parameters (access_token, client_secret, …) in a URL. */
export function redactUrl(url: string): string {
  return url.replace(
    new RegExp(`([?&](?:${SECRET_PARAMS.join("|")})=)([^&#]*)`, "g"),
    (_match, prefix: string, value: string) => `${prefix}${redactToken(decodeURIComponent(value))}`,
  );
}

/** Deep copy of a JSON value with tokens redacted (secret keys and URLs carrying tokens). */
export function redactDeep<T>(value: T): T {
  if (typeof value === "string") {
    return (/[?&](access_token|client_secret|input_token)=/.test(value) ? redactUrl(value) : value) as T;
  }
  if (Array.isArray(value)) return value.map((item) => redactDeep(item)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = SECRET_KEYS.has(key) && typeof item === "string" ? redactToken(item) : redactDeep(item);
    }
    return out as T;
  }
  return value;
}
