# Conspire v2.0 — Header + Brands carousel

Two CA sections plus one store-side metaobject implement the top of the homepage
([Figma 97-4](https://www.figma.com/design/ccmuKMyD8c4709qOwluhGu/Conspire-v2.0?node-id=97-4)).

## Files

| File | Role |
|---|---|
| `sections/ca-header.liquid` | Minimal header — nav left (Shopify menu), logo right (theme logo), sticky, transparent-over-hero. Scoped `{% stylesheet %}`. |
| `assets/ca-header.js` | `<ca-header>` element: `data-stuck` on scroll + accessible mobile drawer (focus trap, `Esc`, overlay, `inert`). |
| `sections/ca-brands-marquee.liquid` | Brands carousel — `metaobject_list` of the existing `client` metaobject, auto-scroll via the theme's `marquee-component`. |
| `sections/header-group.json` | Header group now renders `ca-header` (Horizon's `header` + announcement bar removed). |
| `templates/index.json` | `ca-brands-marquee` added as the first section with `allow_transparent_header: true`. |

## Data — the existing `client` metaobject (type `client`)

The carousel reads the store's existing **Client** metaobject. The section uses this subset (field keys are Shopify's standard underscore form — verify in Admin by expanding a field):

| Purpose | Client field | Key (assumed) |
|---|---|---|
| Card title / alt | Name | `name` |
| Logo overlay | Logo | `logo` |
| Card background image | Featured site image *(default; selectable)* | `featured_site_image` |
| Card link | Case study reference | `case_study_reference` |

- **Card image** is chosen per section via the **Card image** setting — Featured site image (default), Work preview, or Case study image.
- If your field keys differ, edit the four `assign` lines at the top of `sections/ca-brands-marquee.liquid` (and the select `value`s) to match.
- The `client` definition must have **Storefronts** access enabled for the `clients` picker and Liquid to read it.

## Populate the carousel

Theme editor → the **Brands carousel** section → **Clients** → pick and reorder entries; choose the **Card image** field. Also: speed, direction, gap, card radius, color scheme, padding.

## Transparent header (Prestige-style, per section)

The header is solid + sticky by default. Any section can opt to sit *under* a
transparent header:

- The section enables **Allow transparent header** and sets **Transparent header text color** (shown only when the checkbox is on, via `visible_if`).
- It then renders the marker class `.ca-allow-transparent-header` and emits `--ca-header-transparent-text` onto `.ca-header`.
- `ca-header.liquid` goes transparent **only when that section is the first on the page** — `body:has(#MainContent > .shopify-section:first-child .ca-allow-transparent-header) .ca-header--sticky:not([data-stuck])` — and reverts to solid once `ca-header.js` sets `data-stuck` on scroll.
- If `settings.logo_inverse` is set, the header swaps to it while transparent.

This mirrors Horizon's own transparent-header technique (CSS-variable color + `color_brightness`, `:has()` offset, `not-sticky` on scroll) but moves the control from the header's per-template settings to the first section.

## Hero content (top of the section)

The section now includes the hero top above the carousel (Figma Frame 61):
badge image, H1 heading, body paragraph, and a **Get Started** button. These are
plain section settings (**Hero content** group): `badge_image`, `heading`
(inline richtext), `body` (richtext), `button_label`, `button_link`. Leave them
blank to render the carousel only.

The button reuses the marketing button chip (`a.button.size-style` in
`ca-custom.css`), so it inherits the pill + arrow-chip styling and the theme's
primary button colors automatically.

## Notes / follow-ups

- Fonts (nav = Ashcroft, headings = PP Mori) depend on the **woff2 uploads** from the typography phase.
