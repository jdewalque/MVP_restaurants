// Placeholder for restaurant owner authentication (out of scope for the prototype).
//
// Every /dashboard page calls `canViewRestaurant` before loading data. When owner
// accounts exist, check the session here (e.g. the signed-in user owns `restaurantId`)
// and the pages will not need to change.

export async function canViewRestaurant(_restaurantId: string): Promise<boolean> {
  return true;
}

/** Restaurants the current visitor may see in the /dashboard list. `null` = all. */
export async function visibleRestaurantIds(): Promise<string[] | null> {
  return null;
}
