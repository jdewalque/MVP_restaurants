import { formatDate } from "@passaparola/shared/format";
import { effectiveExpiry, tokenHealth } from "@/lib/creators";

type Creator = { accessTokenEnc: string | null; tokenExpiresAt: Date | null; dataAccessExpiresAt: Date | null; connectedVia: string };

export function TokenStatus({ creator }: { creator: Creator }) {
  const health = tokenHealth(creator);
  const expiry = effectiveExpiry(creator);
  switch (health) {
    case "none":
      return <span className="badge">{creator.connectedVia === "demo" ? "demo, no token" : "no token"}</span>;
    case "unknown":
      return <span className="badge">expiry unknown</span>;
    case "expired":
      return <span className="badge badge--danger">expired {formatDate(expiry)}</span>;
    case "expiring":
      return <span className="badge badge--warn">expires {formatDate(expiry)}</span>;
    default:
      return <span className="badge badge--ok">valid until {formatDate(expiry)}</span>;
  }
}
