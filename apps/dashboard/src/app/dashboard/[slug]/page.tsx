import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatCompact,
  formatDate,
  formatDuration,
  formatEuroCents,
  formatInt,
  formatPercent,
  formatUtcDate,
} from "@passaparola/shared/format";
import { Kpi } from "@/components/Kpi";
import { Metric } from "@/components/Metric";
import { PeriodPicker } from "@/components/PeriodPicker";
import { Thumbnail } from "@/components/Thumbnail";
import { ViewsChart } from "@/components/ViewsChart";
import { canViewRestaurant } from "@/lib/restaurant-access";
import { loadRestaurantDashboard } from "@/lib/restaurant-data";

export const dynamic = "force-dynamic";

type Search = { period?: string; from?: string; to?: string };

export async function generateMetadata(props: PageProps<"/dashboard/[slug]">) {
  const { slug } = await props.params;
  return { title: slug.replace(/-/g, " ") };
}

export default async function RestaurantPage(props: PageProps<"/dashboard/[slug]">) {
  const { slug } = await props.params;
  const search = (await props.searchParams) as Search;
  const data = await loadRestaurantDashboard(slug, search);
  if (!data || !(await canViewRestaurant(data.restaurant.id))) notFound();

  const { restaurant, period, kpis, reels, byCreator, series } = data;
  const hasDemo = reels.some((r) => r.creator.connectedVia === "demo");
  const basePath = `/dashboard/${restaurant.slug}`;

  return (
    <main className="container">
      <p className="small">
        <Link href="/dashboard">← All restaurants</Link>
      </p>
      <div className="page-head">
        <div>
          <p className="eyebrow">{restaurant.neighborhood}</p>
          <h1>{restaurant.name}</h1>
          <p className="muted">
            {formatEuroCents(restaurant.monthlyPriceCents)} / month · subscribed since {formatDate(restaurant.subscriptionStartedAt)}
          </p>
        </div>
      </div>

      {hasDemo ? (
        <div className="alert alert--warn">
          <p>Demo data: some Reels below come from the seed script, not from Instagram.</p>
        </div>
      ) : null}

      <div className="card">
        <PeriodPicker basePath={basePath} period={period} />
        <p className="small muted" style={{ margin: "10px 0 0" }}>
          {formatUtcDate(period.from)} – {formatUtcDate(period.to)}. Counts the Reels published in this period, with their latest
          known statistics.
        </p>
      </div>

      <div className="kpis">
        <Kpi label="Reels" note={kpis.syncedReelCount < kpis.reelCount ? `${kpis.reelCount - kpis.syncedReelCount} not synced yet` : undefined}>
          {kpis.reelCount}
        </Kpi>
        <Kpi label="Total views" note={kpis.missing.views ? `n/a for ${kpis.missing.views} Reel(s)` : undefined}>
          <Metric value={kpis.views} format={formatInt} />
        </Kpi>
        <Kpi label="Total reach" note={kpis.missing.reach ? `n/a for ${kpis.missing.reach} Reel(s)` : "Sum of each Reel's reach"}>
          <Metric value={kpis.reach} format={formatInt} />
        </Kpi>
        <Kpi label="Total interactions" note="Likes + comments + shares + saves">
          <Metric value={kpis.interactions} format={formatInt} />
        </Kpi>
        <Kpi
          label="Engagement rate"
          note={kpis.engagementReelCount ? `Interactions / reach, on ${kpis.engagementReelCount} Reel(s)` : "Interactions / reach"}
        >
          <Metric value={kpis.engagementRate} format={formatPercent} />
        </Kpi>
        <Kpi label="Cost per 1,000 views" note={`${formatEuroCents(kpis.costCents)} for this period (prorated)`}>
          <Metric value={kpis.costPerThousandViewsCents} format={formatEuroCents} />
        </Kpi>
      </div>

      <section className="card" aria-labelledby="chart-title">
        <h2 id="chart-title">Views and reach over time</h2>
        {series.length > 1 ? (
          <>
            <ViewsChart data={series} />
            <p className="small muted">
              Cumulative totals for this period&apos;s Reels, from the daily snapshots. A day without a snapshot reuses the
              previous one.
            </p>
          </>
        ) : (
          <p className="muted">Not enough history yet: the chart appears after at least two daily syncs.</p>
        )}
      </section>

      <section className="card card--flush" aria-labelledby="reels-title">
        <h2 id="reels-title">Reels</h2>
        {reels.length === 0 ? (
          <p className="muted" style={{ padding: "0 22px 22px" }}>
            No Reels published in this period.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reel</th>
                  <th>Creator</th>
                  <th>Published</th>
                  <th className="num">Views</th>
                  <th className="num">Reach</th>
                  <th className="num">Likes</th>
                  <th className="num">Comments</th>
                  <th className="num">Shares</th>
                  <th className="num">Saves</th>
                  <th className="num">Avg. watch time</th>
                  <th className="num">Engagement</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {reels.map((reel) => (
                  <tr key={reel.id}>
                    <td>
                      <Thumbnail src={reel.thumbnailUrl} alt={`Reel by @${reel.creator.username}`} />
                    </td>
                    <td>
                      @{reel.creator.username}
                      {reel.creator.connectedVia === "demo" ? (
                        <>
                          {" "}
                          <span className="badge">demo</span>
                        </>
                      ) : null}
                    </td>
                    <td>{formatDate(reel.publishedAt)}</td>
                    <td className="num"><Metric value={reel.latest?.views} format={formatInt} /></td>
                    <td className="num"><Metric value={reel.latest?.reach} format={formatInt} /></td>
                    <td className="num"><Metric value={reel.latest?.likes} format={formatInt} /></td>
                    <td className="num"><Metric value={reel.latest?.comments} format={formatInt} /></td>
                    <td className="num"><Metric value={reel.latest?.shares} format={formatInt} /></td>
                    <td className="num"><Metric value={reel.latest?.saved} format={formatInt} /></td>
                    <td className="num"><Metric value={reel.latest?.avgWatchTimeMs} format={formatDuration} /></td>
                    <td className="num"><Metric value={reel.engagementRate} format={formatPercent} /></td>
                    <td>
                      {reel.permalink ? (
                        <a href={reel.permalink} target="_blank" rel="noopener noreferrer">
                          Open ↗
                        </a>
                      ) : (
                        <span className="na">n/a</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {reels.length > 0 ? (
          <p className="small muted" style={{ padding: "10px 22px 18px", margin: 0 }}>
            Latest snapshot per Reel{reels[0]?.latestDay ? ` (most recent: ${reels[0].latestDay})` : ""}. “n/a” means Meta did not
            return the metric.
          </p>
        ) : null}
      </section>

      <section className="card card--flush" aria-labelledby="creators-title">
        <h2 id="creators-title">By creator</h2>
        {byCreator.length === 0 ? (
          <p className="muted" style={{ padding: "0 22px 22px" }}>
            No creator Reels in this period.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Creator</th>
                  <th className="num">Followers</th>
                  <th className="num">Reels</th>
                  <th className="num">Views</th>
                  <th className="num">Reach</th>
                  <th className="num">Interactions</th>
                  <th className="num">Engagement</th>
                </tr>
              </thead>
              <tbody>
                {byCreator.map((row) => (
                  <tr key={row.creatorId}>
                    <td>@{row.creator.username}</td>
                    <td className="num"><Metric value={row.creator.followersCount} format={formatCompact} /></td>
                    <td className="num">{row.reelCount}</td>
                    <td className="num"><Metric value={row.views} format={formatInt} /></td>
                    <td className="num"><Metric value={row.reach} format={formatInt} /></td>
                    <td className="num"><Metric value={row.interactions} format={formatInt} /></td>
                    <td className="num"><Metric value={row.engagementRate} format={formatPercent} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
