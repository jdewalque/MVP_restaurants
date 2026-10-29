import { NextResponse, type NextRequest } from "next/server";
import { getMetaConfig } from "@passaparola/shared/config";
import { MetaApiError } from "@passaparola/shared/meta";
import { connectCreatorsFromUserToken } from "@/lib/creators";
import { getMetaClient } from "@/lib/meta";
import { OAUTH_STATE_COOKIE } from "@/lib/oauth";

/** Mode B: Facebook redirects here with ?code=… (or ?error=…). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const back = (status: "ok" | "error", message: string) => {
    const url = new URL("/admin/creators", request.url);
    url.searchParams.set(status, message);
    const response = NextResponse.redirect(url);
    response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth/meta" });
    return response;
  };

  if (params.get("error")) {
    return back("error", `Facebook Login was cancelled or refused: ${params.get("error_description") ?? params.get("error")}`);
  }
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || state !== request.cookies.get(OAUTH_STATE_COOKIE)?.value) {
    return back("error", "Invalid or expired login attempt (state mismatch). Please try again.");
  }

  try {
    const config = getMetaConfig();
    const redirectUri = config.redirectUri ?? new URL("/api/auth/meta/callback", request.url).toString();
    const shortLived = await getMetaClient().exchangeCodeForToken(code, redirectUri);
    const result = await connectCreatorsFromUserToken(shortLived.accessToken, "oauth");
    const names = result.accounts.map((a) => `@${a.username}`).join(", ");
    return back("ok", `Connected ${names}.${result.warnings.length ? ` ${result.warnings.join(" ")}` : ""}`);
  } catch (error) {
    const message = error instanceof MetaApiError ? `${error.message} — ${error.hint}` : error instanceof Error ? error.message : String(error);
    return back("error", message);
  }
}
