import Link from "next/link";
import { formatCompact, formatEuroCents, formatPercent } from "@passaparola/shared/format";
import { computeKpis } from "@passaparola/shared/metrics";
import { Metric } from "@/components/Metric";
import { db } from "@/lib/db";
import { resolvePeriod } from "@/lib/period";
import { snapshotToMetrics } from "@/lib/restaurant-data";
import { visibleRestaurantIds } from "@/lib/restaurant-access";

export const dynamic = "force-dynamic";
export const metadata = { title: "Restaurants" };

export default async function RestaurantsPage() {
  const visible = await visibleRestaurantIds();
  const restaurants = await db.restaurant.findMany({
    where: visible ? { id: { in: visible } } : undefined,
    orderBy: { name: "asc" },
    include: { reels: { include: { snapshots: { orderBy: { day: "desc" }, take: 1 } } } },
  });

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <p className="eyebrow">Restaurant dashboard</p>
          <h1>Restaurants</h1>
          <p className="muted">Creator Reels performance over the last 30 days.</p>
        </div>
      </div>

      {restaurants.length === 0 ? (
        <div className="card">
          <p>
            No restaurants yet. Add one in <Link href="/admin/restaurants">Admin → Restaurants</Link> or load demo data with{" "}
            <code>npm run seed</code>.
          </p>
        </div>
      ) : (
        <div className="restaurant-list">
          {restaurants.map((restaurant) => {
            const period = resolvePeriod({ period: "30d" }, { earliest: restaurant.subscriptionStartedAt });
            const kpis = computeKpis(
              restaurant.reels.map((reel) => ({
                id: reel.id,
                creatorId: reel.creatorId,
                publishedAt: reel.publishedAt,
                latest: reel.snapshots[0] ? snapshotToMetrics(reel.snapshots[0]) : null,
              })),
              { period, monthlyPriceCents: restaurant.monthlyPriceCents, subscriptionStartedAt: restaurant.subscriptionStartedAt },
            );
            return (
              <Link key={restaurant.id} href={`/dashboard/${restaurant.slug}`} className="card restaurant-card">
                <p className="eyebrow">{restaurant.neighborhood}</p>
                <h2>{restaurant.name}</h2>
                <p className="muted small">{formatEuroCents(restaurant.monthlyPriceCents)} / month</p>
                <dl>
                  <div>
                    <dt>Reels</dt>
                    <dd>{kpis.reelCount}</dd>
                  </div>
                  <div>
                    <dt>Views</dt>
                    <dd>
                      <Metric value={kpis.views} format={formatCompact} />
                    </dd>
                  </div>
                  <div>
                    <dt>Engagement</dt>
                    <dd>
                      <Metric value={kpis.engagementRate} format={formatPercent} />
                    </dd>
                  </div>
                  <div>
                    <dt>Cost / 1,000 views</dt>
                    <dd>
                      <Metric value={kpis.costPerThousandViewsCents} format={formatEuroCents} />
                    </dd>
                  </div>
                </dl>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
