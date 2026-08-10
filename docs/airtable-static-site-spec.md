# Spec: Static Site Rebuild — Airtable-Backed Site (Build-Time Data Fetch)

## Problem

The current site queries the Airtable API live, on every request. Airtable's monthly API
call limit is exhausted within the first few days of the month, taking the site down for
the remainder of the month. The site is currently hosted on Heroku.

## Goal

Rebuild the site so Airtable is only queried **at build time**. The build fetches all
needed records from Airtable, generates fully static HTML/CSS/JS, and that static output
is what gets served. No runtime API calls to Airtable happen while the site is live.
Rebuilds are triggered by Airtable content changes (via webhook), not by site traffic —
so API usage stays flat regardless of visitor count.

This spec covers the **framework and pipeline only**. Visual design is explicitly
out of scope for this phase — use plain, minimal, semantic HTML/CSS. Styling will be
addressed in a later pass.

## Recommended Stack

- **Static site generator:** [Astro](https://astro.build) — file-based routing, content
  collections, ships zero JS by default, and fetches data at build time naturally (no
  server runtime required to render pages).
- **Hosting:** GitHub Pages — free, no server to manage, serves the `dist/` output
  directly. This replaces Heroku; Heroku is not needed once the site is static.
- **Build/deploy:** GitHub Actions — builds the Astro site and publishes to GitHub Pages.
- **Rebuild trigger:** Airtable Automation → webhook → GitHub `repository_dispatch` API →
  fires the GitHub Actions workflow.

This combination fully satisfies "static + auto-rebuild-on-change" without any paid
hosting or a persistent server process.

## Architecture Overview

```
Airtable (content source)
   │  Automation: on record created/updated/deleted
   │  → "Send webhook" action → POST to GitHub REST API
   ▼
GitHub repository_dispatch event (event_type: "airtable-update")
   │
   ▼
GitHub Actions workflow
   1. Checkout repo
   2. Install deps
   3. Run `astro build`
        - build-time script calls Airtable REST API
        - writes fetched records to local JSON (or Astro content collection)
        - Astro generates static pages from that data
   4. Deploy dist/ output to GitHub Pages (actions/deploy-pages)
   ▼
GitHub Pages (static hosting, no live Airtable calls)
```

## Requirements

### 1. Data fetching (build time only)
- All Airtable API calls happen inside the build process — never in client-side JS, never
  at request time.
- Use a build-time fetch step (a small Node script, or an Astro content loader) that:
  - Calls the Airtable REST API using a Personal Access Token.
  - Paginates through all records needed for the site.
  - Writes the result to local JSON files (e.g. `src/data/*.json`) that Astro's pages/
    content collections consume.
- The Airtable PAT and Base ID must be read from environment variables — never hardcoded.

### 2. GitHub Actions workflow
- Triggers on:
  - `repository_dispatch` with `event_type: airtable-update` (primary trigger)
  - `workflow_dispatch` (manual trigger, for testing/manual rebuilds)
  - Optionally `push` to `main` (so code changes also redeploy)
- Steps: checkout → setup Node → `npm ci` → `npm run build` (runs the Airtable fetch +
  `astro build`) → upload artifact → deploy via `actions/deploy-pages`.
- Airtable PAT and Base ID stored as GitHub Actions **repository secrets**
  (`AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`), injected as env vars during the build step.

### 3. Airtable Automation (webhook trigger)
- An Airtable Automation watches for record created / updated / deleted on the relevant
  table(s).
- Action: "Send webhook" (or a scripting action) that sends a `POST` to:
  `https://api.github.com/repos/{owner}/{repo}/dispatches`
  with header `Authorization: Bearer <GitHub PAT>` and body
  `{ "event_type": "airtable-update" }`.
- Requires a GitHub Personal Access Token with `repo` scope, stored in Airtable's
  automation config (not in the repo).
- Note: Airtable's built-in "Send webhook" automation action can call this directly; no
  external relay service is needed.

### 4. Content model

Two Airtable tables, fetched at build time and written to local JSON:

**Series table**
| Field | Notes |
|---|---|
| Name | Series display name |
| Notes | |
| Attachments | Images |
| Status | |
| Machine Name | Manually-provided slug-safe identifier, used for filtering |
| Pucks | Relation to Pucks table |
| Count in Series | Rollup count |

**Pucks table**
| Field | Notes |
|---|---|
| Name | Puck display name |
| Series | Relation to Series table |
| Attachments | Images |
| Status | One of: In Production, Queued to Hide, Hidden, Found, Assumed Found |
| URL | Existing full URL to the puck's page on the current site |
| Series Number | |
| Created | Timestamp |
| Photo URL | Stable external image URL |
| Name (from series) | Lookup |
| Series machine name | Lookup |
| Shortened URL | Manually-provided bit.ly link |
| Notes | |
| Date hidden | |
| Shortened Name | Manually-provided alternate name |
| Number in Series | |

**Routing:** each puck gets its own page at `/{series name}/{puck name}`; each series
should also get an index page at `/{series name}` listing its pucks (a natural landing
page given `Count in Series` / `Pucks` already model that relationship).

**Slug source of truth — needs a decision before implementation:** the existing `URL`
field on each Puck record already holds the live path for that record
(`/{series name}/{puck name}`). To guarantee migrated URLs match exactly, the build
should parse the path segments out of that stored `URL` field rather than re-deriving
slugs from `Name` by an assumed slugify rule (spaces/casing/punctuation in `Name` may not
match how the old site slugified it). If some records are missing a `URL` value (e.g. new
pucks not yet published), fall back to slugifying `Name`/`Series machine name` and flag
those for review. `Machine Name` / `Series machine name` are good candidates for the
series-level path segment if they're already URL-safe, but confirm they match the live
site's actual series URL segments before relying on them.

**Images — Airtable attachment URLs expire.** Airtable's `Attachments` field returns
temporary, signed URLs that stop working after a period of time — they can't be used
directly in the static output. The build should either:
  - Prefer the stable `Photo URL` field where present (simplest), or
  - Download attachment files during the build step and copy them into the site's static
    assets so the deployed site doesn't depend on Airtable's URLs at all.
Series-level `Attachments` need the same treatment if used on series pages.

### 5. Local development
- `.env` (git-ignored) holds `AIRTABLE_TOKEN` / `AIRTABLE_BASE_ID` for local builds.
- `.env.example` committed with placeholder values so the setup is documented.
- `npm run dev` should work locally against live Airtable data (using the local token) so
  content changes can be previewed before pushing.

### 6. Repo structure (suggested)

```
/
├── .github/workflows/deploy.yml
├── src/
│   ├── data/                  # series.json, pucks.json — fetched at build time (git-ignored)
│   ├── lib/
│   │   ├── airtable.ts        # fetch helper: pagination, auth, error handling
│   │   └── images.ts          # attachment download / Photo URL resolution
│   ├── pages/
│   │   └── [series]/
│   │       ├── index.astro    # series index — lists pucks in the series
│   │       └── [puck].astro   # individual puck page
│   └── layouts/
├── astro.config.mjs
├── .env.example
└── package.json
```

## Explicit Non-Goals (this phase)
- Visual design, branding, responsive layout polish — plain unstyled/minimally styled
  HTML is fine.
- Search, filtering, pagination beyond what's trivially needed to prove the build works.
- Preview/draft content workflows.
- Any client-side Airtable integration.

## Open Questions for Implementation
- Confirm whether the existing `URL` field's path segments can be parsed directly for
  routing, or whether `Name`/`Machine Name` need a slugify step — and if so, what
  slugification rule the current live site uses (case, spaces, punctuation) so migrated
  URLs match exactly.
- Should `Status` values (e.g. `Queued to Hide`, `Hidden`) affect whether a puck gets a
  published page at all, or are all statuses shown? (e.g. maybe "In Production" pucks
  shouldn't have a public page yet.)
- Confirm GitHub repo name/owner for the `repository_dispatch` webhook target.
