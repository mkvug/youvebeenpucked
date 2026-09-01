import type { Puck, Series } from "./types";

function createdTime(puck: Puck): number {
  if (!puck.created) return 0;
  const t = new Date(puck.created).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Pucks in the order they were hidden — earliest `created` first. Pucks with no
 * usable date sort to the front (time 0). */
export function sortPucksByCreated(pucks: Puck[]): Puck[] {
  return [...pucks].sort((a, b) => createdTime(a) - createdTime(b));
}

/** Series newest-first, ranked by their most recently created puck. Series with no
 * dated pucks sort to the end. */
export function sortSeriesByRecency(series: Series[], pucks: Puck[]): Series[] {
  const newestBySlug = new Map<string, number>();
  for (const puck of pucks) {
    const t = createdTime(puck);
    if (t > (newestBySlug.get(puck.seriesSlug) ?? -Infinity)) {
      newestBySlug.set(puck.seriesSlug, t);
    }
  }
  return [...series].sort(
    (a, b) =>
      (newestBySlug.get(b.slug) ?? -Infinity) - (newestBySlug.get(a.slug) ?? -Infinity),
  );
}
