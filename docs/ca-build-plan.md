# Conspire v2.0 on Horizon: build plan

Written 2026-10-06. Figma file: `ccmuKMyD8c4709qOwluhGu` (Conspire v2.0). All frames are
desktop only (1440 wide). Every section node ID needed for the build is recorded in §5, so
no further Figma links are needed to keep going.

Status key: ✅ built · 🔨 to build from Figma · 🧩 no design, assemble from the section library

---

## 1. Where things stand (updated 2026-10-08)

**The theme is live.** Danny published it on 2026-10-07; `main` now syncs straight to the
published theme (a push is a production deploy, ~1–2 min). `shopify theme dev` still
pushes only to a development theme, so dev-server edits are safe until pushed.
`conspire-concept` is the rollback.

### Done 2026-10-07 (SEO pass, launch cleanup)

- **Audit.** 39 URLs on the dev theme vs live, four auditors. Findings and the
  checklist lived in the session; the durable outcome is below.
- **Structured data.** `snippets/ca-schema.liquid` (rendered from `ca-head`) emits on
  every page: Organization (`https://www.conspireagency.com/#organization`, no
  aggregateRating), WebSite + SearchAction, nav ItemList from `2025-header-nav`, home
  WebPage/speakable, CollectionPage for collections and blog indexes. It dispatches to
  `ca-service-schema` (Service per product), `ca-case-study-schema` (Article +
  BreadcrumbList) and `ca-article-schema` (BlogPosting + BreadcrumbList). `ca-faq` and
  `ca-faq-list` emit FAQPage. All hand-pasted JSON-LD was removed from the templates, as
  was the stock Product schema in `product-information.liquid`.
  2026-10-08: `ca-article-schema` also emits `@id`, `url`, `inLanguage`, `wordCount`,
  `thumbnailUrl` and one VideoObject per YouTube embed in the body (linked from
  BlogPosting.video; optional `custom.video_title/description/upload_date/duration`
  article metafields refine the first one). The one article-body JSON-LD block left
  (draft-order invoices post) now carries only its FAQPage.
- **Head.** `meta-tags.liquid`: one-line title with ` | Conspire`, absolute og/twitter
  image, no og:price, description fallback, search pages noindex with a query-free
  canonical, `/blogs/work?page=N` no longer self-canonicalises. Favicon = Figma node
  `315:1055`, uploaded as `conspire-favicon.png`.
- **Headings.** One H1 everywhere (search, cart fixed); cart/search drawer titles are no
  longer headings; `ca-article-body` demotes any `<h1>` in article HTML.
- **Pages.** CRO page rebuilt in the library (`ca-cro-calculator` is new); Shopify
  migration hub at `/products/shopify-migration` with `#woocommerce #bigcommerce
  #magento #squarespace` blocks (`ca-migration-platform` is new); FAQs restored on the LA
  page, `shopify-websites` and CRO; Replo template and chunks deleted.
- **Store.** Kept `/products/shopify-websites` (5k impressions vs 14) and set
  `shopify-website-development-agency` and the four `migration-from-*` products to
  draft; unpublished `/collections/shopify-migrations` and `/pages/guided-shopify-website`;
  nine 301s in place (old URLs → survivors, anchors included; the two pre-existing
  redirects were retargeted so nothing chains). 55 page/blog/article and 5 product SEO
  titles/descriptions written; 14 articles relinked to the surviving URLs.
- **Cookie banner.** `sections/ca-cookie-banner.liquid` in the footer group; writes
  consent through Shopify's Customer Privacy API, which `ca-lead-tracking` listens to.
  Mode is "regions set in Settings > Customer privacy" (US visitors are tracked by
  default, legally; the banner is for consent regions). The footer legal row carries the
  CCPA "Do not sell or share" link, which reopens the banner. Consent policy set via
  `consentPolicyUpdate` on 2026-10-07: consent required in the 27 EU states + IS LI NO GB
  CH; nowhere else; no data-sale opt-out regions (California gets the footer link, not a
  banner, on purpose — LA is the main market).

### Done 2026-10-07 (evening: mobile, home sections, B2B apps)

- **Mobile.** Full-width phone drawer with its own top row (X where the hamburger
  sits), SERVICES = two main services + collapsed "Specialty areas"; no focus boxes
  (pointer-initiated focus is unstyled, keyboard keeps rings). Service squares are
  videos (show reel on Website Design; the website-reveal GIF converted to an MP4 on
  Fractional) with poster frames; case-study cards autoplay the 480p preview when
  half in view on touch; `ca-process` and `ca-testimonials` are scroll-snap scrollers
  below 990px. Shopify-websites page: booking after the quote.
- **Home.** Blog section per Figma `278:2164` (three design images as fallbacks:
  `blog-fallback-1..3.jpg`; natural ratio on mobile). Apps section per Figma
  `390:793`, driven by app blocks. Booking above the FAQ.
- **B2B apps moved onto this site** (docs stay on apps.conspireagency.com): hub
  `/pages/best-shopify-apps` (`page.best-shopify-apps.json`, `ca-apps-cards`), and
  `/pages/b2b-onboarding-wholesale`, `/pages/b2b-wishlist-project-planner`,
  `/pages/draft-order-invoices` (`ca-app-*` sections, shared `ca-app-features`).
  Current app names are the subsite's — "GOAT" is retired everywhere. Old product
  listings are drafts and 301 to the pages. `goat-apps-site/middleware.ts` 308s the
  four marketing routes to these pages (pushed 2026-10-07). Inventory of the subsite
  lived in the session scratchpad; the subsite source is
  `~/dev/internal/apps/conspire/shopifyapps/goat-apps-site`.
- **Still to do for the apps:** the wishlist page's 4th brand card is a placeholder;
  the drafts hero's first "New" pill wraps on phones; populate the home apps rows'
  optional hover-preview screenshots.

### Done 2026-10-08 (apps sweep, listings, mobile fixes, work page)

- **App pages sweep.** `ca-app-hero` shared across the three apps: rating above the
  headline, full-bleed, playable tour in a `<dialog>`, mobile-tuned; lost animations
  restored (`hero-drift`, drafts `ca-app-ticker`); sliders use `ca-app-scroller.js` +
  `ca-app-scroller-controls` like the rest of the site.
- **App Store listings.** Website URLs on all three listings now point at the Shopify
  pages (driven via Claude in Chrome). Privacy/docs links checked: all resolve.
  Awaiting Danny: Wholesale "Support URL" → `apps.conspireagency.com/wholesale/docs`
  (it currently chains help.conspireagency.com → apps hub → Shopify hub), and the Drafts
  FAQ URL → `/pages/draft-order-invoices#faq` (anchor exists via `ca-faq-list.anchor_id`).
- **Header on phones.** Lost its solid background on work/case-study pages because
  `.page-wrapper` is only the scroll container at ≥990px. `ca-header.js` now listens on
  `document` (capture) and reads `max(pageWrapper.scrollTop, window.scrollY)`, with
  hysteresis (stick >120, release <60).
- **Work grid on touch.** `.ca-wcard__reveal` is shown from the start on non-hover
  devices (BodyBio/TCS top images were blank on phones). Featured list on
  `/blogs/work` is now Zia, BodyBio, Cousins Maine Lobster, TCS, Nature's Answer,
  Kinto, Portola, Simms, Cousins Fried Seafood, Omre. New `client` metaobject
  `cousins-fried-seafood` (logo `cfs-logo.png`; `work_preview` is
  `cfs-work-preview.jpg`, a collage of the brand's own illustrations — Jim and Sabin,
  the truck, the lighthouse badge — on the site cream, no food; home screenshot +
  walkthrough video as the reveal; years "6+"; links to the `cousins-fried-seafood`
  article). Simms' `work_preview` is `simms-banner-1.png`; it
  still has no `featured_site_image`.
- **Brands marquee.** Hover slow-down only for `pointerType === 'mouse'` and
  `touch-action: pan-y` on the strip — a thumb landing on it no longer freezes it.
- **Performance pass (Danny: "takes a long time to load / refuses to go between
  pages").** Measured on desktop Chrome: TTFB 30–200 ms, load 1.0–1.5 s, ~1.7–2.5 MB,
  350+ requests. Not reproducible on desktop; the big phone costs were: (1) the
  Calendly inline embed, ~3 MB (1.7 MB JS + 1.2 MB CSS) in an iframe on every page,
  now lazy via `<ca-calendly>` in `ca-booking.liquid` (loads within 600px of the
  viewport; lead tracking still hears the iframe's postMessage); (2) Shopify's own
  checkout preloader from `content_for_header` (~177 low-priority prefetches, ~190 KB,
  Chrome only, after `load`) — not controllable from the theme; (3) ~25 monorail
  beacons + 5 `gtag/js` loads (ours is AW only; the rest are the Google channel
  pixel) + FB pixel 212 KB. Video warm-up is already pointer-only and sequential;
  browsers pick the first `<source>` so everything streams at 480p. View
  transitions are off. If it recurs, get device/browser/network from Danny.
  - Lighthouse pass 2026-10-08 (home, mobile 89 / desktop 87 on `www.`; testing the
    apex URL scores 69 only because of the 301 to `www.`): `snippets/image.liquid`
    now defaults to `loading="lazy"` (pass `loading: 'eager'` for first-viewport
    images: header logo, first 4 marquee cards) and honours `width:` (the booking
    tiles passed `width: 240` and got full-size originals). Work-list reveal images
    are sized by width (420) instead of `height: 1600`. Mega-menu videos emit
    `data-poster`; `ca-header.js` promotes it on first header hover/open, since a
    real `poster` downloads at parse time even with `preload="none"`.
    `ca-lead-tracking` configures only G-MS33YR263E (agency) — G-DDS9Q60DBE is
    the Wholesale app listing property; it was getting agency page views because
    its Google tag had AW-852658178 as a combined destination. Danny split the Ads
    destination into its own Google tag "Conspire Ads" = **GT-PLVXZJKV**, but
    Google never removes IDs from a tag, so `AW-852658178` stays a permanent alias
    of the Wholesale container: `gtag("config","AW-852658178")` anywhere still
    leaks. The theme therefore loads and configs **GT-PLVXZJKV** (conversions keep
    `send_to: "AW-852658178/<label>"`, routed by gtag; verified in headless Chrome).
    Image source format is irrelevant on Shopify's CDN (tested: JPG vs PNG source
    gives byte-identical WebP at every requested size) — ignore Lighthouse's
    "compression" line; only the requested rendition size matters. The Shop Pay /
    checkout preloads and third-party cookies are Shopify's.
  - **Custom Shopify Applications page (2026-10-08).** `/products/custom-shopify-applications`
    now uses `product.custom-apps.json` (price $7,500 = one Starter Sprint, matching the pricing page). Sections: hero (seo_heading), `ca-apps` cloned from
    home, `ca-client-rows` with app/integration summaries for zia-tile, simms-fishing,
    sto-n-sho,
    cousins-maine-lobster; `ca-value-cards` what-we-build; `ca-process` sprint; `ca-sprints-table`;
    fit, testimonials, FAQ, services, booking. SEO title/description set as metafields.
    Migration hub `ca-migration-platform` body text now spans columns 1–7.
  - **Client records (2026-10-08).** `sto-n-sho.work_preview` = `sto-n-sho-banner-2.png`
    (was empty, so its hero/marquee card rendered grey). Marquee logos get no CSS
    treatment: whatever file is on `client.logo` shows as-is, so the rule is "the
    brand's real logo" — white knockouts where the brand has one, colour otherwise;
    never a desaturated copy. Tillamook switched from the B&W `tillamook.png` to the
    colour `tcs-logo.png`. Still off: `omre.logo` is `White.png` (77×16, renders grey,
    near-invisible) and `omre-logo.png` has a baked tan background — needs a white
    knockout from Danny. Nature's Answer, Sto N Sho and Portola are colour and fine.
  - **Hanging navigations (2026-10-08).** Danny's tabs on the site would sit with the
    document request `pending` (0 B, no protocol) while other sites worked; `chrome://
    net-internals/#sockets` → Flush socket pools unstuck it, i.e. a dead h3/QUIC
    connection Chrome kept reusing. Cause on our side: `caWarmVideos` in `ca-custom.js`
    did `preload="auto"` + muted `play()` for every mega-menu video on first header
    hover, and Chrome then downloads the whole file — 3.5–8 MB each, 30–40 MB per page —
    saturating the connection. Warm-up is now `preload="metadata"` only (container header
    + first chunk). If it recurs, check the Network panel's media rows first.
  - **Legacy URL sweep (2026-10-08).** Unpublished (not deleted, so reversible) and
    301'd: `/pages/draft-order-invoice-shopify-application` → `/pages/draft-order-invoices`,
    `/pages/project-planner-wishlist-shopify-application` → `/pages/b2b-wishlist-project-planner`,
    `/pages/shopify-services` → `/collections/services`, and the two old collections
    (`shopify-store-development`, `shopify-strategy-development-design-management-retainers`,
    removed from the Online Store channel) → `/collections/services`. All had 0 GSC clicks in
    90 days. `/collections/services` now lists Shopify Migrations second (product
    `shopify-migration` added to the collection, with `product_details.display_title` /
    `excerpt` set). Then deleted (Danny, 2026-10-08): the Bonde demo product and all seven DRAFT
    products (four old migrations, Conspire Build, invoice-app and wholesale-app drafts).
    `/pages/reviews` is now published on `page.reviews.json` (intro, all seven `quote`
    metaobjects, client rows, booking); five `quote` entries were created from the clients'
    own `testimonial` fields — note metaobjects created via the API start as publishable
    DRAFT and must be set ACTIVE or the storefront skips them. Services order everywhere:
    Growth & Support Teams, Websites, Migrations, Applications, CRO (CRO last on purpose).
  - **Keyword H1 vs tagline.** `ca-brands-marquee` has an optional `seo_heading`
    setting: when set, it renders as the H1 styled as an eyebrow above the tagline
    and the tagline becomes `<p class="h1">` (same type). Set on
    `product.shopify-website-2025` ("Shopify Website Design & Development") and
    `product.new-fractional-teams` ("Shopify Plus Premier Development Agency") —
    the old site's H1s, which the Horizon taglines had replaced (Ahrefs flagged the
    H1 change 2026-10-08). Home still uses the tagline as H1 (watch item above).

- **B2B app cards under articles** (`ca-article-apps`, in `article.json` between body
  and related). Renders only when the article is tagged `b2b` (case insensitive;
  tag is a section setting), so the pipeline turns it on by tagging and a post opts
  out by removing the tag. Three `app` blocks (Wholesale, Wishlist, Drafts: eyebrow,
  name, one-line pitch, app page + App Store links) in a grid of up to four columns,
  then a single custom-development line to `/collections/services`. Copy lives in the
  theme editor, not article bodies, so the fact checker, voice pass and wordCount
  never see it. Not Bonde, and no fourth "services" card: the articles already end
  on the booking CTA. In the editor an untagged article shows a "hidden" notice.

- **Article template to the mockup (443:147)** (Danny, 2026-10-08). Header is
  `#0d110d` / white and runs under a transparent site header like the case hero;
  body is white (was the `#f2f2f2` default); related articles is dark with the
  three `blog-fallback-N.jpg` images like the home blog section; the B2B apps band
  sits on `#f2f2f2` between them.
  - **Article video.** The video pipeline writes `custom.video_youtube_id`,
    `video_url`, `video_thumbnail_url`, `video_title`, `video_description`,
    `video_upload_date`, `video_duration` on every publish. `ca-article-header`
    reads the id/thumbnail/title and shows the video under the title as a
    click-to-play poster (`<ca-lite-video>`, iframe created on click), falling
    back to the first YouTube embed in the body for older posts
    (`snippets/ca-article-video.liquid`). `ca-article-body` (`hoist_video`) drops
    that first body embed so it is not shown twice; a no-op once the pipeline
    stops inserting the iframe. With hero media the header is two columns
    (date + smaller title left, media right) so the video is in view without
    scrolling; the featured image is the fallback when there is no video, in
    the same slot; the article excerpt sits under the title as a subheadline
    (`show_summary`), the same text as the meta description. Under the header
    a 160px decorative band (`band_image`, the
    design's stock shot = `blog-fallback-3.jpg`) separates the dark header
    from the white article. `ca-article-schema` seeds the VideoObject list
    with the metafield id and uses `video_thumbnail_url` for the first video.
  - `ca-article-apps` must not use Horizon's `"class": "section"`: that class
    is a 3-column grid that puts the section's children in the centre column,
    so a background colour stops at the page margin.
  - Still plain: the blog index grid (`ca-blog-grid`) has no fallback images.

### Open (decide, then do)

- **Market pages** (`/blogs/markets/*`, 24 articles): keep. GSC Jul–Oct 2026: ~14k
  impressions, 8 clicks; Seattle, NYC, Dallas, Portland, SF, San Diego, Columbus,
  Nashville lead. Plan: unique local copy for those eight, strip "Ecommerce" from every
  H1 so it reads "Shopify Plus Agency in <City>", add per-market `Service` +
  `areaServed: City` schema (not LocalBusiness — no offices). Portland's top query is
  "shopify website developer near me" (5k impressions), so one "near me" page may beat
  the long tail.
- **About us**: done 2026-10-07 — `/pages/about-us` unpublished and 301'd to
  `/pages/los-angeles-shopify-agency`, which carries the About role (Figma `458:100` is
  that frame).
- **Home H1 watch item.** The tagline is the H1 (keyword paragraph is the `<p>` under it,
  keyword is in the title). The homepage ranked #6 for "shopify web design agency" under
  the old markup (H1 = paragraph); if that slips, flip it in `ca-brands-marquee.liquid`.
- The five draft products still exist in admin; delete whenever.
- `/pages/reviews` published 2026-10-08 on `page.reviews.json`.
- `custom-shopify-applications` is a bare stock product page with a $5,000 price in its
  Service schema; needs content or a draft.

**Built from Figma and checked in the browser at desktop and mobile widths:**
Fractional Teams, Conspire Build, Our Work (with hover), case study, blog article, careers
list, career post, Pricing, Contact, LA agency / about, market pages. The homepage was
diffed against the current frame (`278:1875`).

**Assembled from the same sections (no Figma frame):** default page, blog index, markets
index, the other service products (CRO, migrations, landing pages), the two service
collections, 404.

**Carried over from the old theme:** lead tracking (`snippets/ca-lead-tracking.liquid`),
contact and careers form field names, JSON-LD structured data, Calendly URLs, page copy.

### Needs Danny

1. **Fonts.** Done 2026-10-07: PP Mori Regular/Medium and Ashcroft Medium are in
   `/assets` and loaded by `snippets/ca-theme-variables.liquid`; Horizon's font pickers
   hold a system font so Inter is no longer downloaded. Syne was removed.
2. **Header menu.** Done 2026-10-07: the header reads `2025-header-nav` (Services / Our
   Work / Pricing) plus a "Let's Talk" button, and the live site's Services and Our Work
   mega menus are rebuilt as `services_mega` / `work_mega` / `work_case` blocks on the
   header section (same settings as the live theme, so the values carried over). Edit them
   in the theme editor under Header. The Figma header (Shopify Websites / Fractional
   Teams / More) was not used, per Danny.
3. **Client data gaps** (Content > Metaobjects > Client). The Work grid and client rows
   read these entries:
   - Simms Fishing, Elway Capital, Embodied Moxie and Sto N Sho have no `work_preview`
     image; BodyBio, Tillamook, Omre and others have no `services`.
   - Cousins Fried Seafood has a case study but no client entry.
   - P.Kay Metal's `case_study_reference` points at `/blogs/work/pkay-metail` (typo; the
     article is `pkay-metal`).
   - `years` for Kinto and Nature's Answer is empty, so no badge shows.
4. **Shopify Applications product** (`custom-shopify-applications`) uses the default
   product template, which stays the stock commerce layout because the Bonde demo product
   and two app listings need a buy form. Assign it the new **service** template in admin
   (`product.service`); the live theme ignores an unknown suffix, so this is safe today.
5. **Pages parked for later** (they work, on the generic layouts): landing pages, the two industry landers in the Work blog (`health-brand`,
   `tile-paint` suffixes fall back to the blog article layout), `guided-shopify-website`,
   `shopify-services`. Say which should be hidden or redesigned.
6. **Copy calls.** Build pricing follows the mockups ($15k / $25-45k / $100k+). Figma copy
   still says "Shopify websites" in places where the brand voice doc says "Shopify stores";
   left as designed. The about page currently reuses the LA page copy.
7. **Post-publish checks still owed:** submit one test contact form and one test
   application, and check Calendly loads on each page. (Cookie banner: done 2026-10-07.)

### How the templates are generated

Template JSON was generated by small Python scripts (kept outside the repo) and is now
plain JSON in `templates/`. Edit it in the theme editor or by hand from here on. Shared
content that repeats across templates (booking photos, testimonials, services list) was
copied from `templates/index.json`.

## 2. Ground rules for the build

1. **Upstream-safe.** All custom code lives in `ca-*` files (sections, snippets, blocks,
   assets). Stock Horizon files are not edited, apart from the one `ca-head` render line
   already in `layout/theme.liquid`.
2. **Keep the live template suffixes.** A template suffix is stored on the page, product,
   blog or article itself, not in the theme. If the new theme has a file with the same
   suffix, the resource picks up the new design the moment the theme is published, with no
   reassignment in admin and a clean rollback. A suffix with no matching file falls back to
   the default template. So: name new templates after the suffixes already in use (§3), and
   only create a suffixed file where the layout really differs from the default.
3. **Reuse the store's existing custom data** (§4) before adding anything new.
4. **Content from the store, layout from Figma.** Figma repeats placeholder data (every
   case study shows "+6 years partnered" and the same pills). Real values come from the
   `client` metaobjects and article metafields.
5. **Copy.** Marketing copy is taken from Figma as written. Rules from the old repo still
   apply to anything I write myself (no em dashes, "Shopify store" not "site", "Conspire
   Build" naming). Where Figma copy conflicts with those rules I flag it instead of
   silently rewriting.
6. **Typography** comes from Horizon's presets as tuned in `docs/ca-typography.md`. New
   one-off sizes need a reason.
7. **Responsive.** No mobile designs exist, so mobile and tablet layouts are derived from
   the homepage patterns already in the repo.
8. **Per section workflow:** pull the node with `get_design_context`, build, run
   `shopify theme dev --store conspireagency.myshopify.com`, compare against the Figma
   screenshot in the browser, then move on.

## 3. Template map

Live usage was read from the store on 2026-10-06 (pages, blogs, articles via Admin API;
products inferred from the live pages because the CLI token has no product scope).

| Area | Live resource(s) | Live suffix | Figma | File in this theme | Status |
|---|---|---|---|---|---|
| Homepage | `/` | n/a | `278:1875` | `index.json` | ✅ needs diff pass |
| Our work | blog `work` (24 articles) | `work` | `315:1651`, hover `315:1939` | `blog.work.json` | 🔨 |
| Case study | 22 in `work`, 2 in `shopify-application-development` | `case-study-template` | `315:1213` | `article.case-study-template.json` | 🔨 |
| Fractional teams | product `shopify-fractional-teams` | `new-fractional-teams` (inferred) | `279:2371` | `product.new-fractional-teams.json` | 🔨 |
| Conspire Build | product `shopify-website-development-agency` | `guided-builds` (inferred) | `396:54` | `product.guided-builds.json` | 🔨 |
| Pricing | page `pricing` | `pricing-page` | `429:2502` | `page.pricing-page.json` | 🔨 |
| Contact | page `contact` | `contact` | `433:3025` | `page.contact.json` (replace stock) | 🔨 |
| Blog article | blog `shopify` (24 articles, suffixes `article` / `basic` / none) | all resolve to default | `443:147` | `article.json` | 🔨 |
| LA agency page | page `los-angeles-shopify-agency` | `la-shopify-agency` | `458:100` | `page.la-shopify-agency.json` | 🔨 |
| Market pages | blog `markets`: 24 articles + NYC | `market`, `nyc` | `458:100` (same design) | `article.market.json`, `article.nyc.json` | 🔨 |
| About | page `about-us` | `about-us` | `458:100` (same design) | `page.about-us.json` | 🔨 |
| Careers | blog `careers` (2 articles) | `careers` | `474:1217` | `blog.careers.json` | 🔨 |
| Career detail | articles in `careers` | `careers` | `474:774` | `article.careers.json` | 🔨 |
| Blog index | blog `shopify` | `shopstack` | none | `blog.shopstack.json` + `blog.json` | 🧩 |
| Markets index | blog `markets` | `market` | none | `blog.market.json` | 🧩 |
| Industry landers | 2 `health-brand` articles, 1 `tile-paint` | `health-brand`, `tile-paint` | none | fall back to case study layout unless told otherwise | 🧩 |
| Other service products | `shopify-websites`, `shopify-cro-agency`, 5 migration products, `custom-shopify-applications`, landing pages, 2 app products | various | none | `product.json` rebuilt as a service page from the library, suffixed files only where needed | 🧩 |
| Collections | `services`, `shopify-migrations`, 2 more | `services`, `shopify-migrations` | none | `collection.json` as a services list | 🧩 |
| Plain pages | privacy policies, accessibility, app pages, `shopify-services`, `guided-shopify-website`, `reviews` (hidden) | mostly default | none | `page.json` (rich text in the new type system) | 🧩 |
| Utility | 404, search, password, cart, customers | n/a | none | restyle stock Horizon | 🧩 |

## 4. Custom data map

Already in the store and reused as is:

| Data | Fields that matter | Used for |
|---|---|---|
| Metaobject `client` (17) | `name`, `logo`, `work_preview`, `work_summary`, `featured_site_image`, `featured_site_media`, `years`, `services` (list), `case_study_reference` (url), `testimonial` | Work grid, client rows, more projects, homepage work list |
| Metaobject `quote` (3) | `quote`, `name`, `partner_since`, `logo` | Testimonials, contact sidebar quote |
| Metaobjects `faq` (10), `faq_category` (3) | | FAQ sections |
| Metaobject `app` (1) | `name`, `tagline`, `description`, `icon`, `app_store_url` | Apps section |
| Article `custom.banner_video` (file) | | **The optional featured video** on case studies. Reused for regular blog articles too (falls back to the article image) |
| Article `custom.service_list`, `custom.website_url`, `custom.blog_short_description`, `custom.blog_logo`, `custom.quote` | | Case study hero pills, Visit Website button, summary |
| Article `custom.work_location`, `work_type`, `work_hours`, `work_country` | | Career pills (San Diego, CA / Hybrid / Full-time / United States Only) |
| Article `custom.market_data_*`, `custom.market_blurb` | | Market pages |
| Product `product_details.display_title`, `product_details.excerpt` | | Services section |
| Page `header.*`, `custom.footer_hide_footer` booleans | | Per page header and footer toggles (port to `ca-header` / `ca-footer`) |

Proposed additions (both additive, neither affects the live theme):

1. **Article metafield `custom.client`** (metaobject reference to `client`). Gives each case
   study its years partnered, services and site media from one source instead of
   duplicating them per article. Falls back to the article's own metafields when empty.
2. Nothing else. Pricing tiers, sprints, fit lists and process steps are section blocks,
   not metaobjects, since they are page copy.

## 5. Pages, section by section

Node IDs are the direct children of each page frame. Header and footer are the global
groups and are not repeated below. "Booking" is the existing `ca-booking` section.

**Our work `315:1651`** (hover state `315:1939`)
- `315:1652` Hero: eyebrow left, large statement right, button → `ca-page-intro` (new)
- `315:1663` Top projects: 2 column staggered grid of client cards (image, name, years,
  service pills, Learn More) → `ca-work-grid` (new). Hover: the lifestyle image stays as
  the backdrop and the store screenshot fades in on top of it as a centered card
  (`work_preview` behind, `featured_site_media` or `featured_site_image` in front).
- `315:1864` More projects: client names inline, separated by slashes; hovering a name
  highlights it and shows that client's preview image at the cursor → `ca-more-projects` (new)
- `315:1891` Booking

**Case study `315:1213`**
- `315:1214` Dark hero: years partnered, title, featured video (optional, else image),
  service pills, summary, Visit Website → `ca-case-hero` (new)
- `315:1246`, `315:1260`, `315:1360` Body with a sticky left table of contents →
  `ca-article-body` (new, shared). The TOC is generated from the `<h2>` tags in
  `article.content` (the Nature's Answer article already has Background / The Problem /
  The Approach / The Result as H2s). Server side Liquid adds anchor IDs and builds the
  list; a small script marks the active item on scroll. H2s are visually hidden on desktop
  (the TOC is the label) and shown on mobile where the TOC collapses. First paragraph after
  each H2 is the large lead style; H3s, lists, images and inline videos get article styles.
- `315:1378` More cases: intro + client rows → `ca-page-intro` + existing `ca-work-list`
- `315:1453` Booking

**Blog article `443:147`**
- `443:148` Header: date eyebrow + title → `ca-page-intro` variant
- `443:155` Full width media: article image, or `custom.banner_video` when set
- `443:156` Body with TOC ("Chapter 1, 2, 3" are the article's H2s) → `ca-article-body`
- `443:264` Related articles → existing `ca-blog`
- `443:287` Booking

**Career detail `474:774`**
- `474:775` Header: posted date, title, pills → `ca-page-intro` variant
- `474:793` Overview: eyebrow + lead paragraphs (content before the first H2)
- `474:804` Body with TOC, plus a "View All Open Positions" link under it → `ca-article-body`
- `474:1129` Apply form (last TOC entry) → `ca-apply-form` (new, native Shopify contact form)
- Note: the live career articles use H1 and H3 with no H2. The TOC needs H2s, so the
  section will treat top level headings as TOC entries, and the two articles should be
  tidied in admin.

**Careers `474:1217`**
- `474:1218` Hero → `ca-page-intro`
- `474:1226` Open positions: rows with title, pills, excerpt, button → `ca-careers-list` (new)

**Fractional teams `279:2371`**
- `279:2372` Hero: H1 + copy + button + image strip → generalize the homepage hero (`ca-hero`)
- `279:2433` Built to stick around: intro + client rows (name, years, summary, pills, image)
  → `ca-client-rows` (new, shared with Build and Pricing)
- `279:2541` The questions change: intro + drifting rows of quote cards → `ca-question-cards` (new)
- `279:2602` Communication is everything: numbered 01 to 03 → `ca-numbered-steps` (new)
- `279:2632` Retainer tiers ($6k / $10k / $18k rows) → `ca-pricing-tiers` (new, shared with Pricing)
- `279:2666` FAQ → existing `ca-faq`
- `279:2723` Testimonials → existing `ca-testimonials`
- `279:2758` Book a strategy call + Who it's for / not for accordion + booking → `ca-booking` variant
- `279:2788` Is this right for you (A fit if / Not a fit if) → `ca-fit-check` (new, shared with Build)

**Conspire Build `396:54`**
- `396:55` Hero → `ca-hero`
- `396:136` The Conspire Build: Art direction / UX / Development / Migration → `ca-process` (new)
- `396:187` Shopify migrations split feature → `ca-split-feature` (new)
- `396:195` Our case studies → `ca-client-rows`
- `396:300` More projects → `ca-more-projects`
- `396:726` Pricing, scoped line by line: $15k / $25-45k / $100k+ bar graphic, 8 to 14 weeks
  → `ca-build-pricing` (new, shared with Pricing). `396:327` is a hidden older version; ignore.
- `396:420` Built for growth: 3 value cards → `ca-value-cards` (new)
- `396:453` Fit check → `ca-fit-check`
- `396:535` Testimonials, `396:570` Services (expanded variant of `ca-services`), `396:677` Booking

**Pricing `429:2502`** (frame is mislabeled "Fractional teams" in Figma)
- `429:2503` Hero → `ca-hero`
- `429:2564` Retainer tiers → `ca-pricing-tiers`
- `429:2598` Focused Builds sprints comparison ($7.5k / $14k) → `ca-sprints-table` (new)
- `429:2660` Build pricing → `ca-build-pricing` (Signature Builds block `429:2724` is hidden in Figma)
- `429:2752` Client rows, `429:2860` Testimonials, `429:2895` Booking with accordion

**Contact `433:3025`**
- `433:3028` Headline + form (name, work email, brand, role, platform, ERP, timeline,
  revenue, paid media spend, problems, how did you hear) + sidebar (quote card, case study
  card) → `ca-contact` (new). Native Shopify contact form with `contact[...]` fields.
- `433:3114` Booking

**LA agency / market / about `458:100`** (frame is mislabeled "Shopify Website Builds")
- `458:101` Hero → `ca-hero`
- `458:182` Statement → `ca-page-intro`
- `458:188` Story 01 to 04 with images → `ca-numbered-steps` variant
- `458:216` The Conspire Advantage → `ca-split-feature` variant
- `458:321` Services, `458:366` Top projects (`ca-work-grid`), `458:567` Testimonials, `458:602` Booking
- Market articles reuse this layout with city data from `custom.market_data_*`.

## 6. New section library (summary)

Shared pieces first, since most pages are combinations of them:

`ca-page-intro`, `ca-hero` (generalized homepage hero), `ca-article-body` (TOC),
`ca-work-grid`, `ca-more-projects`, `ca-client-rows`, `ca-pricing-tiers`, `ca-build-pricing`,
`ca-fit-check`, `ca-numbered-steps`, `ca-split-feature`

Page specific: `ca-case-hero`, `ca-careers-list`, `ca-apply-form`, `ca-contact`,
`ca-question-cards`, `ca-process`, `ca-value-cards`, `ca-sprints-table`

Shared snippets: pill, years-partnered badge, arrow button, eyebrow + hairline row (some
exist in `ca-custom.css` already).

## 7. Build order

0. **Foundations.** Font files in, shared snippets, `ca-page-intro`, `ca-hero`
   generalization, homepage diff against `278:1875`, header and footer links checked
   against the live URLs.
1. **Work and case studies.** `blog.work`, `article.case-study-template`, including
   `ca-article-body` and the TOC.
2. **Editorial.** `article.json`, `blog.careers`, `article.careers`.
3. **Service pages.** Fractional teams, then Conspire Build, then Pricing (each one adds
   sections the next reuses).
4. **Contact, LA / market / about.**
5. **No design pages** (§3 rows marked 🧩) assembled from the library.
6. **Launch prep** (§8).

Each step ends with a commit, so the unpublished theme always shows current progress.

## 8. Launch checklist (parity with the live theme)

- Lead tracking ported from `conspire-concept/layout/theme.liquid`: GA4 `generate_lead`,
  Meta pixel `Lead`, Google Ads conversions loaded after consent, for the contact form and
  Calendly bookings. Do not re-add `invitee_meeting_scheduled` (Calendly's Meta
  integration already sends it).
- Calendly embed in `ca-booking` verified on every page that uses it.
- Contact and careers forms deliver email, with spam protection.
- Every live suffix in §3 resolves to a designed or assembled template. Crawl the old
  sitemap against a preview of this theme and check for 404s and missing content.
- Template content entered for every JSON template (theme JSON does not carry over from
  the old theme).
- SEO: titles, meta descriptions, structured data, canonical tags, one H1 per page. Done 2026-10-07 (see §1).
- Accessibility pass per the `.cursor/rules/*accessibility*` standards, performance pass.
- Navigation menus, redirects, announcement and consent banner checked.
- Publish, smoke test, keep Conspire Concept as the rollback.

## 9. Open questions

1. **Fonts.** Licensed PP Mori (Regular, Medium) and Ashcroft (Medium) woff2 files are
   needed. Figma uses the trial "Ashcroft Test".
2. **Build pricing numbers.** Visible Figma says $15k, $25-45k, **$100k+** with the
   Signature Builds block hidden. The old repo's copy rules say Conspire Build is $15K to
   $75K and Signature Build is $100K+. Default: follow visible Figma.
3. **Store data changes.** OK to add the `custom.client` article metafield and to change
   the two career articles' top level headings to H2?
4. **No design pages.** OK to assemble them from the library, or are some being retired
   (for example `guided-shopify-website`, the landing pages product, the industry landers)?
5. **Mobile.** Derived from the desktop designs unless mobile frames exist.
