import type { Puck } from "./types";

/** Approximates a series' "hidden on" date from its earliest puck's Created field, since
 * Series records don't carry a date of their own. */
export function seriesDateLabel(seriesPucks: Puck[]): string | null {
  const dates = seriesPucks
    .map((p) => (p.created ? new Date(p.created.split(" ")[0]) : null))
    .filter((d): d is Date => d != null && !Number.isNaN(d.getTime()));
  if (dates.length === 0) return null;
  const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(earliest);
}
