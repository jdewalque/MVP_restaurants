import Link from "next/link";
import { formatDate, formatInt } from "@passaparola/shared/format";
import { suggestRestaurant } from "@passaparola/shared/matching";
import { Flash } from "@/components/Flash";
import { Metric } from "@/components/Metric";
import { Thumbnail } from "@/components/Thumbnail";
import { db } from "@/lib/db";
import { applySuggestions, assignReel } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Reels" };

export default async function AdminReels(props: PageProps<"/admin/reels">) {
  const search = (await props.searchParams) as { ok?: string; error?: string; show?: string };
  const showAll = search.show === "all";
  const [restaurants, reels] = await Promise.all([
    db.restaurant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, instagramHandle: true } }),
    db.reel.findMany({
      where: showAll ? undefined : { restaurantId: null },
      orderBy: { publishedAt: "desc" },
      include: { creator: true, restaurant: true, snapshots: { orderBy: { day: "desc" }, take: 1 } },
    }),
  ]);
  const names = new Map(restaurants.map((r) => [r.id, r.name]));
  const withSuggestion = reels.map((reel) => ({ reel, suggestion: reel.restaurantId ? null : suggestRestaurant(reel.caption, restaurants) }));
  const suggestionCount = withSuggestion.filter((r) => r.suggestion).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reels ↔ restaurants</h1>
          <p className="muted">
            Meta does not say which restaurant a Reel was made for: choose it here. Suggestions come from @mentions or the
            restaurant name in the caption.
          </p>
        </div>
        <div className="inline-form">
          <Link className="btn btn--small btn--ghost" href={showAll ? "/admin/reels" : "/admin/reels?show=all"}>
            {showAll ? "Show unassigned only" : "Show all Reels"}
          </Link>
          {suggestionCount > 0 ? (
            <form action={applySuggestions}>
              <button className="btn btn--small" type="submit">Apply {suggestionCount} suggestion(s)</button>
            </form>
          ) : null}
        </div>
      </div>
      <Flash ok={search.ok} error={search.error} />

      <section className="card card--flush">
        {reels.length === 0 ? (
          <p className="muted" style={{ padding: 22 }}>
            {showAll ? "No Reels synced yet." : "Every Reel has a restaurant."}
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reel</th>
                  <th>Creator</th>
                  <th>Published</th>
                  <th>Caption</th>
                  <th className="num">Views</th>
                  <th>Restaurant</th>
                </tr>
              </thead>
              <tbody>
                {withSuggestion.map(({ reel, suggestion }) => (
                  <tr key={reel.id}>
                    <td>
                      {reel.permalink ? (
                        <a href={reel.permalink} target="_blank" rel="noopener noreferrer">
                          <Thumbnail src={reel.thumbnailUrl} alt={`Reel by @${reel.creator.username}`} />
                        </a>
                      ) : (
                        <Thumbnail src={reel.thumbnailUrl} alt={`Reel by @${reel.creator.username}`} />
                      )}
                    </td>
                    <td>@{reel.creator.username}</td>
                    <td>{formatDate(reel.publishedAt)}</td>
                    <td><div className="caption small">{reel.caption ?? <span className="na">no caption</span>}</div></td>
                    <td className="num"><Metric value={reel.snapshots[0]?.views} format={formatInt} /></td>
                    <td>
                      <form action={assignReel} className="inline-form">
                        <input type="hidden" name="reelId" value={reel.id} />
                        <select name="restaurantId" defaultValue={reel.restaurantId ?? suggestion?.restaurantId ?? ""} aria-label="Restaurant">
                          <option value="">— none —</option>
                          {restaurants.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                        <button className="btn btn--small" type="submit">Save</button>
                      </form>
                      {suggestion ? (
                        <div className="small" style={{ marginTop: 4 }}>
                          <span className="badge badge--accent">suggested</span> {names.get(suggestion.restaurantId)} (
                          {suggestion.reason === "mention" ? "@mention" : "name in caption"})
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
