import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getMetaConfig } from "@passaparola/shared/config";
import { buildLoginUrl } from "@passaparola/shared/meta";
import { OAUTH_STATE_COOKIE } from "@/lib/oauth";

/** Mode B: redirects to the Facebook Login dialog with the permissions the app needs. */
export async function GET(request: Request) {
  const config = getMetaConfig();
  const redirectUri = config.redirectUri ?? new URL("/api/auth/meta/callback", request.url).toString();
  const state = randomBytes(16).toString("hex");

  const response = NextResponse.redirect(
    buildLoginUrl({ appId: config.appId, graphVersion: config.graphVersion, redirectUri, state, configId: config.loginConfigId }),
  );
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: redirectUri.startsWith("https://"),
    path: "/api/auth/meta",
    maxAge: 600,
  });
  return response;
}
