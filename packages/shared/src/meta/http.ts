// Low-level Graph API transport: builds URLs, reads usage headers, turns errors into MetaApiError.

import { classifyGraphError, MetaApiError, type GraphErrorBody } from "./errors";
import { redactUrl } from "./redact";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface MetaLogger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
}

export const consoleLogger: MetaLogger = {
  info: (message, data) => console.info(`[meta] ${message}`, data ?? ""),
  warn: (message, data) => console.warn(`[meta] ${message}`, data ?? ""),
};

export interface UsageInfo {
  /** Parsed X-App-Usage header (percentages of the app limit). */
  appUsage: Record<string, number> | null;
  /** Parsed X-Business-Use-Case-Usage header, keyed by business object id. */
  businessUseCaseUsage: Record<string, Array<Record<string, unknown>>> | null;
  /** Highest percentage found in either header, null if no header. */
  maxPercent: number | null;
}

export interface GraphResponse<T = unknown> {
  /** Request URL with tokens redacted. */
  url: string;
  status: number;
  ok: boolean;
  body: T | null;
  usage: UsageInfo;
  error: MetaApiError | null;
  durationMs: number;
}

/** Usage percentage above which every call logs a warning. */
export const USAGE_WARNING_PERCENT = 75;

function parseJsonHeader(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function parseUsageHeaders(headers: Headers): UsageInfo {
  const appUsage = parseJsonHeader(headers.get("x-app-usage")) as Record<string, number> | null;
  const businessUseCaseUsage = parseJsonHeader(headers.get("x-business-use-case-usage")) as UsageInfo["businessUseCaseUsage"];

  const percents: number[] = [];
  for (const key of ["call_count", "total_time", "total_cputime"]) {
    const value = appUsage?.[key];
    if (typeof value === "number") percents.push(value);
  }
  for (const entries of Object.values(businessUseCaseUsage ?? {})) {
    for (const entry of Array.isArray(entries) ? entries : []) {
      for (const key of ["call_count", "total_time", "total_cputime"]) {
        const value = entry[key];
        if (typeof value === "number") percents.push(value);
      }
    }
  }

  return {
    appUsage,
    businessUseCaseUsage,
    maxPercent: percents.length ? Math.max(...percents) : null,
  };
}

export interface HttpOptions {
  graphVersion: string;
  fetch: FetchLike;
  logger: MetaLogger;
  baseUrl?: string;
  /** Called after every request (e.g. to track rate-limit usage across a sync run). */
  onResponse?: (response: GraphResponse) => void;
}

export function graphBaseUrl(options: Pick<HttpOptions, "graphVersion" | "baseUrl">): string {
  return `${options.baseUrl ?? "https://graph.facebook.com"}/${options.graphVersion}`;
}

/**
 * GET a Graph API path (e.g. "me/accounts") or an absolute URL (e.g. a `paging.next` link).
 * Never throws: errors are returned in `error`, so the debug page can show them as-is.
 */
export async function graphGet<T = unknown>(
  options: HttpOptions,
  pathOrUrl: string,
  params: Record<string, string | undefined>,
  token: string | null,
): Promise<GraphResponse<T>> {
  const url = new URL(/^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${graphBaseUrl(options)}/${pathOrUrl.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  if (token && !url.searchParams.has("access_token")) url.searchParams.set("access_token", token);

  const safeUrl = redactUrl(url.toString());
  const path = safeUrl.replace(/^https?:\/\/[^/]+/, "");
  const started = Date.now();

  let response: Response;
  try {
    response = await options.fetch(url.toString(), { method: "GET", headers: { Accept: "application/json" } });
  } catch (cause) {
    const error = new MetaApiError({
      kind: "network",
      message: cause instanceof Error ? cause.message : String(cause),
      httpStatus: 0,
      path,
    });
    options.logger.warn(`GET ${path} failed: network error`, { message: error.message });
    const failed: GraphResponse<T> = { url: safeUrl, status: 0, ok: false, body: null, usage: parseUsageHeaders(new Headers()), error, durationMs: Date.now() - started };
    options.onResponse?.(failed);
    return failed;
  }

  const usage = parseUsageHeaders(response.headers);
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const errorBody = (body as { error?: GraphErrorBody } | null)?.error;
  let error: MetaApiError | null = null;
  if (!response.ok || errorBody) {
    error = new MetaApiError({
      kind: classifyGraphError(errorBody, response.status),
      message: errorBody?.message ?? `HTTP ${response.status}`,
      httpStatus: response.status,
      path,
      body: errorBody,
    });
  }

  const logData: Record<string, unknown> = { status: response.status, ms: Date.now() - started };
  if (usage.appUsage) logData.appUsage = usage.appUsage;
  if (usage.businessUseCaseUsage) logData.businessUseCaseUsage = usage.businessUseCaseUsage;
  if (error) {
    logData.error = { kind: error.kind, code: error.code, subcode: error.subcode, message: error.message };
    options.logger.warn(`GET ${path}`, logData);
  } else if (usage.maxPercent !== null && usage.maxPercent >= USAGE_WARNING_PERCENT) {
    options.logger.warn(`GET ${path} — rate limit usage at ${usage.maxPercent}%`, logData);
  } else {
    options.logger.info(`GET ${path}`, logData);
  }

  const result: GraphResponse<T> = { url: safeUrl, status: response.status, ok: !error, body: body as T, usage, error, durationMs: Date.now() - started };
  options.onResponse?.(result);
  return result;
}
