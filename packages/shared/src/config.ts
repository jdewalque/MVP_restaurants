// Configuration shared by every app. Values come from environment variables
// and must only be read on the server (the secret never reaches the browser).

export const DEFAULT_META_GRAPH_VERSION = "v26.0";

/** Permissions requested by the Facebook Login dialog. */
export const META_SCOPES = [
  "instagram_basic",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
] as const;

/** Warn in the admin when a token expires within this many days. */
export const TOKEN_EXPIRY_WARNING_DAYS = 10;

/** Days in a "month" when prorating the monthly subscription over a period. */
export const DAYS_PER_BILLING_MONTH = 30;

export interface MetaConfig {
  appId: string;
  appSecret: string;
  graphVersion: string;
  redirectUri: string | null;
  /** Optional Facebook Login for Business configuration ID (replaces `scope` when set). */
  loginConfigId: string | null;
  /** Override of https://graph.facebook.com, only for tests against a fake Graph API. */
  graphBaseUrl: string | null;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new ConfigError(`Missing environment variable ${name}`);
  return value;
}

export function getMetaConfig(env: Record<string, string | undefined> = process.env): MetaConfig {
  return {
    appId: required(env, "META_APP_ID"),
    appSecret: required(env, "META_APP_SECRET"),
    graphVersion: env.META_GRAPH_VERSION?.trim() || DEFAULT_META_GRAPH_VERSION,
    redirectUri: env.META_REDIRECT_URI?.trim() || null,
    loginConfigId: env.META_LOGIN_CONFIG_ID?.trim() || null,
    graphBaseUrl: env.META_GRAPH_BASE_URL?.trim() || null,
  };
}
