import { REEL_METRICS } from "@passaparola/shared/types";
import { ACCOUNT_FIELDS, MEDIA_FIELDS, redactDeep, type GraphResponse } from "@passaparola/shared/meta";
import { db } from "@/lib/db";
import { getMetaClient } from "@/lib/meta";
import { decryptToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · API debug" };

const CALLS = [
  { id: "all", label: "All of the below" },
  { id: "token", label: "debug_token (validity, expiry, scopes)" },
  { id: "accounts", label: "me/accounts (Pages + Instagram accounts)" },
  { id: "profile", label: "{ig-user-id} (username, followers)" },
  { id: "media", label: "{ig-user-id}/media (first page, all media types)" },
  { id: "insights", label: "{media-id}/insights (grouped, then one call per metric)" },
] as const;

type Search = { creator?: string; call?: string; media?: string; metrics?: string; perMetric?: string; after?: string };

interface Panel {
  title: string;
  response: GraphResponse;
}

function DebugCall({ title, response }: Panel) {
  const body = JSON.stringify(redactDeep(response.body), null, 2);
  return (
    <div className="debug-call">
      <div className="debug-meta">
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span className={`badge ${response.ok ? "badge--ok" : "badge--danger"}`}>HTTP {response.status || "—"}</span>
        <span className="badge">{response.durationMs} ms</span>
        {response.usage.maxPercent !== null ? <span className="badge badge--warn">usage {response.usage.maxPercent}%</span> : null}
      </div>
      <p className="debug-url">GET {response.url}</p>
      {response.error ? (
        <>
          <p className="small"><strong>Error</strong></p>
          <pre className="json">{JSON.stringify(response.error.toJSON(), null, 2)}</pre>
        </>
      ) : null}
      {response.usage.appUsage || response.usage.businessUseCaseUsage ? (
        <details>
          <summary className="small">Usage headers</summary>
          <pre className="json">
            {JSON.stringify({ "x-app-usage": response.usage.appUsage, "x-business-use-case-usage": response.usage.businessUseCaseUsage }, null, 2)}
          </pre>
        </details>
      ) : null}
      <p className="small"><strong>Response body</strong> (tokens redacted)</p>
      <pre className="json">{body}</pre>
    </div>
  );
}

async function runCalls(search: Search, token: string, igUserId: string): Promise<{ panels: Panel[]; problem?: string }> {
  const meta = getMetaClient();
  const call = search.call ?? "all";
  const want = (id: string) => call === "all" || call === id;
  const panels: Panel[] = [];

  if (want("token")) panels.push({ title: "debug_token", response: await meta.rawDebugToken(token) });
  if (want("accounts")) panels.push({ title: "me/accounts", response: await meta.raw("me/accounts", { fields: ACCOUNT_FIELDS }, token) });
  if (want("profile")) {
    panels.push({ title: igUserId, response: await meta.raw(igUserId, { fields: "id,username,followers_count,media_count" }, token) });
  }
  if (want("media")) {
    panels.push({ title: `${igUserId}/media`, response: await meta.raw(`${igUserId}/media`, { fields: MEDIA_FIELDS, limit: "25", after: search.after || undefined }, token) });
  }
  if (want("insights")) {
    const mediaId = search.media?.trim();
    if (!mediaId) return { panels, problem: "Choose or type a media ID to call insights." };
    const metrics = (search.metrics?.trim() || REEL_METRICS.join(",")).split(",").map((m) => m.trim()).filter(Boolean);
    panels.push({ title: `${mediaId}/insights — grouped (${metrics.length} metrics)`, response: await meta.raw(`${mediaId}/insights`, { metric: metrics.join(",") }, token) });
    if (search.perMetric !== "off") {
      for (const metric of metrics) {
        panels.push({ title: `${mediaId}/insights — ${metric}`, response: await meta.raw(`${mediaId}/insights`, { metric }, token) });
      }
    }
  }
  return { panels };
}

export default async function DebugPage(props: PageProps<"/admin/debug">) {
  const search = (await props.searchParams) as Search;
  const creators = await db.creator.findMany({ where: { accessTokenEnc: { not: null } }, orderBy: { username: "asc" } });
  const creator = creators.find((c) => c.id === search.creator) ?? creators[0];
  const reels = creator
    ? await db.reel.findMany({ where: { creatorId: creator.id }, orderBy: { publishedAt: "desc" }, take: 50, select: { igMediaId: true, publishedAt: true, caption: true } })
    : [];

  let result: { panels: Panel[]; problem?: string } | null = null;
  let failure: string | null = null;
  if (creator && search.call) {
    try {
      result = await runCalls(search, decryptToken(creator.accessTokenEnc!), creator.igUserId);
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
  }

  return (
    <>
      <h1>Meta API debug</h1>
      <p className="muted">
        Runs the Graph API calls with a stored creator token and shows Meta&apos;s raw answers, errors and rate-limit headers.
        Tokens are redacted from the output and never sent to the browser.
      </p>

      {creators.length === 0 ? (
        <div className="alert alert--warn"><p>No creator with a token yet. Connect one in Admin → Creators.</p></div>
      ) : (
        <section className="card">
          <form method="get" className="form-grid">
            <label className="field">
              <span>Creator</span>
              <select name="creator" defaultValue={creator?.id}>
                {creators.map((c) => (
                  <option key={c.id} value={c.id}>@{c.username} ({c.igUserId})</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Call</span>
              <select name="call" defaultValue={search.call ?? "all"}>
                {CALLS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Media ID (for insights)</span>
              <input name="media" type="text" list="reel-ids" defaultValue={search.media ?? reels[0]?.igMediaId ?? ""} placeholder="17890000000000000" />
              <datalist id="reel-ids">
                {reels.map((r) => (
                  <option key={r.igMediaId} value={r.igMediaId}>{`${r.publishedAt.toISOString().slice(0, 10)} ${r.caption?.slice(0, 40) ?? ""}`}</option>
                ))}
              </datalist>
            </label>
            <label className="field">
              <span>Metrics (comma-separated)</span>
              <input name="metrics" type="text" defaultValue={search.metrics ?? REEL_METRICS.join(",")} />
            </label>
            <label className="field">
              <span>Per-metric calls</span>
              <select name="perMetric" defaultValue={search.perMetric ?? "on"}>
                <option value="on">Yes, one call per metric too</option>
                <option value="off">No, grouped call only</option>
              </select>
            </label>
            <label className="field">
              <span>Media page cursor (after)</span>
              <input name="after" type="text" defaultValue={search.after ?? ""} placeholder="from paging.cursors.after" />
            </label>
            <button className="btn" type="submit">Run</button>
          </form>
        </section>
      )}

      {failure ? <div className="alert alert--error"><p>{failure}</p></div> : null}
      {result?.problem ? <div className="alert alert--warn"><p>{result.problem}</p></div> : null}
      {result && result.panels.length > 0 ? (
        <section className="card">
          {result.panels.map((panel, i) => (
            <DebugCall key={i} {...panel} />
          ))}
        </section>
      ) : null}
    </>
  );
}
