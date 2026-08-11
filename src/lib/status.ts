export type BadgeStatus = "found" | "keep" | "rehide" | "hidden";

/** Airtable only ever sends "Found" / "Assumed Found" / "Hidden" today, but the
 * design system's Badge also supports "keep" and "rehide" for future statuses. */
export function badgeStatus(status: string): BadgeStatus {
  if (status === "Found" || status === "Assumed Found") return "found";
  return "hidden";
}
