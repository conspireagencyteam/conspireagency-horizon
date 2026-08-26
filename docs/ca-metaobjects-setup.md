# Conspire v2.0 — Metaobjects manual setup (Admin UI)

The provisioning script (`scripts/ca-metaobjects.mjs`) can't run against
`conspireagency.myshopify.com` because we don't have a Dev Dashboard app in that
store's org (client-credentials returns `shop_not_permitted`). So create these by
hand in **Admin → Settings → Custom data**. The script + `scripts/ca-metaobjects-data.json`
remain the source of truth and can automate this later if app access appears.

> **Keys matter.** When you add a field, Shopify auto-fills a **key** from the
> name — but the theme sections reference the exact keys below. Verify/adjust each
> key to match. If Admin forces a different key or type handle, tell me and I'll
> match the section code to it instead.
>
> **Storefronts access:** every definition below must have **Storefronts** access
> **enabled** (Definition → ⋯ → *Access* / "Expose to Storefront API"), or Liquid
> can't read it.

Do it in this order (FAQ before FAQ Category — the category references FAQ).

---

## A. New metaobject definitions

### 1. FAQ  — type handle `faq`
| Field name | Key | Type | Options |
|---|---|---|---|
| Question | `question` | Single line text | Required. Set as the **display name**. |
| Answer | `answer` | Rich text | |

### 2. FAQ Category — type handle `faq_category`
| Field name | Key | Type | Options |
|---|---|---|---|
| Name | `name` | Single line text | Required. Display name. |
| FAQs | `faqs` | Metaobject (reference) → **FAQ** | **List of entries** (not "One") |

### 3. Service — ~~metaobject~~ → **Products** (superseded)
The Services section is now driven by **products**, not a metaobject. Skip the
`service` metaobject. Instead add one product metafield and pick products in the
section. See §E.

**Product metafields to add** (Settings → Custom data → Products → Add definition):
| Field name | Namespace.key | Type |
|---|---|---|
| Display title | `product_details.display_title` | Single line text — service title (falls back to the product title if empty) |
| Excerpt | `product_details.excerpt` | Rich text (or multi-line text) — service description |

### 4. App — type handle `app`
| Field name | Key | Type | Options |
|---|---|---|---|
| Name | `name` | Single line text | Required. Display name. |
| Icon | `icon` | File | Accepted file types: **Images only** |
| Description | `description` | Multi-line text | |
| App Store URL | `app_store_url` | URL | |

---

## B. New fields on existing definitions

### Client (existing) — add:
| Field name | Key | Type | Options |
|---|---|---|---|
| Services | `services` | Single line text | **List of values** |
| Featured site media | `featured_site_media` | File | Accepted file types: **Media files only** (image + video), single |

### Quote (existing) — add:
| Field name | Key | Type | Options |
|---|---|---|---|
| Partner since (years) | `partner_since` | Integer | e.g. `2009` |
| Logo | `logo` | File | Accepted file types: **Images only** |

---

## C. FAQ entries

Create one FAQ entry per row (Content → Metaobjects → FAQ → Add entry). The
**handle** is set automatically from the question; the values below just need to
match by meaning. "What results can I expect?" answer is **verbatim from Figma**;
the rest are from the live site and can be copy-edited.

| Question | Answer |
|---|---|
| What results can I expect? | *(two paragraphs — see below)* |
| What kinds of clients do you work with? | We primarily serve established eCommerce brands generating mid-eight to nine figures in annual revenue, with deep specialization in the health/supplements and home goods sectors. |
| What is a Shopify Plus Partner agency? | It's recognition from Shopify for agencies that work with major eCommerce brands. Shopify Plus Partners get exclusive access to additional resources, support, and early features beyond standard partner levels. |
| How long does migration & Shopify website development take? | Shopify migrations typically take 4-6 weeks depending on your store's complexity, catalog size, and integrations. |
| Do I need Shopify Plus for my business? | Shopify Plus is generally recommended for businesses exceeding $5M+ in annual revenue, or those that need native B2B features, advanced automation, or higher API limits. |
| How do I find the right Shopify web design agency for my brand? | Look for agencies with deep, Shopify-specific experience rather than generalists - a partner who understands the platform's nuances and has a track record with brands at your stage. |
| What are Growth & Support Teams? | Think of it as a super employee. A Growth & Support Team gives you additional bandwidth and expertise - design, development, CRO, and strategy - without the overhead of hiring in-house. |
| What's your response time? | Same-day responses for urgent issues, and a 24-48 hour turnaround for standard updates. |
| How does fractional teaming work? | You get dedicated design, development, and CRO specialists working as an extension of your team, without the cost of full-time hires. |
| How much does a custom website cost? | Pricing varies based on your business scale, revenue, and project scope. We tailor each engagement to your goals - reach out for a custom quote. |
| What's included in Growth packages? | Growth packages cover conversion rate optimization, migrations, custom application development, and general strategy guidance. |
| What CRO results can I expect? | Conversions typically increase 15-40% within 90 days, depending on your starting point and traffic quality. |

**"What results can I expect?" answer (verbatim, two paragraphs):**

> In order to scale as a brand, you need to be able to reliably scale your ad spend. What's the point of spending all that money to go to a site that doesn't convert like it should?

> So - in order to scale, you need a website that converts. Customer Trust and Customer Journey are the two pillars we focus on to produce results. Customer Trust is built on the small details that build credibility within seconds of landing on your site. Attention spans are smaller than ever, why read more? Then, once you have their attention - why should they buy right now? Here we combine CRO expertise and brand storytelling to build a journey that gives customers what they need to make a purchase. This is how you grow.

---

## D. FAQ Category entries

Create three categories, and in each one's **FAQs** field add the listed FAQ
entries **in this order**:

**Shopify Development & Migration**
1. What results can I expect?
2. What kinds of clients do you work with?
3. What is a Shopify Plus Partner agency?
4. How long does migration & Shopify website development take?
5. Do I need Shopify Plus for my business?
6. How do I find the right Shopify web design agency for my brand?

**Ongoing Support & Maintenance**
1. What are Growth & Support Teams?
2. What's your response time?
3. How does fractional teaming work?

**Pricing & Project Scope**
1. How much does a custom website cost?
2. What's included in Growth packages?
3. What CRO results can I expect?

---

## E. Services = Products

The Services section reads **products** (picked in the section settings), not a
metaobject. For each service product, put the description in the
`product_details.excerpt` metafield (title = product title, Learn More →
product page). Suggested copy for the `excerpt` metafield per product:

| Product | Excerpt (product_details.excerpt) |
|---|---|
| Shopify Website Design & Development | We design and develop Shopify websites engineered for growth. By focusing on customer trust and intuitive user journeys, we turn visitors into buyers. Our builds ensure your brand doesn't just blend in, but stands out with a unique, professional shopping experience. |
| Fractional Shopify Website Teams | Hire your super employee. Our Los Angeles-based team of Shopify specialists brings together design, development, CRO, and strategy under one roof. Reliable support, rapid fixes, and a dedicated partner for minor updates to major overhauls. |
| Shopify Applications | Powering hundreds of millions of dollars in annual revenue. From complex custom applications to public applications used by hundreds of stores - we've done it all. We know how to build applications that scale. |
| Shopify Conversion Rate Optimization (CRO) Agency | Our CRO process is all about data-driven testing, beautiful design, user psychology and fine-tuning every element between a click and a sale. We identify leaks, run structured experiments and turn browsers into buyers - consistently and effective. |

Pick and order the service products in the section's **Services (products)** setting.

## F. App entries

Create these `app` entries. `description` is multi-line text. Attach an image to
`icon` and add the `app_store_url` (the app's Shopify App Store listing).

| Name | Description | Icon | App Store URL |
|---|---|---|---|
| Bonde | Bonde is a Shopify super app with an AI strategist built in. Subscriptions, upsells, loyalty, bundles, order tracking pages, and merchandising rules all live in one place. | *(upload)* | *(add App Store URL)* |
| Wholesale GOAT | The fastest path from wholesale applicant to Shopify B2B customer. Customizable onboarding forms, with file upload, flow directly into the app. | *(upload)* | *(add App Store URL)* |
