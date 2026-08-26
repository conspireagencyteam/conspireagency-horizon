# Conspire v2.0 — metaobject provisioning

`ca-metaobjects.mjs` provisions the metaobjects the v2.0 homepage sections read.
It is **idempotent** and **dry-run by default**.

## What it does

1. **Creates definitions** (if missing): `service`, `app`, `faq`, `faq_category`
   — all with Storefronts access (`PUBLIC_READ`) + publishable enabled.
2. **Adds fields** to the store's existing definitions:
   - `client` → `services` (list, single-line text), `featured_site_media`
     (file — image or video, for the work-list hover reveal)
   - `quote` → `partner_since` (integer years), `logo` (file)
3. **Seeds entries for FAQ only** — `faq` + `faq_category` (the category owns an
   ordered `faqs` list referencing the FAQ entries). `service`/`app` definitions
   are created empty; add those entries in Admin.

Content lives in `ca-metaobjects-data.json`. The "What results can I expect?"
answer is verbatim from Figma; the other FAQ answers are drawn from the live
site and may want a copy pass.

## Prerequisites (one-time, in the Dev Dashboard)

The store's app is a **Dev Dashboard app** (legacy custom apps can't be created
after Jan 1 2026). The script authenticates with the **client-credentials
grant**, so make sure:

- The app **version has these scopes**: `read_metaobjects`, `write_metaobjects`,
  `read_metaobject_definitions`, `write_metaobject_definitions`. (File scopes are
  **not** needed — the script only defines `file_reference` fields; images/videos
  are attached later in the Admin UI.)
- The app is **installed on the store**.
- The app and the store are in the **same Shopify organization**.

## Setup

```bash
cp scripts/.env.example scripts/.env
# fill in SHOPIFY_STORE_URL, SHOPIFY_API_KEY, SHOPIFY_API_SECRET
```

`scripts/.env` is gitignored. Requires Node ≥ 20 (uses native `fetch` and
`--env-file`); this repo is on Node 22.

## Run

```bash
# 1) Dry run — prints what it would do, writes nothing. Also verifies auth.
node --env-file=scripts/.env scripts/ca-metaobjects.mjs

# 2) Apply — creates/updates definitions, fields, and FAQ entries.
node --env-file=scripts/.env scripts/ca-metaobjects.mjs --apply
```

Re-running `--apply` is safe: existing definitions, fields, and entries (matched
by handle) are detected and skipped; FAQ categories are re-linked to their FAQs.

## After running

- Confirm the definitions in **Admin → Settings → Custom data**, each with
  **Storefronts** access ON (required for Liquid/sections to read them).
- Add `service` and `app` entries, and attach images (client work/site images,
  app icons, quote logos) — the script doesn't upload files.

## Auth notes / troubleshooting

- **Token exchange 401/403** → app not installed on the store, app+store in
  different orgs, or missing scopes on the app version.
- The client-credentials token lasts ~24h; the script fetches a fresh one each
  run, so no caching needed.
- To bypass the exchange (e.g. an existing token), set `SHOPIFY_ADMIN_TOKEN`.
