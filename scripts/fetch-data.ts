import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchAllRecords } from "../src/lib/airtable.ts";
import { resolveImageUrl } from "../src/lib/images.ts";
import { legacySlug, parseSlugsFromUrl } from "../src/lib/slugs.ts";
import type { Puck, PuckFields, Series, SeriesFields } from "../src/lib/types.ts";

// Only these Puck statuses get a published page. Everything else (e.g. "In Production",
// "Hidden") is fetched but excluded from the static output.
const PUBLISHED_STATUSES = new Set(["Found", "Assumed Found", "Queued to Hide"]);

const DATA_DIR = path.resolve(import.meta.dirname, "../src/data");

async function main() {
  const [seriesRecords, puckRecords] = await Promise.all([
    fetchAllRecords<SeriesFields>("Series"),
    fetchAllRecords<PuckFields>("Pucks"),
  ]);

  const seriesById = new Map(seriesRecords.map((record) => [record.id, record]));

  // The existing `URL` field on each Puck is the source of truth for both the series
  // and puck path segments (see src/lib/slugs.ts). Borrow a series' slug from any of
  // its pucks that still has a URL, since Series records don't carry their own URL.
  const seriesSlugById = new Map<string, string>();
  for (const puck of puckRecords) {
    const seriesId = puck.fields.Series?.[0];
    if (!seriesId || seriesSlugById.has(seriesId)) continue;
    const parsed = puck.fields.URL ? parseSlugsFromUrl(puck.fields.URL) : null;
    if (parsed) seriesSlugById.set(seriesId, parsed.seriesSlug);
  }

  const flaggedSeries: string[] = [];
  for (const series of seriesRecords) {
    if (seriesSlugById.has(series.id)) continue;
    const fallbackSource = series.fields["Machine Name"] || series.fields.Name;
    seriesSlugById.set(series.id, legacySlug(fallbackSource));
    flaggedSeries.push(series.fields.Name);
  }

  const flaggedPucks: string[] = [];

  const pucks: Puck[] = puckRecords
    .filter((record) => record.fields.Status && PUBLISHED_STATUSES.has(record.fields.Status))
    .map((record) => {
      const fields = record.fields;
      const seriesId = fields.Series?.[0];
      const seriesRecord = seriesId ? seriesById.get(seriesId) : undefined;
      const seriesSlug = (seriesId && seriesSlugById.get(seriesId)) || legacySlug(fields.Name);

      const parsed = fields.URL ? parseSlugsFromUrl(fields.URL) : null;
      let puckSlug: string;
      if (parsed) {
        puckSlug = parsed.puckSlug;
      } else {
        puckSlug = legacySlug(fields.Name);
        flaggedPucks.push(fields.Name);
      }

      return {
        id: record.id,
        name: fields.Name.trim(),
        slug: puckSlug,
        seriesSlug,
        seriesName: seriesRecord?.fields.Name.trim() ?? fields["Name (from series)"]?.[0] ?? "",
        status: fields.Status!,
        seriesNumber: fields["Series Number"] ?? fields["Number in Series"] ?? null,
        created: fields.Created ?? null,
        imageUrl: resolveImageUrl(fields["Photo URL"], fields.Attachments, fields.Name),
        shortenedUrl: fields["Shortened URL"] ?? null,
        shortenedName: fields["Shortened Name"] ?? null,
        notes: fields.Notes ?? null,
      };
    });

  const publishedSeriesSlugs = new Set(pucks.map((puck) => puck.seriesSlug));

  const series: Series[] = seriesRecords
    .filter((record) => publishedSeriesSlugs.has(seriesSlugById.get(record.id)!))
    .map((record) => ({
      id: record.id,
      name: record.fields.Name.trim(),
      slug: seriesSlugById.get(record.id)!,
      notes: record.fields.Notes ?? null,
      status: record.fields.Status ?? null,
      countInSeries: record.fields["Count in Series"] ?? null,
      // Series has no stable Photo-URL-style field yet, only expiring Attachments —
      // see src/lib/images.ts TODO for attachment-downloading if series images are needed.
      imageUrl: null,
    }));

  if (flaggedSeries.length > 0) {
    console.warn(
      `[fetch-data] Series with no URL-bearing pucks — slug fell back to Machine Name/Name, please review: ${flaggedSeries.join(", ")}`,
    );
  }
  if (flaggedPucks.length > 0) {
    console.warn(
      `[fetch-data] Pucks missing a URL field — slug fell back to Name, please review: ${flaggedPucks.join(", ")}`,
    );
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, "series.json"), JSON.stringify(series, null, 2));
  await writeFile(path.join(DATA_DIR, "pucks.json"), JSON.stringify(pucks, null, 2));

  console.log(`[fetch-data] Wrote ${series.length} series and ${pucks.length} published pucks to src/data/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
