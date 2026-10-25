# Vertical hub pages: template and content contract

Written 2026-10-25 for the two vertical hub articles in the `work` blog
(`/blogs/work/shopify-websites-for-tile-paint-brands`,
`/blogs/work/supplement-health-product-shopify-websites`). Second pass the same day: the
structure from `vertical-hub-spec-v2-tile.md`; third pass that evening from Danny's review:
eight slots (hero, some examples of our work, how tile and paint are bought with four mocks,
buyer questions, testimonial, apps, how we work with you, form). "What changes" is gone. The facts
and the voice come from the house brief (`conspire/CLAUDE.md`); nothing here restates them.

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

Two slots are the exception and live in the template's section settings only, because they
are the same on every hub or are chosen per section instance: the three UI mocks' variants
(which screen each shows) and the apps strip's cards (name, line, link, thumbnail). The
mocks' copy and the apps strip's copy can still be changed per article (see the table).

## Slot by slot

| Slot | Section | Content source on the article | Fallback in the section |
|---|---|---|---|
| 1 Hero (black) | `ca-hub-hero` | `title` (H1); `summary` (lead); `custom.hub_eyebrow`; `custom.hub_pills`; `custom.hub_clients` (the first three with a `work_preview` become the floating store cards) | eyebrow, lead, pills, Clients settings |
| 2 Some examples of our work | `ca-work-grid` ("Use the article's clients" on, eyebrow "Some examples of our work") | `custom.hub_clients`: ordered list of `client` metaobjects; `custom.hub_client_years` and `custom.hub_client_captions`, aligned by position | the Clients list, Years labels, Card captions |
| 3 How tile and paint are bought | `ca-hub-mock` x4 (`trade`, `calculator`, `samples`, `checkout`; sides right, left, right, left) | `custom.hub_mocks_heading` (the plain chapter statement); per mock `custom.hub_mock_<variant>_heading`, `_text`, `_caption` | intro eyebrow and statement, eyebrow, heading, text, bullets (blocks), app link, caption |
| 4 Buyer questions | `ca-article-body` (headings shown, FAQ schema on) | `body`: H2 per question, 60 to 120 words under each | none (the body is the page) |
| 5 Testimonial | `ca-testimonials` ("Use the article's quote" on) | `custom.quote`: one `quote` metaobject | the Quotes list; with neither, the block is omitted |
| 6 Apps | `ca-apps-cards` | none | the four `app` blocks in the template (name, line, page link, documentation link, thumbnail) |
| 7 How we work with you | `ca-hub-offers` | none on the article: the two `offer` metaobject entries (`fractional-shopify-teams`, `the-conspire-build`), named by handle on the blocks | the blocks' video, poster and media settings; the closing Pricing link |
| 8 Form | `ca-booking` | `custom.hub_form_heading`, `custom.hub_form_text` | the panel heading and text settings |
| SEO | theme head | `global.title_tag`, `global.description_tag` | title; summary |

Backgrounds down the page: hero `#0d110d` (white text, transparent header, the case-study
hero treatment), proof `#ffffff`, the four mocks `#f2f2f2` (one chapter), questions
`#ffffff`, testimonial `#0d110d`, apps `#f2f2f2`, offers `#ffffff`, booking `#f2f2f2`.

### The hero cards

The hero shows the proof clients' Shopify stores as floating cards (the homepage work-card
look: the client's own photograph with the store capture framed over it), sliding in and then
drifting. Backdrop: the client's `work_preview`. Capture: `featured_site_image`, else the
poster of `featured_site_media`. A client with neither is skipped; at most three cards
(`max_cards`). Only Files assets are used, so a new client needs those images on its
`client` record before it appears. Alt text: the image's own alt, else the client name
(backdrop) and "<name> Shopify store" (capture).

### Proof cards: no 404s, years per client

With "Use the article's clients" on, a client whose `case_study_reference` is blank or
points at an article that is not published is left out of the grid, so a client can sit in
`custom.hub_clients` before its case study goes live (Replica Plants & Decor,
`gid://shopify/Metaobject/101246730421`, is in that state: no case study, no images yet).

The years label comes from the client record (`years`), which also feeds the homepage and
`/blogs/work`. `custom.hub_client_years` overrides it per hub without touching the record:
a list aligned with `hub_clients` by position; `6+` shows that label, `0` or `none` hides it
(a build, or an engagement that has ended). `custom.hub_client_captions` adds one line under
the name, same alignment. The tile hub hides the label for BSD Haus (a build, not a
retainer) and Portola Paints (ended).

### The mocks

`sections/ca-hub-mock.liquid` follows `ca-app-wholesale-mock`: a copy column beside a static,
`aria-hidden` recreation of a storefront screen; every meaningful statement is in the copy.
Four variants, one per section instance:

- `trade`: the storefront trade application (the fields of the App Store listing's form,
  filled for Retail Co. and Marcus Reed) and, overlapping it, the outcome card: approved into
  the Gold tier, Shopify company created, Net 30.
- `calculator`: the product page with the tile buy box (the Gable & Oak demo theme's "Tile
  buy box" block: Order sample, the Full order disclosure with Area to cover and Overage,
  "12 boxes will cover 27.6 sq ft (120 tiles)", Total, Add order to cart, "Sold by the box ·
  2.3 sq ft per box (10 tiles)"), the Add to Project affordance of B2B Wishlist Project
  Planner (Create New Project, Project name, Room name, Add to Room), and beside it the paint
  buy box (quart, gallon, five gallon rows with coverage at two coats).
- `samples`: the product page with "Order a sample" beside "Add to cart", the confirmation
  ("Sample ordered. Ships in 2 business days.") and, beside it, the follow-up email a week
  later ("How did it look in the room?") linking back to the product and the full order. No
  app name (nothing we sell tracks samples), no brand.
- `checkout`: a checkout in Shopify's layout and rhythm: contact, ship-to, shipping methods
  with the LTL pallet freight quoted for the address, Net 30 payment terms, the order
  summary, the draft-order-invoice line. No Shopify logo, no Shop Pay mark; the bar reads
  yourstore.com.

Mock data is the set already on the live app pages (Retail Co., Marcus Reed,
marcus@retailco.com, Portland OR, resale-certificate.pdf, Gold tier, Net 30, Pale Calcite
Zellige Hex, Mineral Sage 4x4); the paint product is generic ("Interior eggshell, Chalk").
The figures agree with each other: $96.00 a box at 2.3 sq ft, 24 sq ft at 15% overage is
12 boxes; Mineral Sage is $72.00 a box, the sample $8.00.
No em dash anywhere in a mock.

A mock section renders nothing when it has no heading from either source, so the shared
template shows the mocks only on an article that carries `custom.hub_mock_<variant>_heading`
(or when the theme editor sets the fallback). The supplements hub therefore has no mocks
until its own variants exist (a subscription portal and Bonde are a later pass; they would be
new variants of the same section).

### How we work with you: the `offer` metaobjects

`sections/ca-hub-offers.liquid` is a modified copy of the homepage's `ca-feature-highlights`
(the two video cards) that reads its words from `offer` metaobject entries, so a price is
changed once. Definition `offer` (`gid://shopify/MetaobjectDefinition/44715180213`,
storefront access, publishable): `name`, `eyebrow`, `blurb` (multi-line), `price_line`,
`link_label`, `link` (url), `video` (file reference, optional). Entries:
`fractional-shopify-teams` (`gid://shopify/Metaobject/377913442485`) and `the-conspire-build`
(`gid://shopify/Metaobject/377913606325`), both ACTIVE, text from the copy file's slot 7.
Each block names an entry by handle and carries the media (the homepage videos
`fractional-shopify-website-teams.mp4` and `Conspire-showreel.mp4` with their posters); an
entry's own `video` wins when set. The section closes with one link, Pricing, to
`/pages/pricing` (section settings). The legacy `builds` metaobject (two entries, one of
them "Signature Builds", a second build tier the brief forbids) is not used and was left
alone.

The entries' blurbs are written for the tile hub ("Most tile and paint brands we work
with..."); the supplements hub shows the same two entries until a per-vertical entry or a
neutral blurb is decided.

## The content contract (what the copy agent delivers, field by field)

All metafields are in the `custom` namespace on the article. None of the `hub_*` keys has a
definition yet; the theme reads them regardless, and `metafieldsSet` writes them with the
type given (see "Setting the content"). `custom.quote` already has a definition.

| Field | Type | Shape and rules |
|---|---|---|
| `title` | article field | The H1. Written the way the searcher asks, proper nouns included, never a slogan. The current titles are cited; a change is a proposal for Danny. |
| `summary` (excerpt) | article field | The hero lead: one sentence, plain text, who the page is for and what changes. Also the meta description fallback and the BlogPosting description. |
| `custom.hub_eyebrow` | `single_line_text_field` | The vertical, in sentence case ("Tile, paint and home renovation"); the theme sets it uppercase. |
| `custom.hub_pills` | `list.single_line_text_field` | Three to five short facts, two to four words each. Rendered as outlined pills in the case written. |
| `custom.hub_clients` | `list.metaobject_reference` (type `client`) | The proof cards and the hero cards, in display order. Each client needs a `client` metaobject with `work_preview`, `featured_site_media` or `featured_site_image`, and `case_study_reference` to a published case study (unpublished: the card is omitted). |
| `custom.hub_client_years` | `list.single_line_text_field` | Optional. One entry per client in `hub_clients`, same order: `6+` shows the label, `0` or `none` hides it. Omit to show every record's own years. |
| `custom.hub_client_captions` | `list.single_line_text_field` | Optional. One line per client, same order, shown under the name. |
| `custom.hub_mocks_heading` | `single_line_text_field` | The chapter statement over the mocks ("Three screens that decide whether a renovation buyer finishes the order."). |
| `custom.hub_mock_trade_heading`, `..._calculator_heading`, `..._samples_heading`, `..._checkout_heading` | `single_line_text_field` | The H2 beside each mock. |
| `custom.hub_mock_trade_text`, `..._calculator_text`, `..._samples_text`, `..._checkout_text` | `rich_text_field` (or `multi_line_text_field`) | One paragraph, 60 to 80 words, naming the app as ours with its page linked (the samples column names no app). The bullets under it stay in the template's blocks. |
| `custom.hub_mock_trade_caption`, `..._calculator_caption`, `..._samples_caption`, `..._checkout_caption` | `single_line_text_field` | Optional caption under the copy ("Shown with example data."). |
| `body` | article field | The buyer questions. One `<h2>` per question (3 to 5), phrased as the buyer asks it, followed by one or two `<p>` of 60 to 120 words naming a client where true. Links allowed. An optional `<p>` before the first `<h2>` renders as the lede. No `<h1>`, no `<div>` or `<section>` wrappers, no `<strong>`, `<b>` or `<em>`, no em dashes. The headings feed the sticky question list and the FAQPage structured data. |
| `custom.quote` | `metaobject_reference` (type `quote`) | One quote record. Highlights come from the bold runs inside the record's `quote` rich text; years from `partner_since` (leave it empty for a quote with no years label, as BSD Haus); the logo from `logo`. Omit the metafield to omit the block. |
| `custom.hub_form_heading` | `single_line_text_field` | The line over the booking montage. |
| `custom.hub_form_text` | `multi_line_text_field` | One sentence under it. |
| `global.title_tag` | `single_line_text_field` | SEO title, under 60 characters including " \| Conspire". |
| `global.description_tag` | `single_line_text_field` | Meta description, under 155 characters, written for the searcher. |

Alt text: the hub template's own images are the hero cards and the apps strip thumbnails.
The hero cards use the image's own alt, else the client name and "<name> Shopify store";
the proof cards do the same; the apps thumbnails use the image's alt, else "<app>: Watch the
tour". Richer alts belong on the Files records (Settings > Files). The booking montage tiles
and the quote logo already carry alts.

### Rich text JSON

`rich_text_field` values are Shopify's rich text JSON. One paragraph with a link:

```json
{"type":"root","children":[{"type":"paragraph","children":[
  {"type":"text","value":"Most tile and paint brands we work with are on a "},
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
| `zia-tile` | `gid://shopify/Metaobject/51646103733` | years 6+, preview, site media and image, case study |
| `bsd-haus` | `gid://shopify/Metaobject/343241883829` | years "6+" on the record, which is wrong (a build, not a retainer; the homepage carousel and the case-study header show it too); the hub hides it through `hub_client_years`. Preview, site media (video; its poster is the hero capture), case study |
| `portola-paints` | `gid://shopify/Metaobject/53687451829` | years "4+" on the record; the hub hides it the same way (engagement ended). Preview, site media and image, case study |
| `replica-decor` | `gid://shopify/Metaobject/101246730421` | exists, but no name, images or case study yet; listed in `hub_clients` it renders nothing until the case study is published and the images are on the record |
| `natures-answer` | `gid://shopify/Metaobject/263690715317` | no years, preview, site media, case study |
| `body-bio` | `gid://shopify/Metaobject/53561131189` | years 7+. Never alone: list it after another client |
| quote `danny-mitchell-bsd-haus` | `gid://shopify/Metaobject/305509007541` | the homepage BSD Haus quote with highlights; its text contains an em dash after "web terms" and `partner_since` yields "+6 years partnered"; both need Danny's change in the record before the hub uses it (the dev preview renders the quote as static text, attributed "BSD Haus", no years) |
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
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_clients","type":"list.metaobject_reference","value":"[\"gid://shopify/Metaobject/51646103733\",\"gid://shopify/Metaobject/343241883829\",\"gid://shopify/Metaobject/53687451829\",\"gid://shopify/Metaobject/101246730421\"]"},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_client_years","type":"list.single_line_text_field","value":"[\"6+\",\"0\",\"0\",\"0\"]"},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_client_captions","type":"list.single_line_text_field","value":"[\"...\",\"...\",\"...\",\"...\"]"},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_mocks_heading","type":"single_line_text_field","value":"Three screens that decide whether a renovation buyer finishes the order."},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_mock_trade_heading","type":"single_line_text_field","value":"Designers and dealers apply once, then shop at their pricing."},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_mock_trade_text","type":"rich_text_field","value":"{\"type\":\"root\",\"children\":[...]}"},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_mock_trade_caption","type":"single_line_text_field","value":"Shown with example data."},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_mock_calculator_heading","type":"single_line_text_field","value":"Buy in square feet. Get the right boxes."},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_mock_calculator_text","type":"rich_text_field","value":"{\"type\":\"root\",\"children\":[...]}"},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_mock_checkout_heading","type":"single_line_text_field","value":"Pallet freight quoted for the address. Terms for the trade."},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_mock_checkout_text","type":"rich_text_field","value":"{\"type\":\"root\",\"children\":[...]}"},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_mock_samples_heading","type":"single_line_text_field","value":"Almost every order starts with a sample."},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"hub_mock_samples_text","type":"rich_text_field","value":"{\"type\":\"root\",\"children\":[...]}"},
 {"ownerId":"gid://shopify/Article/611812966581","namespace":"custom","key":"quote","type":"metaobject_reference","value":"gid://shopify/Metaobject/305509007541"},
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
| Hub client years | `hub_client_years` | Single line text, list of values |
| Hub client captions | `hub_client_captions` | Single line text, list of values |
| Hub mocks heading | `hub_mocks_heading` | Single line text |
| Hub mock trade heading / text / caption | `hub_mock_trade_heading`, `hub_mock_trade_text`, `hub_mock_trade_caption` | Single line text / Rich text / Single line text |
| Hub mock calculator heading / text / caption | `hub_mock_calculator_*` | same |
| Hub mock samples heading / text / caption | `hub_mock_samples_*` | same |
| Hub mock checkout heading / text / caption | `hub_mock_checkout_*` | same |
| Hub form heading | `hub_form_heading` | Single line text |
| Hub form text | `hub_form_text` | Multi-line text |

## Previewing

Any article renders with any template through `?view=<suffix>`, so the live articles can be
seen in the hub template on a development theme without touching them:

```
shopify theme push --development --only templates/article.vertical-hub.json \
  sections/ca-hub-hero.liquid sections/ca-hub-mock.liquid sections/ca-hub-offers.liquid sections/ca-work-grid.liquid sections/ca-testimonials.liquid \
  sections/ca-article-body.liquid sections/ca-apps-cards.liquid sections/ca-booking.liquid \
  snippets/ca-quote.liquid
```

then `https://conspireagency.myshopify.com/blogs/work/<handle>?view=vertical-hub&preview_theme_id=<id>`.
With no metafields set the page shows the black hero from the title (no cards), the body as
a lede, no mocks, the apps strip and the offers (from the metaobjects), and omits the proof
and the testimonial.
The two `templates/article.preview-*.json` files used for the 2026-10-25 reviews carry the
copy agent's text in the section fallbacks, with the buyer questions and the testimonial as
static `custom-liquid` sections in the same markup the real sections emit (the live bodies
still hold the old copy, and the BSD Haus quote record carries an em dash and a years
value). They live only on the development theme and are not committed; the copies are kept
in the session scratchpad for re-pushing.

Section stylesheets are bundled into `compiled_assets/styles.css`, and any change to how
the article body renders should re-run the containment check
(`.page-wrapper.contains(footer)`); both are in the memory note `horizon-theme-dev-testing`.
A mock card that lays out nowrap text in nested grids needs `min-width: 0` on every grid
item down to the clipped element, or the column overflows under its neighbour.

## Checklist before a page goes live

- Title and H1 read as the searcher's query; handle unchanged.
- Summary is one sentence; `global.description_tag` under 155 characters.
- Three to five pills, three outcomes, three to five H2 questions with 60 to 120 words each.
- Clients listed exist as `client` metaobjects with a preview, a store capture and a
  published case study; BodyBio never first or alone; years hidden where the engagement is a
  build or has ended.
- Mock copy names each app as ours and links its page; no price, no hour count.
- The two `offer` entries carry the current brief prices; a price change goes to the brief
  first, then to Content > Metaobjects > Offer, never to a template.
- No em dashes anywhere, including the quote record; no bold in the body or the rich text
  paragraphs; no price that is not in the brief or on the Pricing page.
- Every image has an alt (the theme supplies them; richer alts go on the Files records).
- Links: `/products/shopify-fractional-teams`, `/products/shopify-websites`, `/pages/pricing`,
  `/pages/b2b-onboarding-wholesale`, `/pages/b2b-wishlist-project-planner`,
  `/pages/draft-order-invoices`, `https://getbonde.com`.
