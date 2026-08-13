# Airtable Automation Setup — "Keep it" / "Re-hide it" webhooks

The puck detail page's "Nice find!" dialog posts directly to Airtable
Automation webhooks to update a puck's `Status`. This is manual, one-time
setup inside Airtable — there's nothing to configure in this repo beyond the
two `PUBLIC_AIRTABLE_*_WEBHOOK_URL` env vars (see `.env.example`).

There are **two separate automations**, one per action, each hardcoding its
own target `Status`. That split exists because the account's Airtable plan
doesn't include the "Run a script" automation step (a Team-plan-and-up
feature), so there's no way to parse a JSON body or branch on an `action`
field inside one automation. Splitting by webhook means each automation only
ever needs the record's ID — no scripting, no JSON parsing, everything
buildable with Airtable's no-code action blocks.

## Why a webhook, not the REST API

The site is fully static (GitHub Pages, no server), and the only Airtable
credential in the repo is a read-only token used at build time
(`src/lib/airtable.ts`). There's nowhere to hold a write-capable credential,
so instead of the browser calling Airtable's REST API directly, it posts to
an Airtable Automation's webhook trigger — Airtable handles the write with
its own base-level permissions, no credential ever ships to the client.

## Steps (repeat once for each action)

Build two automations with identical structure — only the hardcoded target
`Status` differs:

| Automation | Target `Status` | Env var |
|---|---|---|
| "Puck kept" | `Found` | `PUBLIC_AIRTABLE_KEEP_WEBHOOK_URL` |
| "Puck re-hidden" | `Hidden` | `PUBLIC_AIRTABLE_REHIDE_WEBHOOK_URL` |

1. Create the Automation and set its trigger to **When webhook received**.
2. Test the trigger with a request that sends `puckId` as url-encoded form
   body data (this trigger type only reads the request body — it does not
   expose URL query parameters as bindable fields, so the ID has to travel
   in the body):
   ```bash
   curl -X POST 'https://hooks.airtable.com/workflows/v1/genericWebhook/.../...' \
     -H 'Content-Type: application/x-www-form-urlencoded' \
     --data-raw 'puckId=recXXXXXXXXXXXXXX'
   ```
   (grab a real record ID from the `Pucks` table — record's "..." menu →
   "Copy record URL" — don't use anything from `src/data/pucks.json`, that
   file has stale placeholder IDs). After testing, expand the trigger step's
   "body" result — it should show `puckId` as an individually bindable
   sub-field now that it was sent as genuine url-encoded form data rather
   than a JSON string (which is what broke this the first time — the
   Content-Type said url-encoded but the body was JSON text, so Airtable
   couldn't parse a field out of it). The saved trigger URL is the value for
   the corresponding `PUBLIC_AIRTABLE_*_WEBHOOK_URL` env var, both locally
   (`.env`) and as a GitHub Actions repo secret (`Settings → Secrets and
   variables → Actions`, used by `.github/workflows/deploy.yml`).
3. Add a **Find records** action on the `Pucks` table: condition `Record ID`
   = the `puckId` sub-field from the trigger step's `body`.
4. Add a **Conditional logic** step: only continue if the found record's
   `Status` = `"Queued to Hide"` — this matches the only state the "I found
   this puck!" button is ever shown for on the live site, and is the sole
   guard against a spoofed/replayed request (there's no real auth on a
   public webhook URL). If conditional steps also turn out to be gated on
   your plan, this guard can be dropped — it's a nice-to-have, not load
   bearing for the feature to work.
5. Add an **Update record** action on the same record: set `Status` to the
   hardcoded value from the table above (`Found` for the "kept" automation,
   `Hidden` for the "re-hidden" one).

6. **Important — verify the rebuild automation covers this.** The existing
   automation that fires the GitHub Pages rebuild (`repository_dispatch`
   type `airtable-update`, see `docs/airtable-static-site-spec.md`) needs to
   trigger on updates to a Puck's `Status` field for this change to actually
   reach the live site. Check that automation's trigger conditions.

## Notes / limitations

- The browser sends `fetch(webhookUrl, { method: "POST", mode: "no-cors",
  headers: { "Content-Type": "application/x-www-form-urlencoded" }, body:
  "puckId=..." })`. A few dead ends along the way, for context: `GET` 404s
  (Airtable's webhook only accepts `POST`); a JSON-string body doesn't
  parse into a bindable field even with the url-encoded Content-Type set
  (must be genuine `key=value` form data); URL query params aren't read by
  this trigger type at all. `mode: "no-cors"` is required because Airtable's
  webhook endpoint doesn't support a CORS preflight (confirmed directly: its
  `OPTIONS` response has no `Access-Control-*` headers at all), which
  restricts Content-Type to a CORS-safelisted value — Airtable accepts
  `application/x-www-form-urlencoded` (rejects `text/plain`).
- This is fire-and-forget from the page's perspective — `no-cors` makes the
  response opaque, so the client can't read success/failure. The
  conditional-logic guard in each automation (step 4 above) is the real
  source of truth, not anything the browser checks.
- Both webhook URLs are not secrets in the security sense — they ship in
  the built client JS and are visible in page source. The state-guard in
  step 4 is the only real protection against someone calling a webhook
  directly with an arbitrary record ID.
- **Airtable's monthly API request quota is separate from all of this** —
  it applies to the read-only `AIRTABLE_TOKEN` used by `fetch:data` at
  build time (both locally and in GitHub Actions), not to Automation
  webhooks. If `npm run fetch:data` starts failing with
  `PUBLIC_API_BILLING_LIMIT_EXCEEDED`, that's a separate, account-wide
  issue — it also blocks the GitHub Actions rebuild pipeline entirely
  (same token, same base) until the quota resets or the plan is upgraded.
- "Keep it" sets `Status = "Found"` — same status as any other found puck,
  no separate "kept forever" state. "Re-hide it" sets `Status = "Hidden"`,
  which is *not* in `PUBLISHED_STATUSES` (`scripts/fetch-data.ts`), so the
  puck's page disappears from the site on the next rebuild until someone
  manually moves it back to `"Queued to Hide"`.
