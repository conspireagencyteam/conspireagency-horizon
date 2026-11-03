# conspireagency-horizon (the live conspireagency.com theme)

The house brief (who Conspire is, offers, voice, proof, never say) lives in the Conspire tree at
`docs/house-brief.md` and loads through the tree's root CLAUDE.md; it is not restated here. When this
repo is worked on outside the tree (the Mac mini's change jobs), the job spec carries the voice rules.

## What this repo is

- Shopify Horizon theme, Conspire v2.0, live since 2026-10-07. **`main` syncs to the PUBLISHED theme:
  a push to main is production within one or two minutes.** No staging branch. `conspire-concept` is
  the rollback theme only. Shopify commits theme-editor saves back as "Update from Shopify"; leave them.
- Work on a branch in a worktree, open a PR, never push to main directly. Stage explicit paths.
- Build plan and Figma section map: `docs/ca-build-plan.md`.

## Where copy lives

- Service pages (`/products/*`), `/pages/*` and the homepage keep their H1, intro, sections and
  internal links in `templates/*.json` section settings and blocks, and in the `sections/ca-*.liquid`
  and `snippets/ca-*.liquid` they reference. Find a page's template by its handle in the URL.
- **Title and meta description are Shopify admin fields** (SEO title and description on the product
  or page), not theme files. Propose them as text in the PR description; never try to set them here.
- Store content (products, pages, metaobjects) is edited with `shopify store execute`, not in this repo.

## Rules for any change

- Plain hyphen, never an em dash, anywhere a reader sees text.
- The typographic system is fixed: no `<strong>`, `<b>`, italics or ad hoc emphasis in body copy, FAQ
  answers, hero body or card text. The one sanctioned `<strong>` is inside a statement heading, where
  it shifts colour only.
- Every `<img>` carries a non-empty alt, decorative ones included (Bing counts `alt=""` as missing).
  Describe the image for a crawler (article title, "<client> Shopify store", app name) and keep
  `aria-hidden` on the wrapper.
- Client names never break across lines. Only Conspire's own and clients' assets from the store's
  Files library; never stock, never an invented logo or client outcome.
- Section images in JSON templates must exist in Files (`shopify://shop_images/<file>`).
- Section `{% stylesheet %}` CSS is bundled into `compiled_assets/styles.css` with comments stripped;
  verify a rule on the live store, not a comment.
- Any change to article rendering (`sections/ca-article-body.liquid`) must re-run the containment
  check (`.page-wrapper.contains(footer)`, sections inside `<main>`) across the sitemap.

## Local preview

`source ~/.nvm/nvm.sh && shopify theme dev --store conspireagency.myshopify.com` (port 9292; a stale
server squats the port, `pkill -f "shopify theme dev"`). `shopify theme push --development` once, then
`--only <file>` previews one file on the development theme. `shopify theme dev` never touches the
published theme.
