import Link from "next/link";
import { getMetaConfig, META_SCOPES } from "@passaparola/shared/config";
import { formatCompact, formatDateTime } from "@passaparola/shared/format";
import { Flash } from "@/components/Flash";
import { Metric } from "@/components/Metric";
import { TokenStatus } from "@/components/TokenStatus";
import { db } from "@/lib/db";
import { connectWithManualToken, deleteCreator, disconnectCreator, syncNow } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Creators" };

function redirectUri(): string {
  try {
    return getMetaConfig().redirectUri ?? "http://localhost:3000/api/auth/meta/callback";
  } catch {
    return "http://localhost:3000/api/auth/meta/callback";
  }
}

export default async function AdminCreators(props: PageProps<"/admin/creators">) {
  const search = (await props.searchParams) as { ok?: string; error?: string };
  const creators = await db.creator.findMany({ orderBy: { username: "asc" }, include: { _count: { select: { reels: true } } } });

  return (
    <>
      <h1>Creators</h1>
      <Flash ok={search.ok} error={search.error} />

      <div className="grid-2">
        <section className="card">
          <p className="eyebrow">Mode A · manual token</p>
          <h2>Paste a Graph API Explorer token</h2>
          <p className="small muted">
            In the Graph API Explorer, select the “passaparola” app, add the permissions {META_SCOPES.join(", ")}, then
            “Generate Access Token” and paste it here. It is exchanged for a long-lived token, encrypted and stored on the
            server; every Instagram account linked to the user&apos;s Pages is added as a creator.
          </p>
          <form action={connectWithManualToken} className="field" style={{ gap: 10 }}>
            <label className="field">
              <span>User access token</span>
              <textarea name="token" required autoComplete="off" spellCheck={false} placeholder="EAAG…" />
            </label>
            <button className="btn" type="submit">Connect</button>
          </form>
        </section>

        <section className="card">
          <p className="eyebrow">Mode B · Facebook Login</p>
          <h2>Connect with Instagram</h2>
          <p className="small muted">
            Opens the Facebook Login dialog. The Instagram account must be a professional account linked to a Facebook Page,
            and (while the Meta app is in development mode) its owner must be a tester of the app.
          </p>
          <p>
            {/* A plain link: the route redirects to facebook.com, which client-side navigation cannot follow. */}
            <a className="btn" href="/api/auth/meta/login">Connect my Instagram</a>
          </p>
          <p className="small muted">
            Redirect URI to allow in the Meta app: <code>{redirectUri()}</code>
          </p>
        </section>
      </div>

      <section className="card card--flush">
        <h2>Connected accounts</h2>
        {creators.length === 0 ? (
          <p className="muted" style={{ padding: "0 22px 22px" }}>No creator yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Creator</th>
                  <th className="num">Followers</th>
                  <th>Facebook Page</th>
                  <th>Via</th>
                  <th>Token</th>
                  <th className="num">Reels</th>
                  <th>Last sync</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {creators.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <a href={`https://www.instagram.com/${c.username}/`} target="_blank" rel="noopener noreferrer">@{c.username}</a>
                      <div className="small muted">IG id {c.igUserId}</div>
                    </td>
                    <td className="num"><Metric value={c.followersCount} format={formatCompact} /></td>
                    <td>{c.pageName ?? <span className="na">n/a</span>}</td>
                    <td>{c.connectedVia}</td>
                    <td>
                      <TokenStatus creator={c} />
                      {c.tokenScopes ? <div className="small muted" style={{ maxWidth: 220 }}>{c.tokenScopes.replaceAll(",", ", ")}</div> : null}
                    </td>
                    <td className="num">{c._count.reels}</td>
                    <td className="small">
                      {c.lastSyncedAt ? formatDateTime(c.lastSyncedAt) : "never"}
                      {c.lastSyncError ? <div style={{ color: "var(--danger)", maxWidth: 280 }}>{c.lastSyncError}</div> : null}
                    </td>
                    <td>
                      <div className="inline-form">
                        {c.accessTokenEnc ? (
                          <>
                            <form action={syncNow}>
                              <input type="hidden" name="creatorId" value={c.id} />
                              <input type="hidden" name="returnTo" value="/admin/creators" />
                              <button className="btn btn--small btn--ghost" type="submit">Sync</button>
                            </form>
                            <Link className="btn btn--small btn--ghost" href={`/admin/debug?creator=${c.id}`}>Debug</Link>
                            <form action={disconnectCreator}>
                              <input type="hidden" name="id" value={c.id} />
                              <button className="btn btn--small btn--ghost" type="submit">Remove token</button>
                            </form>
                          </>
                        ) : null}
                        <form action={deleteCreator}>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="btn btn--small btn--danger" type="submit">Delete</button>
                        </form>
                      </div>
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
