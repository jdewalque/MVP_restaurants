import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidAdminCookie, isValidSyncSecret } from "@/lib/admin-auth";

// Protects the admin area, the sync endpoint and the Meta OAuth routes.
// /dashboard has no authentication yet (see src/lib/restaurant-access.ts).
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  if (await isValidAdminCookie(request.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    if (pathname === "/api/sync" && isValidSyncSecret(request.headers.get("authorization"))) return NextResponse.next();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/admin/login", request.url);
  login.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*", "/api/sync", "/api/auth/meta/:path*"],
};
