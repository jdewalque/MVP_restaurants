import Link from "next/link";
import { logout } from "../actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="container">
      <p className="eyebrow">Admin</p>
      <nav className="subnav" aria-label="Admin">
        <Link href="/admin">Overview &amp; sync</Link>
        <Link href="/admin/restaurants">Restaurants</Link>
        <Link href="/admin/creators">Creators</Link>
        <Link href="/admin/reels">Reels ↔ restaurants</Link>
        <Link href="/admin/debug">API debug</Link>
        <form action={logout} style={{ display: "inline" }}>
          <button className="btn btn--small btn--ghost" type="submit">
            Log out
          </button>
        </form>
      </nav>
      {children}
    </main>
  );
}
