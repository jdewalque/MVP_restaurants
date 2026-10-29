import { login } from "../actions";

export const metadata = { title: "Admin login" };

export default async function LoginPage(props: PageProps<"/admin/login">) {
  const search = (await props.searchParams) as { error?: string; next?: string };
  return (
    <main className="container">
      <div className="card login">
        <p className="eyebrow">Admin</p>
        <h1>Sign in</h1>
        {search.error ? (
          <div className="alert alert--error" role="alert">
            <p>{search.error}</p>
          </div>
        ) : null}
        <form action={login} className="field" style={{ gap: 12 }}>
          <input type="hidden" name="next" value={search.next ?? "/admin"} />
          <div className="field">
            <label htmlFor="password">Admin password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
          </div>
          <button className="btn" type="submit">
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
