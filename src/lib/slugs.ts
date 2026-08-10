/**
 * Matches the live site's existing URL convention (confirmed against a sample export of
 * 135 Pucks records: 135/135 matched). It's lowercase-and-strip-whitespace, NOT a
 * hyphenated slugify() — punctuation like apostrophes and periods is left as typed
 * (e.g. "Let's Get Lit" -> "let'sgetlit"). Swapping this for a generic slugify library
 * would break migrated URLs (bit.ly links, bookmarks, search results) pointing at the
 * old site.
 */
export function legacySlug(value: string): string {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

export interface ParsedUrlSlugs {
  seriesSlug: string;
  puckSlug: string;
}

/** Extracts the /{series}/{puck} path segments from an existing puck URL, ignoring any query string. */
export function parseSlugsFromUrl(url: string): ParsedUrlSlugs | null {
  try {
    const { pathname } = new URL(url);
    const segments = pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
    if (segments.length < 2) return null;
    return { seriesSlug: segments[0], puckSlug: segments[1] };
  } catch {
    return null;
  }
}
