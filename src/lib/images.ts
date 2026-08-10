import type { AirtableAttachment } from "./types";

/**
 * Airtable's Attachments field returns temporary, signed URLs that expire and can't be
 * used in static output, so this prefers the stable Photo URL field and returns null
 * (no image) rather than falling back to an attachment URL that would work at build
 * time and quietly break later.
 *
 * TODO: if Photo URL coverage turns out not to be good enough, download attachment
 * files during the build (fetch attachment.url, write into public/images/, return the
 * local path) instead of returning null here — see spec "Images — Airtable attachment
 * URLs expire".
 */
export function resolveImageUrl(
  photoUrl: string | undefined,
  attachments: AirtableAttachment[] | undefined,
  label: string,
): string | null {
  if (photoUrl && photoUrl.trim()) return photoUrl.trim();
  if (attachments && attachments.length > 0) {
    console.warn(`[images] "${label}" has an Attachments file but no Photo URL — no image will be rendered for it.`);
  }
  return null;
}
