# Pucked

Static site built from Airtable content. Airtable is only ever queried **at build
time** — the deployed site is plain static HTML with no runtime dependency on the
Airtable API, so visitor traffic can't burn through Airtable's monthly call limit.
Rebuilds are triggered by an Airtable Automation webhook whenever content changes, not
by site traffic.

See [`docs/airtable-static-site-spec.md`](docs/airtable-static-site-spec.md) for the
full design spec.

## How it works

1. `npm run build` (and `npm run dev`) first runs `scripts/fetch-data.ts`, which calls
   the Airtable REST API, paginates through the `Series` and `Pucks` tables, and writes
   the result to `src/data/series.json` and `src/data/pucks.json` (git-ignored,
   regenerated every run).
2. Astro's static routes (`src/pages/[series]/index.astro` and
   `src/pages/[series]/[puck].astro`) read those JSON files at build time and generate
   plain HTML pages — no client-side Airtable calls anywhere.
3. GitHub Actions builds and deploys to GitHub Pages on:
   - `repository_dispatch` (`airtable-update`) — fired by an Airtable Automation webhook
     whenever a Series or Puck record is created/updated/deleted.
   - `workflow_dispatch` — manual rebuild from the Actions tab.
   - `push` to `main` — so code changes redeploy too.

## Local development

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `AIRTABLE_TOKEN` (a Personal Access Token
   with read access to the base) and `AIRTABLE_BASE_ID`.
3. `npm run dev` — fetches live Airtable data, then starts the dev server at
   `localhost:4321`.

`npm run build` does the same fetch, then runs `astro build` into `dist/`.
`npm run fetch:data` runs just the Airtable fetch on its own, if you want fresh JSON
without starting/building the site.

## Published statuses & slugs

- Only Pucks with `Status` in **Found**, **Assumed Found**, or **Queued to Hide** get a
  published page; other statuses (e.g. `In Production`, `Hidden`) are fetched but
  excluded from the static output. Adjust `PUBLISHED_STATUSES` in
  `scripts/fetch-data.ts` if this list needs to change.
- Routes are `/{series}/` and `/{series}/{puck}/`. The slug for both segments is parsed
  directly from each Puck's existing `URL` field, so migrated URLs match the live site
  exactly. Where a record has no `URL` value (e.g. a brand-new, unpublished puck), the
  build falls back to `legacySlug()` in `src/lib/slugs.ts` — **lowercase + strip
  whitespace, not a hyphenated slugify()** — matching the site's actual (confirmed
  against a live data sample) URL convention. Records that hit this fallback are logged
  as build warnings so they can be reviewed/backfilled in Airtable.

## Images

Airtable's `Attachments` field returns temporary signed URLs that expire, so the build
uses the stable `Photo URL` field instead (see `src/lib/images.ts`). Pucks with no
`Photo URL` render without an image (a build warning lists which ones). If Photo URL
coverage isn't good enough going forward, the next step is to download attachment files
during the build and copy them into static assets — see the TODO in
`src/lib/images.ts`.

## GitHub Pages / repository setup

`.github/workflows/deploy.yml` deploys to GitHub Pages via `actions/deploy-pages`. In
the target repo:

1. Push this code to `YOUR_ORG/YOUR_REPO` on GitHub *(placeholder — fill in before first
   deploy)* and enable **Settings → Pages → Source: GitHub Actions**.
2. Add repository secrets under **Settings → Secrets and variables → Actions**:
   - `AIRTABLE_TOKEN`
   - `AIRTABLE_BASE_ID`
3. `astro.config.mjs` is set for the custom domain `youvebeenpucked.com`, with a
   matching `public/CNAME`. Point the domain's DNS at GitHub Pages
   ([docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site))
   and enable **Enforce HTTPS** once DNS has propagated.

## Airtable Automation webhook (rebuild trigger)

In the Airtable base, add an **Automation** on the `Pucks` table (and `Series`, if
series-only edits should also trigger a rebuild):

- **Trigger:** "When a record is created", "When a record is updated", and "When a
  record is deleted" (one automation per trigger, or combine as needed).
- **Action:** "Send webhook"
  - **URL:** `https://api.github.com/repos/YOUR_ORG/YOUR_REPO/dispatches`
    *(replace with the actual repo — see above)*
  - **Method:** `POST`
  - **Headers:**
    ```
    Authorization: Bearer <GitHub PAT with repo scope>
    Accept: application/vnd.github+json
    Content-Type: application/json
    ```
  - **Body:**
    ```json
    { "event_type": "airtable-update" }
    ```
- The GitHub PAT needs `repo` scope (or fine-grained access to this repo's Actions) and
  is stored in the Airtable automation's webhook config — never in this repo.

## Commands

| Command              | Action                                                    |
| :-------------------- | :-------------------------------------------------------- |
| `npm install`         | Install dependencies                                      |
| `npm run dev`         | Fetch Airtable data, then start the dev server             |
| `npm run build`       | Fetch Airtable data, then build the static site to `dist/` |
| `npm run fetch:data`  | Fetch Airtable data only, without building/serving         |
| `npm run preview`     | Preview a production build locally                         |
