// npm run seed — demo data to explore the dashboard without a connected Instagram account.
// Idempotent: removes previous demo rows (demo creators and restaurants) and recreates them.
// Real creators, restaurants and snapshots are never touched.

import { toDay } from "@passaparola/shared/metrics";
import { db } from "../src/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 21;

// Deterministic pseudo-random numbers so the demo looks the same on every run.
let state = 42;
function rand(): number {
  state = (state * 1664525 + 1013904223) % 2 ** 32;
  return state / 2 ** 32;
}
const between = (min: number, max: number) => Math.round(min + rand() * (max - min));

const restaurants = [
  { slug: "demo-osteria-isola", name: "Osteria Isola (demo)", neighborhood: "Isola", monthlyPriceCents: 29000, instagramHandle: "demo.osteria.isola", sinceDays: 75 },
  { slug: "demo-pho-nolo", name: "Pho NoLo (demo)", neighborhood: "NoLo", monthlyPriceCents: 24000, instagramHandle: "demo.pho.nolo", sinceDays: 40 },
  { slug: "demo-forno-ticinese", name: "Forno Ticinese (demo)", neighborhood: "Ticinese", monthlyPriceCents: 19000, instagramHandle: null, sinceDays: 20 },
];

const creators = [
  { igUserId: "demo-1001", username: "demo.giulia.mangia", followersCount: 8400 },
  { igUserId: "demo-1002", username: "demo.marco.milano", followersCount: 3100 },
  { igUserId: "demo-1003", username: "demo.sara.eats", followersCount: 5600 },
  { igUserId: "demo-1004", username: "demo.luca.foodie", followersCount: 1450 },
];

interface DemoReel {
  creator: number;
  restaurant: number | null;
  ageDays: number;
  finalViews: number;
  caption: string;
  /** Metrics Meta "did not return" for this Reel, to show n/a in the UI. */
  missing?: Array<"shares" | "avgWatchTimeMs" | "reach">;
  neverSynced?: boolean;
}

const reels: DemoReel[] = [
  { creator: 0, restaurant: 0, ageDays: 34, finalViews: 18400, caption: "Il risotto giallo più buono di Isola 🍛 @demo.osteria.isola" },
  { creator: 1, restaurant: 0, ageDays: 18, finalViews: 6200, caption: "Cena in osteria, ottimo rapporto qualità prezzo" },
  { creator: 2, restaurant: 0, ageDays: 6, finalViews: 9100, caption: "Ossobuco day #milano", missing: ["avgWatchTimeMs"] },
  { creator: 3, restaurant: 0, ageDays: 2, finalViews: 1300, caption: "Primo assaggio da Osteria Isola", neverSynced: true },
  { creator: 2, restaurant: 1, ageDays: 25, finalViews: 12700, caption: "Pho fumante a NoLo 🍜 @demo.pho.nolo" },
  { creator: 3, restaurant: 1, ageDays: 11, finalViews: 3900, caption: "Street food vietnamita a due passi da Loreto", missing: ["shares"] },
  { creator: 0, restaurant: 2, ageDays: 9, finalViews: 15200, caption: "Focaccia appena sfornata in Ticinese" },
  { creator: 1, restaurant: 2, ageDays: 4, finalViews: 4800, caption: "Colazione da Forno Ticinese ☕️", missing: ["reach"] },
  // Not assigned yet: shows up in Admin → Reels with a suggestion from the @mention.
  { creator: 1, restaurant: null, ageDays: 3, finalViews: 2600, caption: "Bun bo hue spettacolare da @demo.pho.nolo" },
];

/** Cumulative value after `age` days for a Reel that ends at `final` (fast growth then plateau). */
function grown(final: number, age: number): number {
  return Math.round(final * (1 - Math.exp(-0.45 * (age + 1))));
}

async function main() {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  await db.creator.deleteMany({ where: { connectedVia: "demo" } });
  await db.restaurant.deleteMany({ where: { slug: { in: restaurants.map((r) => r.slug) } } });

  const restaurantRows = [];
  for (const { sinceDays, ...r } of restaurants) {
    restaurantRows.push(await db.restaurant.create({ data: { ...r, subscriptionStartedAt: new Date(today - sinceDays * DAY_MS) } }));
  }
  const creatorRows = [];
  for (const c of creators) {
    creatorRows.push(await db.creator.create({ data: { ...c, connectedVia: "demo", lastSyncedAt: now } }));
  }

  let snapshotCount = 0;
  for (const [index, demo] of reels.entries()) {
    const publishedAt = new Date(today - demo.ageDays * DAY_MS + between(11, 21) * 60 * 60 * 1000);
    const reel = await db.reel.create({
      data: {
        igMediaId: `demo-media-${index + 1}`,
        creatorId: creatorRows[demo.creator]!.id,
        restaurantId: demo.restaurant === null ? null : restaurantRows[demo.restaurant]!.id,
        permalink: null,
        thumbnailUrl: null,
        caption: demo.caption,
        mediaType: "VIDEO",
        publishedAt,
      },
    });
    if (demo.neverSynced) continue;

    const reachRatio = 0.55 + rand() * 0.25;
    const likeRatio = 0.03 + rand() * 0.04;
    const avgWatchMs = between(4500, 11000);
    const firstDay = Math.min(demo.ageDays, HISTORY_DAYS - 1);
    for (let daysAgo = firstDay; daysAgo >= 0; daysAgo--) {
      const age = demo.ageDays - daysAgo;
      const views = grown(demo.finalViews, age);
      const likes = Math.round(views * likeRatio);
      const comments = Math.round(likes * 0.08);
      const shares = Math.round(likes * 0.12);
      const saved = Math.round(likes * 0.15);
      await db.reelMetricSnapshot.create({
        data: {
          reelId: reel.id,
          day: toDay(new Date(today - daysAgo * DAY_MS)),
          collectedAt: new Date(today - daysAgo * DAY_MS + 6 * 60 * 60 * 1000),
          views,
          reach: demo.missing?.includes("reach") ? null : Math.round(views * reachRatio),
          likes,
          comments,
          shares: demo.missing?.includes("shares") ? null : shares,
          saved,
          totalInteractions: likes + comments + shares + saved,
          avgWatchTimeMs: demo.missing?.includes("avgWatchTimeMs") ? null : avgWatchMs,
          totalWatchTimeMs: views * avgWatchMs,
          insightsMode: "demo",
        },
      });
      snapshotCount += 1;
    }
  }

  console.log(`Demo data: ${restaurantRows.length} restaurants, ${creatorRows.length} creators, ${reels.length} Reels, ${snapshotCount} snapshots.`);
}

try {
  await main();
} finally {
  await db.$disconnect();
}
