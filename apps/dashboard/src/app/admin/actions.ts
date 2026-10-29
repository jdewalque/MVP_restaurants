"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MetaApiError } from "@passaparola/shared/meta";
import { suggestRestaurant } from "@passaparola/shared/matching";
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE, adminCookieValue, adminPassword, safeEqual } from "@/lib/admin-auth";
import { requireAdmin } from "@/lib/admin-session";
import { connectCreatorsFromUserToken } from "@/lib/creators";
import { db } from "@/lib/db";
import { runSync } from "@/lib/sync";

function errorMessage(error: unknown): string {
  if (error instanceof MetaApiError) return `${error.message} — ${error.hint}`;
  return error instanceof Error ? error.message : String(error);
}

function back(path: string, kind: "ok" | "error", message: string): never {
  redirect(`${path}?${new URLSearchParams({ [kind]: message })}`);
}

/** Only allow redirects to admin pages after login. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
}

// --- Session ---------------------------------------------------------------

export async function login(formData: FormData) {
  const password = adminPassword();
  const next = safeNext(formData.get("next"));
  if (!password) redirect("/admin/login?error=ADMIN_PASSWORD+is+not+set+on+the+server");
  const given = String(formData.get("password") ?? "");
  if (!safeEqual(given, password)) redirect(`/admin/login?error=Wrong+password&next=${encodeURIComponent(next)}`);

  (await cookies()).set(ADMIN_COOKIE, (await adminCookieValue())!, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
  redirect(next);
}

export async function logout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

// --- Restaurants -----------------------------------------------------------

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseRestaurantForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const neighborhood = String(formData.get("neighborhood") ?? "").trim();
  const price = Number(String(formData.get("monthlyPrice") ?? "").replace(",", "."));
  const handle = String(formData.get("instagramHandle") ?? "").trim().replace(/^@/, "");
  const since = String(formData.get("subscriptionStartedAt") ?? "");
  if (!name || !neighborhood) throw new Error("Name and neighbourhood are required.");
  if (!Number.isFinite(price) || price < 0) throw new Error("The monthly price must be a positive number.");
  return {
    name,
    neighborhood,
    monthlyPriceCents: Math.round(price * 100),
    instagramHandle: handle || null,
    ...(/^\d{4}-\d{2}-\d{2}$/.test(since) ? { subscriptionStartedAt: new Date(`${since}T00:00:00Z`) } : {}),
  };
}

export async function createRestaurant(formData: FormData) {
  await requireAdmin();
  let message: string;
  try {
    const data = parseRestaurantForm(formData);
    let slug = slugify(data.name) || "restaurant";
    if (await db.restaurant.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
    await db.restaurant.create({ data: { ...data, slug } });
    message = `Restaurant “${data.name}” added.`;
  } catch (error) {
    back("/admin/restaurants", "error", errorMessage(error));
  }
  revalidatePath("/dashboard");
  back("/admin/restaurants", "ok", message);
}

export async function updateRestaurant(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  try {
    await db.restaurant.update({ where: { id }, data: parseRestaurantForm(formData) });
  } catch (error) {
    back("/admin/restaurants", "error", errorMessage(error));
  }
  revalidatePath("/dashboard");
  back("/admin/restaurants", "ok", "Restaurant updated.");
}

export async function deleteRestaurant(formData: FormData) {
  await requireAdmin();
  await db.restaurant.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/dashboard");
  back("/admin/restaurants", "ok", "Restaurant deleted. Its Reels are now unassigned.");
}

// --- Creators --------------------------------------------------------------

/** Mode A: a token pasted from the Graph API Explorer. */
export async function connectWithManualToken(formData: FormData) {
  await requireAdmin();
  const token = String(formData.get("token") ?? "").trim();
  if (!token) back("/admin/creators", "error", "Paste a user access token first.");
  let message: string;
  try {
    const result = await connectCreatorsFromUserToken(token, "manual");
    const names = result.accounts.map((a) => `@${a.username}${a.created ? " (new)" : " (updated)"}`).join(", ");
    message = `Connected ${names}.${result.warnings.length ? ` ${result.warnings.join(" ")}` : ""}`;
  } catch (error) {
    back("/admin/creators", "error", errorMessage(error));
  }
  back("/admin/creators", "ok", message);
}

export async function disconnectCreator(formData: FormData) {
  await requireAdmin();
  await db.creator.update({
    where: { id: String(formData.get("id")) },
    data: { accessTokenEnc: null, tokenExpiresAt: null, dataAccessExpiresAt: null, tokenScopes: null },
  });
  back("/admin/creators", "ok", "Token removed. Reels and snapshots are kept.");
}

export async function deleteCreator(formData: FormData) {
  await requireAdmin();
  await db.creator.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/dashboard");
  back("/admin/creators", "ok", "Creator, Reels and snapshots deleted.");
}

// --- Sync ------------------------------------------------------------------

export async function syncNow(formData: FormData) {
  await requireAdmin();
  const creatorId = String(formData.get("creatorId") ?? "") || undefined;
  const returnTo = String(formData.get("returnTo") ?? "/admin") === "/admin/creators" ? "/admin/creators" : "/admin";
  let summary: Awaited<ReturnType<typeof runSync>>;
  try {
    summary = await runSync({ trigger: "admin", creatorId });
  } catch (error) {
    back(returnTo, "error", `Sync failed: ${errorMessage(error)}`);
  }
  revalidatePath("/dashboard", "layout");
  const text = `Sync ${summary.status}: ${summary.creatorCount} creator(s), ${summary.reelCount} Reel(s), ${summary.snapshotCount} snapshot(s).`;
  back(returnTo, summary.status === "success" ? "ok" : "error", summary.errors.length ? `${text} ${summary.errors.length} error(s), see the sync history.` : text);
}

// --- Reel ↔ restaurant -----------------------------------------------------

export async function assignReel(formData: FormData) {
  await requireAdmin();
  const restaurantId = String(formData.get("restaurantId") ?? "");
  await db.reel.update({ where: { id: String(formData.get("reelId")) }, data: { restaurantId: restaurantId || null } });
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin/reels");
}

export async function applySuggestions() {
  await requireAdmin();
  const restaurants = await db.restaurant.findMany({ select: { id: true, name: true, instagramHandle: true } });
  const reels = await db.reel.findMany({ where: { restaurantId: null }, select: { id: true, caption: true } });
  let count = 0;
  for (const reel of reels) {
    const match = suggestRestaurant(reel.caption, restaurants);
    if (match) {
      await db.reel.update({ where: { id: reel.id }, data: { restaurantId: match.restaurantId } });
      count += 1;
    }
  }
  revalidatePath("/dashboard", "layout");
  back("/admin/reels", "ok", `${count} Reel(s) assigned from caption suggestions.`);
}
