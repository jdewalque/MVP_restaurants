// Classification of Graph API errors into the few cases the app reacts to.

export type MetaErrorKind =
  | "token_expired" // token expired, revoked or invalid: the account must be reconnected
  | "permission_denied" // a permission is missing or was not granted
  | "rate_limited" // app or business use case limit reached: retry later
  | "invalid_request" // bad parameter, e.g. a metric not supported for this media
  | "network" // no response from Meta
  | "unknown";

export interface GraphErrorBody {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
  fbtrace_id?: string;
}

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

export function classifyGraphError(error: GraphErrorBody | undefined, httpStatus: number): MetaErrorKind {
  const code = error?.code;
  if (code === 190 || code === 102 || code === 463 || code === 467) return "token_expired";
  if (code === 10 || (code !== undefined && code >= 200 && code <= 299)) return "permission_denied";
  if (code !== undefined && (RATE_LIMIT_CODES.has(code) || (code >= 80000 && code <= 80099))) return "rate_limited";
  if (code === 100) return "invalid_request";
  if (httpStatus === 429) return "rate_limited";
  if (httpStatus === 401) return "token_expired";
  if (httpStatus === 403) return "permission_denied";
  return "unknown";
}

const HINTS: Record<MetaErrorKind, string> = {
  token_expired: "The access token has expired or was revoked. Reconnect this account.",
  permission_denied: "A permission is missing. Check the permissions granted to the app for this account.",
  rate_limited: "Meta rate limit reached. Wait before syncing again.",
  invalid_request: "Meta rejected the request parameters.",
  network: "Could not reach the Meta Graph API.",
  unknown: "Unexpected error from the Meta Graph API.",
};

export class MetaApiError extends Error {
  readonly kind: MetaErrorKind;
  readonly httpStatus: number;
  readonly code: number | undefined;
  readonly subcode: number | undefined;
  readonly fbtraceId: string | undefined;
  /** Path of the failed call, with tokens redacted. */
  readonly path: string;

  constructor(options: { kind: MetaErrorKind; message: string; httpStatus: number; path: string; body?: GraphErrorBody }) {
    super(options.message);
    this.name = "MetaApiError";
    this.kind = options.kind;
    this.httpStatus = options.httpStatus;
    this.path = options.path;
    this.code = options.body?.code;
    this.subcode = options.body?.error_subcode;
    this.fbtraceId = options.body?.fbtrace_id;
  }

  /** Short explanation suitable for the admin UI. */
  get hint(): string {
    return HINTS[this.kind];
  }

  toJSON() {
    return {
      kind: this.kind,
      message: this.message,
      hint: this.hint,
      httpStatus: this.httpStatus,
      code: this.code,
      subcode: this.subcode,
      fbtraceId: this.fbtraceId,
      path: this.path,
    };
  }
}

/** True for errors where retrying the same call (or another metric) cannot help. */
export function isFatalForAccount(error: unknown): boolean {
  return (
    error instanceof MetaApiError &&
    (error.kind === "token_expired" || error.kind === "permission_denied" || error.kind === "rate_limited")
  );
}
