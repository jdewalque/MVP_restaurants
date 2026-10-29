// Suggests which restaurant a Reel was made for, from its caption.
// Used as a hint in the admin today; can become an automatic association later.

export interface MatchableRestaurant {
  id: string;
  name: string;
  instagramHandle: string | null;
}

export interface RestaurantMatch {
  restaurantId: string;
  reason: "mention" | "name";
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns the best restaurant match for a caption, or null.
 * An @mention of the restaurant's Instagram handle wins over its name appearing as a word.
 * Ambiguous results (several restaurants at the same level) return null.
 */
export function suggestRestaurant(caption: string | null, restaurants: MatchableRestaurant[]): RestaurantMatch | null {
  if (!caption) return null;
  const text = normalize(caption);

  const mentions = new Set([...text.matchAll(/@([a-z0-9._]+)/g)].map((m) => m[1]!.replace(/\.+$/, "")));
  const byMention = restaurants.filter((r) => r.instagramHandle && mentions.has(normalize(r.instagramHandle.replace(/^@/, ""))));
  if (byMention.length === 1) return { restaurantId: byMention[0]!.id, reason: "mention" };
  if (byMention.length > 1) return null;

  const byName = restaurants.filter((r) => {
    const name = normalize(r.name).trim();
    return name.length >= 3 && new RegExp(`(^|[^a-z0-9])${escapeRegExp(name)}([^a-z0-9]|$)`).test(text);
  });
  return byName.length === 1 ? { restaurantId: byName[0]!.id, reason: "name" } : null;
}
