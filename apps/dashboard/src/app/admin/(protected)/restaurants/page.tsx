import Link from "next/link";
import { toDay } from "@passaparola/shared/metrics";
import { Flash } from "@/components/Flash";
import { db } from "@/lib/db";
import { createRestaurant, deleteRestaurant, updateRestaurant } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Restaurants" };

type RestaurantFields = {
  name?: string;
  neighborhood?: string;
  monthlyPriceCents?: number;
  instagramHandle?: string | null;
  subscriptionStartedAt?: Date;
};

function RestaurantFields({ r = {} }: { r?: RestaurantFields }) {
  return (
    <>
      <label className="field">
        <span>Name</span>
        <input name="name" type="text" defaultValue={r.name} required />
      </label>
      <label className="field">
        <span>Neighbourhood</span>
        <input name="neighborhood" type="text" defaultValue={r.neighborhood} required />
      </label>
      <label className="field">
        <span>Monthly price (€)</span>
        <input name="monthlyPrice" type="number" min="0" step="0.01" defaultValue={r.monthlyPriceCents != null ? r.monthlyPriceCents / 100 : undefined} required />
      </label>
      <label className="field">
        <span>Instagram handle</span>
        <input name="instagramHandle" type="text" placeholder="@restaurant" defaultValue={r.instagramHandle ?? ""} />
      </label>
      <label className="field">
        <span>Subscribed since</span>
        <input name="subscriptionStartedAt" type="date" defaultValue={r.subscriptionStartedAt ? toDay(r.subscriptionStartedAt) : toDay(new Date())} />
      </label>
    </>
  );
}

export default async function AdminRestaurants(props: PageProps<"/admin/restaurants">) {
  const search = (await props.searchParams) as { ok?: string; error?: string };
  const restaurants = await db.restaurant.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { reels: true } } } });

  return (
    <>
      <h1>Restaurants</h1>
      <Flash ok={search.ok} error={search.error} />

      <section className="card">
        <h2>Add a restaurant</h2>
        <form action={createRestaurant} className="form-grid">
          <RestaurantFields />
          <button className="btn" type="submit">Add</button>
        </form>
      </section>

      {restaurants.map((r) => (
        <section className="card" key={r.id}>
          <div className="page-head" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>{r.name}</h2>
            <span className="small">
              {r._count.reels} Reel(s) · <Link href={`/dashboard/${r.slug}`}>Open dashboard</Link>
            </span>
          </div>
          <form action={updateRestaurant} className="form-grid">
            <input type="hidden" name="id" value={r.id} />
            <RestaurantFields r={r} />
            <button className="btn btn--ghost" type="submit">Save</button>
          </form>
          <form action={deleteRestaurant} style={{ marginTop: 12 }}>
            <input type="hidden" name="id" value={r.id} />
            <button className="btn btn--small btn--danger" type="submit">Delete restaurant</button>
          </form>
        </section>
      ))}
    </>
  );
}
