import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminCookie } from "./admin-auth";

/** Second line of defence for server actions (the proxy already guards /admin). */
export async function requireAdmin(): Promise<void> {
  const store = await cookies();
  if (!(await isValidAdminCookie(store.get(ADMIN_COOKIE)?.value))) {
    throw new Error("Unauthorized");
  }
}
