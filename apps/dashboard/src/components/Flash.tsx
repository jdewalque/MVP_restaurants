/** Success / error message passed back by admin server actions through ?ok= or ?error=. */
export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (error) {
    return (
      <div className="alert alert--error" role="alert">
        <p>{error}</p>
      </div>
    );
  }
  if (ok) {
    return (
      <div className="alert" role="status">
        <p>{ok}</p>
      </div>
    );
  }
  return null;
}
