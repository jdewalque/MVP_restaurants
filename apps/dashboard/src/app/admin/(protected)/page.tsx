import Link from "next/link";
import { getMetaConfig } from "@passaparola/shared/config";
import { formatDateTime } from "@passaparola/shared/format";
import { Flash } from "@/components/Flash";
import { TokenStatus } from "@/components/TokenStatus";
import { tokenHealth } from "@/lib/creators";
import { db } from "@/lib/db";
import { syncNow } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

type SyncErrorRow = { creator: string; reel?: string; kind: string; message: string };

function configStatus() {
  const missing: string[] = [];
  try {
    getMetaConfig();
  } catch (error) {
    missing.push(error instanceof Error ? error.message : String(error));
  }
  if (!process.env.TOKEN_ENCRYPTION_KEY) missing.push("Missing environment variable TOKEN_ENCRYPTION_KEY");
  return missing;
}

export default async function AdminHome(props: PageProps<"/admin">) {
  const search = (await props.searchParams) as { ok?: string; error?: string };
  const [creators, runs, counts] = await Promise.all([
    db.creator.findMany({ orderBy: { username: "asc" } }),
    db.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
    Promise.all([db.restaurant.count(), db.reel.count(), db.reel.count({ where: { restaurantId: null } }), db.reelMetricSnapshot.count()]),
  ]);
  const [restaurantCount, reelCount, unassignedCount, snapshotCount] = counts;
  const configProblems = configStatus();
  const tokenWarnings = creators.filter((c) => ["expired", "expiring"].includes(tokenHealth(c)));
  const connected = creators.filter((c) => c.accessTokenEnc);

  return (
    <>
      <h1>Overview</h1>
      <Flash ok={search.ok} error={search.error} />

      {configProblems.length ? (
        <div className="alert alert--warn">
          {configProblems.map((p) => (
            <p key={p}>{p} — see apps/dashboard/.env.example.</p>
          ))}
        </div>
      ) : null}

      {tokenWarnings.length ? (
        <div className="alert alert--warn">
          {tokenWarnings.map((c) => (
            <p key={c.id}>
              Token for @{c.username}: <TokenStatus creator={c} />. <Link href="/admin/creators">Reconnect the account</Link>.
            </p>
          ))}
        </div>
      ) : null}

      <div className="kpis">
        <div className="kpi"><p className="kpi__label">Restaurants</p><p className="kpi__value">{restaurantCount}</p></div>
        <div className="kpi"><p className="kpi__label">Connected creators</p><p className="kpi__value">{connected.length}</p><p className="kpi__note">{creators.length} in total</p></div>
        <div className="kpi"><p className="kpi__label">Reels</p><p className="kpi__value">{reelCount}</p><p className="kpi__note"><Link href="/admin/reels">{unassignedCount} without restaurant</Link></p></div>
        <div className="kpi"><p className="kpi__label">Snapshots</p><p className="kpi__value">{snapshotCount}</p></div>
      </div>

      <section className="card">
        <h2>Synchronise</h2>
        <p className="muted">
          Lists the Reels of every connected creator, fetches their statistics and stores today&apos;s snapshot. Same as{" "}
          <code>npm run sync</code> or <code>POST /api/sync</code>.
        </p>
        <form action={syncNow}>
          <button className="btn" type="submit" disabled={connected.length === 0}>
            Sync all creators now
          </button>
          {connected.length === 0 ? <span className="small muted"> — connect a creator first.</span> : null}
        </form>
      </section>

      <section className="card card--flush">
        <h2>Sync history</h2>
        {runs.length === 0 ? (
          <p className="muted" style={{ padding: "0 22px 22px" }}>No sync yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Trigger</th>
                  <th>Status</th>
                  <th className="num">Creators</th>
                  <th className="num">Reels</th>
                  <th className="num">Snapshots</th>
                  <th className="num">Max API usage</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const errors = run.errorsJson ? (JSON.parse(run.errorsJson) as SyncErrorRow[]) : [];
                  const badge = run.status === "success" ? "badge--ok" : run.status === "partial" || run.status === "running" ? "badge--warn" : "badge--danger";
                  return (
                    <tr key={run.id}>
                      <td>{formatDateTime(run.startedAt)}</td>
                      <td>{run.trigger}</td>
                      <td><span className={`badge ${badge}`}>{run.status}</span></td>
                      <td className="num">{run.creatorCount}</td>
                      <td className="num">{run.reelCount}</td>
                      <td className="num">{run.snapshotCount}</td>
                      <td className="num">{run.maxUsagePercent == null ? <span className="na">n/a</span> : `${run.maxUsagePercent}%`}</td>
                      <td className="small">
                        {errors.length === 0
                          ? "—"
                          : errors.slice(0, 5).map((e, i) => (
                              <div key={i}>
                                {e.creator}
                                {e.reel ? ` / ${e.reel}` : ""}: <strong>{e.kind}</strong> {e.message}
                              </div>
                            ))}
                        {errors.length > 5 ? <div className="muted">+{errors.length - 5} more</div> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
