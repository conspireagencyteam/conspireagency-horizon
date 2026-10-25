# Vertical hub pages: template and content contract

Written 2026-10-25 for the two vertical hub articles in the `work` blog
(`/blogs/work/shopify-websites-for-tile-paint-brands`,
`/blogs/work/supplement-health-product-shopify-websites`). The spec they were built to is the
shared `vertical-hub-spec.md` (seven slots, in order: hero, proof, what changes, buyer
questions, testimonial, how we work with you, form). The facts and the voice come from the
house brief (`conspire/CLAUDE.md`); nothing here restates them.

## The decision: one template, content on the article

`templates/article.vertical-hub.json` is one template for every vertical hub. It is assigned
to an article with the template suffix `vertical-hub`, and every per-page slot reads from the
article record (title, summary, body, metafields), the way the case studies read
`custom.*` metafields and the `client` metaobjects. Adding a third vertical is therefore a
new article with the same metafields, not new theme code.

Why not per-page JSON templates: the two articles already carry suffixes (`tile-paint`,
`health-brand`) that match no template file, so they fall back to `article.json` today. A
JSON template per page would put copy into theme code, where every edit is a production
deploy and the theme editor writes it back as "Update from Shopify" commits. Metafields keep
copy in Shopify, editable with `shopify store execute` or (once the definitions exist) the
article editor.

Every section also accepts the same content in its own settings, as a fallback. That is
how the dev-theme previews were built (`?view=preview-tile-paint`, see below), and it is the
path for anyone working in the theme editor. The article value wins whenever it is set.

## Slot by slot

| Slot | Section | Content source on the article | Fallback in the section |
|---|---|---|---|
| 1 Hero | `ca-hub-hero` (new) | `title` (H1); `summary` (lead sentence); `custom.hub_eyebrow`; `custom.hub_pills` | eyebrow, lead, pills settings |
| 2 Proof | `ca-work-grid` (existing, "Use the article's clients" on) | `custom.hub_clients`: ordered list of `client` metaobjects | the Clients list |
| 3 What changes | `ca-hub-outcomes` (new) | `custom.hub_outcomes`: three statements | Statements setting |
| 4 Buyer questions | `ca-article-body` (existing, headings shown, FAQ schema on) | `body`: H2 per question, 60 to 120 words under each | none (the body is the page) |
| 5 Testimonial | `ca-testimonials` (existing, "Use the article's quote" on) | `custom.quote`: one `quote` metaobject | the Quotes list; with neither, the block is omitted |
| 6 How we work with you | `ca-hub-offers` (new) | `custom.hub_fractional`, `custom.hub_build` (rich text) | the two offer blocks' house paragraphs |
| 7 Form | `ca-booking` (existing) | `custom.hub_form_heading`, `custom.hub_form_text` | the panel heading and text settings |
| SEO | theme head | `global.title_tag`, `global.description_tag` | title; summary |

Backgrounds alternate down the page: hero `#f2f2f2`, proof `#ffffff`, what changes
`#f2f2f2`, questions `#ffffff`, testimonial `#0d110d`, offers `#ffffff`, booking `#f2f2f2`.

## The content contract (what the copy agent delivers, field by field)

All metafields are in the `custom` namespace on the article. None of the `hub_*` keys has a
definition yet; the theme reads them regardless, and `metafieldsSet` writes them with the
type given (see "Setting the content"). `custom.quote` already has a definition.

| Field | Type | Shape and rules |
|---|---|---|
| `title` | article field | The H1. Written the way the searcher asks, proper nouns included, never a slogan. The current titles are cited; a change is a proposal for Danny. |
| `summary` (excerpt) | article field | The hero lead: one sentence, plain text, who the page is for and what changes. Also the meta description fallback and the BlogPosting description. |
| `custom.hub_eyebrow` | `single_line_text_field` | The vertical, in sentence case ("Tile, paint and home renovation"); the theme sets it uppercase. |
| `custom.hub_pills` | `list.single_line_text_field` | Three to five short facts, two to four words each ("Shopify Plus Premier Partner", "B2B and wholesale", "NetSuite and ERP", "Since 2011"). Rendered as outlined pills in the case written. |
| `custom.hub_clients` | `list.metaobject_reference` (type `client`) | The proof cards, in display order. Each client needs a `client` metaobject with `work_preview` (the backdrop photograph), `featured_site_media` or `featured_site_image` (the floating store capture) and `case_study_reference` (the card link). The card shows the client's `name`, `years` and `services`. |
| `custom.hub_outcomes` | `list.single_line_text_field` | Exactly three statements, each an outcome for the brand, up to about 30 words. No service lists. |
| `body` | article field | The buyer questions. One `<h2>` per question (3 to 5), phrased as the buyer asks it, followed by one or two `<p>` of 60 to 120 words naming a client where true. Links allowed (`<a href="/blogs/work/zia-tile">`). An optional `<p>` before the first `<h2>` renders as the lede. No `<h1>`, no `<div>` or `<section>` wrappers, no `<strong>`, `<b>` or `<em>`, no em dashes. The headings feed the sticky question list and the FAQPage structured data. |
| `custom.quote` | `metaobject_reference` (type `quote`) | One quote record. Highlights come from the bold runs inside the record's `quote` rich text (rendered full colour; the rest muted); years from `partner_since`; the logo from `logo`. Omit the metafield to omit the block. |
| `custom.hub_fractional` | `rich_text_field` | One paragraph on Fractional Shopify Teams, with the link to `/products/shopify-fractional-teams` (the live handle; `/products/fractional-shopify-teams` does not exist). Replaces the house paragraph in the template. |
| `custom.hub_build` | `rich_text_field` | One paragraph on the Conspire Build, with the link to `/products/shopify-websites`. |
| `custom.hub_form_heading` | `single_line_text_field` | The line over the booking montage ("Bring us the trade program, the catalog or the next launch."). |
| `custom.hub_form_text` | `multi_line_text_field` | One sentence under it. |
| `global.title_tag` | `single_line_text_field` | SEO title, under 60 characters including " \| Conspire". |
| `global.description_tag` | `single_line_text_field` | Meta description, under 155 characters, written for the searcher. |

Alt text: the hub template has no image of its own. The proof cards use the client's name
for the backdrop photograph and "<name> Shopify store" for the floating capture unless the
image in Files carries its own alt, so the alt text the copy agent writes per card belongs
on the client's `featured_site_image` (or media poster) and `work_preview` files in
Settings > Files. The booking montage tiles and the quote logo already carry alts.

### Rich text JSON

`rich_text_field` values are Shopify's rich text JSON. One paragraph with a link:

```json
{"type":"root","children":[{"type":"paragraph","children":[
  {"type":"text","value":"Most of the tile and paint brands we work with are on a "},
  {"type":"link","url":"/products/shopify-fractional-teams","title":null,"target":null,
   "children":[{"type":"text","value":"Fractional Shopify Team"}]},
  {"type":"text","value":": a senior team that becomes part of yours."}
]}]}
```

No `"bold": true` runs in body paragraphs (the typographic system has no bold in body
copy). Bold is only meaningful inside the `quote` record, where it marks the highlighted
phrases.

## Metaobjects the pages rely on (as of 2026-10-25)

| Handle | GID | Notes |
|---|---|---|
| `zia-tile` | `gid://shopify/Metaobject/51646103733` | years 6+, preview, site media, case study |
| `bsd-haus` | `gid://shopify/Metaobject/343241883829` | years 6+, preview, site media, case study |
| `portola-paints` | `gid://shopify/Metaobject/53687451829` | years "4+": the copy asks for no years label now the engagement has ended. Either the client record's `years` is cleared (it also feeds `/blogs/work` and the homepage), or the work grid gains an "engagement ended" flag that hides the label; Danny decides. The dev preview hides it with a scoped style |
| `natures-answer` | `gid://shopify/Metaobject/263690715317` | no years, preview, site media, case study |
| `body-bio` | `gid://shopify/Metaobject/53561131189` | years 7+. Never alone: list it after another client |
| quote `danny-mitchell-bsd-haus` | `gid://shopify/Metaobject/305509007541` | the homepage BSD Haus quote with highlights; its text contains an em dash ("web terms — Jack"), which only Danny can change in the record |
| quote `bodybio` | `gid://shopify/Metaobject/317309845685` | the homepage BodyBio quote with highlights |

Wholesome Wellness has no `client` record and no case study, so it cannot be a proof card
until both exist; it can be named in the body.

## Setting the content

Read-only checks and all writes go through `shopify store execute -s conspireagency.myshopify.com`
(mutations need `--allow-mutations`; variables go in `--variable-file`). Article IDs:
tile and paint `gid://shopify/Article/611812966581`, supplements
`gid://shopify/Article/611793928373`.

Metafields, one call per article:

```graphql
mutation SetHub($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { namespace key type }
    userErrors { field message }
  }
}
```

```json
{"metafields":[
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_eyebrow","type":"single_line_text_field","value":"Tile, paint and home renovation"},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_pills","type":"list.single_line_text_field","value":"[\"Shopify Plus Premier Partner\",\"B2B and wholesale\",\"Trade programs\",\"NetSuite and ERP\",\"Since 2011\"]"},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_clients","type":"list.metaobject_reference","value":"[\"gid://shopify/Metaobject/51646103733\",\"gid://shopify/Metaobject/343241883829\",\"gid://shopify/Metaobject/53687451829\"]"},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_outcomes","type":"list.single_line_text_field","value":"[\"...\",\"...\",\"...\"]"},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"quote","type":"metaobject_reference","value":"gid://shopify/Metaobject/305509007541"},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_fractional","type":"rich_text_field","value":"{\"type\":\"root\",\"children\":[...]}"},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_build","type":"rich_text_field","value":"{\"type\":\"root\",\"children\":[...]}"},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_form_heading","type":"single_line_text_field","value":"Bring us the trade program, the catalog or the next launch."},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_form_text","type":"multi_line_text_field","value":"20 minutes, no pitch deck. We'll come with one specific take on your Shopify store."},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"global","key":"title_tag","type":"single_line_text_field","value":"..."},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"global","key":"description_tag","type":"single_line_text_field","value":"..."}
]}
```

If Shopify refuses a `list.metaobject_reference` value without a definition, create the
definitions first (below) and run the same call again.

Title, summary and body: `articleUpdate(id, article: { title, summary, body })` with
`$body: HTML!`. Template: `articleUpdate(id, article: { templateSuffix: "vertical-hub" })`,
or in the article editor under Theme template. Assigning the suffix is the step that puts
the new design live; it is Danny's call, after the copy is in place.

### Definitions (optional, for editing in the admin)

Settings > Custom data > Blog posts > Add definition. Keys must match exactly; Storefronts
access on. `custom.quote` exists already.

| Name | Key | Type |
|---|---|---|
| Hub eyebrow | `hub_eyebrow` | Single line text |
| Hub pills | `hub_pills` | Single line text, list of values |
| Hub clients | `hub_clients` | Metaobject reference, Client, list of entries |
| Hub outcomes | `hub_outcomes` | Single line text, list of values |
| Hub fractional paragraph | `hub_fractional` | Rich text |
| Hub build paragraph | `hub_build` | Rich text |
| Hub form heading | `hub_form_heading` | Single line text |
| Hub form text | `hub_form_text` | Multi-line text |

## Previewing

Any article renders with any template through `?view=<suffix>`, so the live articles can be
seen in the hub template on a development theme without touching them:

```
shopify theme push --development --only templates/article.vertical-hub.json \
  sections/ca-hub-hero.liquid sections/ca-hub-outcomes.liquid sections/ca-hub-offers.liquid \
  sections/ca-work-grid.liquid sections/ca-testimonials.liquid sections/ca-article-body.liquid \
  sections/ca-booking.liquid snippets/ca-quote.liquid
```

then `https://conspireagency.myshopify.com/blogs/work/<handle>?view=vertical-hub&preview_theme_id=<id>`.
With no metafields set the page shows the hero from the title and the body as a lede, and
omits the testimonial. The two `templates/article.preview-*.json` files used for the
2026-10-25 review carry the copy agent's text in the section fallbacks, with the buyer
questions and the testimonial as static `custom-liquid` sections in the same markup the
real sections emit (the live bodies still hold the old copy, and the BSD Haus quote record
carries an em dash). They live only on the development theme and are not committed; the
copies are kept in the session scratchpad for re-pushing.

Section stylesheets are bundled into `compiled_assets/styles.css`, and any change to how
the article body renders should re-run the containment check
(`.page-wrapper.contains(footer)`); both are in the memory note `horizon-theme-dev-testing`.

## Checklist before a page goes live

- Title and H1 read as the searcher's query; handle unchanged.
- Summary is one sentence; `global.description_tag` under 155 characters.
- Three to five pills, three outcomes, three to five H2 questions with 60 to 120 words each.
- Clients listed exist as `client` metaobjects with a preview, a store capture and a case
  study link; BodyBio never first or alone.
- No em dashes anywhere, including the quote record; no bold in the body or the rich text
  paragraphs; no price that is not in the brief or on the Pricing page.
- Every image has an alt (the theme supplies them; richer alts go on the Files records).
- Links: `/products/shopify-fractional-teams`, `/products/shopify-websites`, `/pages/pricing`.
