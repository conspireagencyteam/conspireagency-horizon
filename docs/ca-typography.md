# Conspire v2.0 — Typography System (Phase 1)

Source of truth: Figma [Conspire v2.0 · Homepage](https://www.figma.com/design/ccmuKMyD8c4709qOwluhGu/Conspire-v2.0?node-id=97-2).

This phase maps the design's type styles onto **Horizon's native type-preset
variables** (`--font-{h1…h6,paragraph}--*`), which `assets/base.css` applies to
every `h1`–`h6`, `body`, and `.button` theme-wide. All customization lives in the
Conspire Agency (CA) layer and loads after Horizon so it wins the cascade.

## Files

| File | Role |
|---|---|
| `snippets/ca-theme-variables.liquid` | `@font-face`, font preload, all CA CSS variables (families, weights, re-tuned tokens, H1/H3 size correction) |
| `assets/ca-custom.css` | Custom style rules (body tracking; marketing button chip) |
| `config/settings_data.json` | Sizes + line-height/tracking/case keywords per preset |
| `snippets/ca-head.liquid` | Loads `ca-theme-variables` (vars/fonts) then `ca-custom.css` (rules) |

## Fonts

| Family | Weights | Horizon slot | Used for |
|---|---|---|---|
| **PP Mori** | 400, 500 | `body` + `heading` | Body, all headings, H6 overline |
| **Syne** (OFL) | 400 | `subheading` | Footer column headings |
| **Ashcroft** | 500 | `accent` | Top navigation |

## Type scale (desktop @1440)

| Preset | Size | Line-height | Tracking | Case | Font |
|---|---|---|---|---|---|
| H1 | 86px `clamp(2.75rem,6vw,5.375rem)` | 0.95 | -0.03em | none | PP Mori |
| H2 | 48px | 1.1 | -0.03em | none | PP Mori |
| H3 | 36px | 1.1 | -0.03em | none | PP Mori |
| H4 | 24px | 1.1 | -0.03em | none | PP Mori |
| H5 | 20px | 1.2 | -0.02em | none | PP Mori |
| H6 | 16px | 1.2 | -0.02em | UPPERCASE | PP Mori |
| Body | 16px | 1.5 | -0.02em | none | PP Mori |
| Button | 18px | 1.0 | -0.02em | none | PP Mori |

- **H6** is the 16px uppercase overline/eyebrow that introduces sections.
- **H5** is the 20px small-heading tier (FAQ questions, section-nav labels, stats).
- Rule of thumb: tracking is **-0.03em on headings ≥24px, -0.02em on UI text ≤20px**.

## How it's controlled — settings-driven, with minimal CSS overrides

The system works *with* Horizon's token model rather than hard-coding each preset.
`settings_data.json` selects the keyword for every preset; the CA layer only holds
values that Horizon's settings/tokens can't express.

**Sizes** — admin sliders stay live; `settings_data.json` mirrors the scale to the
nearest enum (`h1=88, h2=48, h3=32, h4=24, h5=20, h6=16, paragraph=16`). The enum
has no **86**/**36**, so `ca-theme-variables.liquid` snaps those two at their
defaults (a merchant picking a different H1/H3 size passes through):

```liquid
{%- if settings.type_size_h1 == '88' -%}--font-h1--size: clamp(2.75rem, 6vw, 5.375rem);{%- endif -%}
{%- if settings.type_size_h3 == '32' -%}--font-h3--size: 2.25rem;{%- endif -%}
```

**Line-height** — presets resolve from the `display-*` (h1–h6) and `body-*`
(paragraph) token families. The design's 1.1/1.2 already equal `display-normal`/
`display-loose`, so those are just keyword selections. Only two token *values* are
re-tuned in `ca-theme-variables.liquid`: `--line-height--display-tight: 0.95` (H1)
and `--line-height--body-normal: 1.5` (body).

**Letter-spacing** — presets resolve from the `heading-*` family. Headings use
`heading-tight` (already -0.03em) via settings. The -0.02em body/small-text value has
no `heading-*` step, so we re-tune the (preset-unused) `--letter-spacing--body-tight`
token to -0.02em and apply it to body and to H5/H6 (small overrides — those two
tracking dropdowns are therefore inert).

**Case** — `type_case_h6: uppercase` via settings.

**CSS-only** (no settings/token slot exists): the four custom-font `--font-*--family`
repoints and the heading/subheading/accent slot weights (pickers resolve to wrong Inter
weights) + `--font-h6--weight: 500` — all in `ca-theme-variables.liquid`. Body tracking
is applied on `body` in `ca-custom.css`. Button sizing (18px) is handled by the marketing
button-chip rule in `ca-custom.css`; commerce buttons keep the theme default.

## Flags — needs custom handling (not in this phase)

1. **32px FAQ answer** (node 97:400) — the only 32px text; dropped from the heading
   scale and to be styled per-component later.
2. **Font files missing** — upload to `/assets` before fonts render (until then,
   system-stack fallback via `font-display: swap`):
   `pp-mori-regular.woff2`, `pp-mori-medium.woff2`, `ashcroft-medium.woff2`,
   `syne-regular.woff2`.
3. **Trial font** — Figma uses "Ashcroft **Test**"; ship the licensed *Ashcroft*.
4. **Mobile scale assumed** — Figma is desktop-only; the H1 `clamp()` min is an
   estimate pending mobile designs.
5. **Design label inconsistency** — the 16px eyebrow flips between PP Mori and Syne,
   and the 20px tier between Ashcroft/PP Mori and uppercase/Capitalize across
   sections. The system standardizes (H6 = PP Mori uppercase, Syne = footer,
   Ashcroft = nav); a few in-design spots are normalized rather than matched 1:1.
6. **`cart_price_font: subheading`** now resolves to Syne (a display font). Out of
   scope for the homepage; revisit when styling cart/checkout.
7. **Unused Inter webfonts** — the `type_*_font` pickers still reference Inter
   (families are overridden in CSS). Optionally point them at a system-font handle
   to stop Horizon downloading Inter.

## Verify

1. `shopify theme dev`, load the homepage.
2. Even without font files: no 404 breakage; text renders at correct sizes /
   line-heights / spacing (what this phase controls).
3. Drop in any woff2 named per the list to confirm `@font-face` resolves.
4. DevTools computed styles vs the table: H1 ≈ 86px @≥1440px, LH 0.95, -0.03em;
   H6 uppercase 16px; `.button` 18px; `body` 16px / LH 1.5.
