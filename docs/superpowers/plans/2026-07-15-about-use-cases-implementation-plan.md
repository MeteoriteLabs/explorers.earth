# About and Use Cases Marketing Pages

Date: 2026-07-15  
Branch: `main`  
Mode: selective expansion, with the user-approved scope held as the baseline

## Outcome

Make the public marketing site feel like one coherent expression of explorers.earth: a philosophical About page that preserves the existing worldview, a practical but aspirational Use Cases page for Personal, Creators, and Brands, and navigation that makes both pages easy to find.

This release is complete when the pages present clear, review-approved answers to three questions without becoming pitchy. Whether real visitors understand those answers remains a separate product-learning question:

1. What does explorers.earth believe?
2. How can someone like me use it?
3. Where do I go next to create my page?

## Premise Challenge

The problem is not that the site lacks enough pages. The problem is that its strongest philosophical writing is only partially rendered, while the homepage's audience section is broad and card-heavy. Adding eight category pages would multiply content without clarifying the story. The direct move is to complete About, create one strong Use Cases hub, and connect both through navigation.

Doing nothing leaves two visible gaps: About feels unfinished and visually disconnected, and visitors have no focused place to understand how the product fits their life or work.

## Chosen Approach

### Approach A: Minimal patch

Add two header links, render the missing About sections, and create a text-only Use Cases route. Smallest diff, but it would not match the approved mockups or fix the homepage audience story.

### Approach B: Coherent marketing system (chosen)

Reuse the landing shell, tokens, patterns, motion behavior, header, footer, SEO helpers, and auth CTA. Rebuild About as a complete editorial sequence, add a full Use Cases page, and simplify the homepage audience preview to three linked perspectives. This is the best balance of completeness, reversibility, and code reuse.

### Approach C: Full marketing architecture

Create data-driven page templates for category pages, use cases, Explore, and Pricing. This has future platform value but expands beyond the decisions already made and would force premature content and pricing choices.

## What Already Exists

- `LandingHeader.tsx` already handles a fixed desktop/mobile shell, authentication-aware CTAs, language selection, and cross-page homepage anchors.
- `Footer.tsx` already centralizes public marketing and legal navigation.
- `About.tsx` already owns SEO metadata and the philosophical source material.
- `en.json` already contains two strong About sections that are not rendered: `about.section3` and `about.section4`.
- `WhoIsFor.tsx` already marks the homepage audience location and can become the three-perspective preview.
- `BackgroundPatterns.tsx`, landing CSS tokens, Framer Motion, and the landing image library provide the visual vocabulary required by the approved direction.
- `AuthRoutes.tsx` is the existing public route registry.
- i18next is configured with `fallbackLng: "en"`; the checker must explicitly permit the new English-only paths before runtime fallback can work for the other 46 locale files.

## Information Architecture

```text
Persistent header
  Product -> /#product
  How it works -> /#how-it-works
  Use Cases -> /use-cases
  About -> /about
  FAQ -> /#faq

Homepage
  Existing product story
  Three-perspective preview
    Personal -> /use-cases#personal
    Creators -> /use-cases#creators
    Brands -> /use-cases#brands

About
  Belief -> meaning -> what we are building -> belonging -> invitation

Use Cases
  Shared promise -> Personal -> Creators -> Brands -> shared rhythm -> CTA

Footer
  Product anchors + Use Cases + About + Contact + legal
```

Because `/` is guest-only today, navigation is authentication-aware: guests use the homepage anchors above; authenticated visitors selecting the logo or a homepage-section item go to `/home` rather than being bounced there indirectly by `GuestRoute`. About and Use Cases remain directly accessible in either auth state.

`Share` remains a homepage section and footer link, but is removed from the crowded primary header. Pricing, Explore, and category marketing pages do not enter the header yet.

## Page Specifications

### Header and Wayfinding

- Desktop order: Product, How it works, Use Cases, About, FAQ.
- Route items use React Router navigation; homepage section items preserve smooth scrolling and cross-page hash navigation.
- The logo returns guests to the homepage hero and authenticated visitors to `/home`.
- Mobile menu contains the same order and closes after any selection.
- Current route receives a subtle active treatment without turning the header into app navigation.
- All controls retain visible focus states and at least 44px touch height.
- Guest logo/homepage-section actions use `/` and `/#anchor`; authenticated equivalents go directly to `/home`. Route links for About and Use Cases behave identically for both states.

### About

- Keep the existing title, subtitle, section copy, and closing nearly verbatim.
- Render all four existing sections in a deliberate editorial rhythm.
- Hero: centered brand/worldview introduction on warm cream with a restrained world-path visual.
- Quiet hero wayfinding: `Read what we believe` links to `#what-we-believe`. It is an editorial scroll cue, not a conversion CTA.
- `WHAT WE BELIEVE`: quiet, centered, generous whitespace.
- `HOW WE SEE EXPLORATION`: deep evergreen full-width band for the strongest contrast beat.
- `WHAT WE'RE BUILDING`: philosophical copy plus a restrained product constellation using existing imagery; this is the page's 20% product connection, not a feature pitch.
- `BELONGING`: centered statement with a subtle warm accent, not a card grid.
- Closing: centered and composed as one invitation; remove the split left/right layout and unexplained external Philosophy CTA.
- Final CTA: `Join explorers` to registration, using existing auth behavior.

### Use Cases

- Hero: `Different perspectives. One place to share them.` The page should feel aspirational, not segmented like a sales deck.
- Hero wayfinding: a labeled `Choose a perspective` link group for Personal, Creators, and Brands. These are in-page navigation links, not persona conversion CTAs.
- Personal: `A home for the things that shape your world.` Show collecting across categories and sharing one evolving point of view.
- Creators: `Give your audience more than a feed.` Show a durable recommendation home beyond transient posts.
- Brands: `Turn your point of view into an experience people can enter.` Focus on curation, collections, guides, locations, products, and trust without enterprise jargon.
- Each section pairs one clear narrative with one product-use visual. Avoid three identical cards.
- Shared rhythm: Collect -> Shape -> Share, expressed once for all three perspectives.
- Final CTA reuses the registration action and keeps the free-page wording already used by the site.
- Hash anchors `#personal`, `#creators`, and `#brands` support direct links from the homepage.

Tone contract: the written specification overrides incidental mockup copy. There are no persona-specific conversion buttons and no monetization, growth-hack, funnel, campaign-performance, enterprise, or sales language. Brands are framed as thoughtful institutional curators. The page has one shared invitation at the end.

### Homepage Audience Preview

- Replace Personal / Creators / Hosts / Brands plus the 30-chip marquee with Personal / Creators / Brands.
- Give each perspective a short line and clear text link to its Use Cases anchor.
- Use an editorial three-part composition rather than a generic icon-card grid.
- Remove the endless audience marquee; it dilutes the hierarchy and adds motion without meaning.

## Visual Direction

- Preserve the approved warm cream, deep evergreen, terracotta, and muted-gold palette.
- Use existing landing display/body typography and CSS variables; do not introduce another font or dependency.
- Both pages use the existing `.landing-page` root wrapper so the scoped DM Sans/Fraunces typography and palette variables apply. Display headings use `.landing-display`; old inline `--evergreen` / `--warm-beige` styles are removed rather than mixed with the landing tokens.
- Alternate centered calm sections with intentional asymmetric editorial sections. Avoid centering everything.
- Cards exist only where they communicate an actual product surface; narrative copy should live directly in the composition.
- Reuse existing world/map and route motifs sparingly. No decorative blobs or ornamental icon circles.
- Use 2-3 motions per page: hero entrance, in-view section reveal, and restrained visual hover/parallax. Respect `prefers-reduced-motion` through `useReducedMotion` or motion-free fallbacks.

The written specification wins where a mockup contains extra detail. Mockup-only Careers, Press, Guides, Blog, Help Center, per-persona buttons, and the six-step journey are excluded. The canonical journey is Collect -> Shape -> Share.

### Visual Asset Map

| Block | Production source | Fallback / accessibility |
|---|---|---|
| About hero path/world | Existing `ExplorerMapBackground` or a lightweight CSS/SVG route motif | Decorative and `aria-hidden`; copy remains complete without it |
| About product constellation | Existing landing profile/product screenshots arranged with CSS, not a newly commissioned illustration | Stable aspect-ratio container; meaningful composite gets concise alt text |
| Use Cases hero | `/landing/Paris.jpg`, `/landing/profile-1.png`, and `/landing/storefront-1.png`, connected by the existing route motif | Three meaningful 1:1 cover apertures; alt: `Three perspectives connected through a place, an Explorer profile, and a storefront.` Connectors are `aria-hidden` |
| Use Cases Personal | Existing category imagery from `public/landing` plus a small product-surface composition | Copy remains primary if an image fails |
| Use Cases Creators | Existing profile screenshots and share/QR assets | No third-party or newly scraped imagery |
| Use Cases Brands | Existing storefront/product assets | No logos, implied customer endorsements, or licensing ambiguity |
| Shared rhythm | CSS/SVG line and typographic steps | Decorative connector hidden from assistive technology |

No new generated production image is required. Whitelisted hero assets are `/landing/Paris.jpg`, `/landing/profile-1.png`, and `/landing/storefront-1.png`; they are existing project production assets and must not be replaced with celebrity imagery or third-party logos. Each hero aperture is 1:1 with `object-fit: cover`: Paris center, profile center/top, storefront center. Mobile/tablet use three equal apertures; desktop uses larger connected/overlapping apertures matching the approved mockup, with connectors kept clear of text. Body compositions may reuse the existing project assets `/landing/Kyoto.jpg`, `/landing/profile-2.png`, `/landing/profile-3.png`, `/landing/storefront-2.png`, `/landing/storefront-3.png`, and `/landing/QR-code.png`. Body collages are decorative (`alt=""`) because adjacent copy carries their meaning. A product UI composite that exposes unique interface detail gets one concise wrapper description rather than alt text on each fragment.

## Approved Mockups

| Screen | Mockup | Direction | Constraints |
|---|---|---|---|
| About | `C:\Users\TK\.codex\generated_images\019f64e4-0b84-7e50-aa68-978e46955cf5\exec-3d6d37c2-2e9f-4323-b9f1-fd5fc281c459.png` | Editorial worldview page with evergreen contrast band and centered invitation | Preserve philosophical copy; product connection stays quiet |
| Use Cases | `C:\Users\TK\.codex\generated_images\019f64e4-0b84-7e50-aa68-978e46955cf5\exec-df105b2b-fcdd-4031-a154-7c798b6a88be.png` | Three aspirational perspectives connected by one shared rhythm | Personal, Creators, Brands terminology only; no B2B card grid |

## Responsive and Accessibility Contract

- Mobile (<640px): single-column compositions, full-width narrative bands, visuals below their copy, 24px horizontal gutters, no horizontal scroll, and no indispensable hover behavior. The Use Cases hero triptych becomes a compact three-up labeled row with fixed aspect ratios; body visuals remain single-column. The About constellation becomes one bounded composite below its copy with no floating overlap.
- Tablet (640-1199px): retain single-column reading order while allowing product visuals to widen; keep the same compact three-up hero and the disclosure header.
- Desktop (>=1200px): editorial two-column alternation where specified, max content width consistent with the landing page, and desktop nav visible. This breakpoint prevents five nav items plus language and auth actions from colliding.
- Heading order is one `h1` followed by ordered `h2`/`h3` levels.
- Use semantic `main`, `section`, `nav`, links, and buttons. Decorative SVGs/images are hidden from assistive technology; meaningful images receive specific alt text.
- Body copy is at least 16px, target contrast is WCAG AA, focus indicators remain visible, and touch targets are at least 44px.
- Hash targets use scroll margin so the fixed header does not obscure headings.
- RTL locales preserve reading order and do not rely on left/right-only meaning.
- The mobile disclosure exposes `aria-expanded` and `aria-controls`, closes on Escape and route change, restores focus to its trigger, and maintains a predictable keyboard order.
- The current marketing route uses `aria-current="page"` plus a non-color cue: a 2px terracotta underline. Visited editorial links on light surfaces use `--landing-green-2`; visited footer links use `--landing-sage`. Persistent nav actions and buttons use state-driven active styles instead of browser visited styling.

## Interaction State Coverage

| Feature | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| Static About / Use Cases content | Not applicable; bundled copy | English fallback copy | Existing route error boundary behavior | Complete page renders | Missing locale key falls back to English |
| Header route navigation | Not applicable | Not applicable | Unknown hash lands safely at page top | Correct route/anchor and menu closes | Hash target absent: page still loads without crash |
| Motion / imagery | Images reserve stable responsive space | Decorative visual can be absent without hiding copy | Broken image does not remove meaning | Visual reinforces narrative | Reduced-motion users see final static state |
| Registration CTA | Existing route transition | Not applicable | Existing registration route owns recovery | Guest reaches registration; authenticated user reaches home | Not applicable |

## User Journey and Emotional Arc

| Moment | Visitor should feel | Design support |
|---|---|---|
| First 5 seconds | This is a point of view, not another link-in-bio template | Large editorial language, world/path motif, restrained palette |
| First minute on About | I understand what these people value | Complete philosophical sequence with one contrast beat |
| First minute on Use Cases | I can see myself here without being sold to | Perspective-led sections and concrete journeys |
| Decision moment | I know the next step and it feels low pressure | One consistent claim-page CTA |
| Long-term impression | This could become a thoughtful shared culture of recommendations | Belonging language connects the product to the worldview |

## Architecture and Data Flow

```text
AuthRoutes
  +-- / ----------------> Landing
  |                        +-- WhoIsFor preview --link--> /use-cases#persona
  +-- /about -----------> About
  +-- /use-cases -------> UseCases

LandingHeader + Footer (shared shell)
  +-- homepage anchors --> existing sections
  +-- route links -------> React Router pages

English translation resource
  +-- existing About keys
  +-- new Use Cases + preview/nav/footer keys
        +-- locale key present ------> localized string
        +-- locale key missing ------> English fallback
```

No persistence, authentication, or product API behavior changes. The only backend change is adding static marketing URLs to the existing explorers sitemap provider.

### Shared Hash Navigation

Add one route-aware `useMarketingHashNavigation` helper and reuse it for header, footer, and homepage persona links. It observes `location.pathname` and `location.hash` after React Router renders the destination, safely decodes the id, waits one animation frame for the target, and calls `scrollIntoView`. Direct reload, SPA navigation, and browser back/forward share the same mechanism. Missing or malformed hashes fail safely at page top. Authenticated homepage-section actions bypass the helper and go directly to `/home`.

## Error and Rescue Registry

| Codepath | What can go wrong | Rescue | User sees |
|---|---|---|---|
| Header homepage-anchor navigation | Target id is absent | Navigate/load page without throwing; scroll only when element exists | Page top rather than a broken screen |
| Cross-route persona/home hash | Target is not mounted at navigation time | Shared post-render location/hash observer resolves after route render | Correct anchored section |
| Use Cases hash entry | Fixed header covers target | CSS `scroll-margin-top` on persona sections | Correct section heading remains visible |
| Translation lookup | Locale lacks new key | Existing i18next English fallback | English copy for that key |
| Decorative/product image | Asset fails to load | Narrative remains complete without image | Copy and CTA still usable |
| Motion preference | User requests reduced motion | Disable transforms/loops and render final state | Static, complete composition |

## Failure Modes Registry

| Codepath | Failure mode | Rescued? | Test? | User sees? | Logged? |
|---|---|---:|---:|---|---:|
| Desktop header | Route link treated as homepage hash | Yes, explicit route/anchor model | Yes | Correct destination | N/A |
| Authenticated marketing nav | Guest-only `/` redirects unexpectedly | Yes, send authenticated homepage actions directly to `/home` | Yes | Dashboard opens intentionally | N/A |
| Mobile header | Menu remains open after navigation | Yes | Yes | Menu closes | N/A |
| Homepage preview | Old four-card translation shape indexed incorrectly | Yes, replace with named objects/new keys | Yes | Three correct perspectives | N/A |
| Use Cases anchors | Anchor hidden behind fixed header | Yes | Yes, Playwright + responsive QA | Visible heading | N/A |
| Non-English locale | Missing copy renders raw key | i18next fallback plus test | Yes | English fallback, never raw key | N/A |
| Reduced motion | Infinite animation continues | Explicit reduced-motion branch | Yes/manual | Static visual | N/A |
| Image asset | Layout shifts or copy becomes meaningless | Stable aspect ratio; visual is supplemental | Manual | Complete story remains | N/A |

There are no silent backend failures or operational alerts to add because the change introduces no network, mutation, or service codepath.

## Testing Plan

```text
ROUTING
  /about ------------------ [unit/integration] complete headings + CTA
  /use-cases -------------- [unit/integration] three personas + CTA
  /use-cases#creators ----- [Playwright] visible anchored section
  authenticated nav ------- [unit] homepage actions resolve directly to /home

SHARED NAVIGATION
  desktop route links ----- [unit] correct href/navigation intent
  homepage anchors -------- [unit] scroll when target exists
  cross-page anchors ------ [unit] navigate to /#target
  mobile selection -------- [unit] closes menu

CONTENT
  About ------------------- [unit] renders all four existing sections
  homepage preview -------- [unit] three perspectives, no Hosts/marquee
  locale fallback --------- [unit or i18n check] no raw new keys
  SEO/GEO ----------------- [unit] visible story and machine-readable identity agree

QUALITY GATES
  landing:check ----------- translations + hardcoded-copy policy
  generated sitemap ------- /use-cases canonical URL is present after build script
  targeted Vitest -------- component/route regressions
  tsc/build --------------- type and bundle validation
  responsive browser QA --- 375, 768, 1440 widths + reduced motion
```

Tests should follow existing Vitest + Testing Library conventions. Add focused tests for route registration, the shared hash helper, header destination branches/menu closure, complete About content, the three-perspective preview/Use Cases content, and SEO identity. Add `e2e/marketing-pages.spec.ts` for SPA and direct hash entry, back/forward, missing hash, guest and authenticated navigation, mobile Escape/focus return/route-close behavior, CTA routing, `aria-current`, reduced motion, and horizontal overflow at 375, 768, and 1440px. Fixed-header visibility and focus behavior are automated browser requirements, not manual-only checks.

Update `scripts/check-landing-i18n.mjs` as part of the change: remove the obsolete four-card/30-chip shape contract and add an `englishFallbackAllowedPaths` contract. Paths in that set are required and shape-checked in `en.json`, but may be absent from non-English files and may equal English if present. Keep protected-token checks for every locale. Add fixture/script coverage for English, one partial locale, and one RTL partial locale. The repository currently has 47 language files total: English plus 46 fallbacks.

## Implementation Tasks

- [ ] Refactor `LandingHeader` navigation items to distinguish routes from homepage anchors; add Use Cases and About, remove Share from the primary header, preserve desktop/mobile parity.
- [ ] Complete header accessibility: 1200px desktop breakpoint, `aria-current`, disclosure semantics, Escape close, focus return, route-change close, and non-color active treatment.
- [ ] Rebuild `About.tsx` to render all four existing philosophical sections, centralized closing, quiet product visual, and registration CTA using the approved visual direction.
- [ ] Add `UseCases.tsx` with Personal, Creators, Brands, the shared Collect/Shape/Share rhythm, SEO metadata, responsive anchors, and final CTA.
- [ ] Register `/use-cases` in `AuthRoutes.tsx` as a route available regardless of auth state.
- [ ] Replace `WhoIsFor.tsx` with the three-perspective linked homepage preview and remove the audience marquee.
- [ ] Add Use Cases to `Footer.tsx` while keeping Share available in footer navigation.
- [ ] Add English translation keys for Use Cases, revised homepage preview, and shared navigation/footer labels; rely on the configured English fallback until editorial translations are supplied.
- [ ] Add and reuse `useMarketingHashNavigation` for post-render SPA/direct/back-forward anchor scrolling with safe missing/malformed-hash behavior.
- [ ] Update `check-landing-i18n.mjs` with `englishFallbackAllowedPaths`, the new three-perspective shape, and English/partial/RTL fixtures.
- [ ] Add About and Use Cases to both sitemap providers: `scripts/generate-static-files.js` as the static fallback and `tunes/server/seo-routes.ts` as the Nginx-proxied production authority; add a tunes sitemap test and verify public `/sitemap.xml` after deploy.
- [ ] Fix shared `SEO.tsx` URL resolution to `url || canonical || defaultSEO.url`; assert canonical, `og:url`, JSON-LD URL, title, description, image, and locale for About and Use Cases.
- [ ] Rewrite About's hardcoded GEO description so machine-readable identity matches the philosophical visible page instead of narrowing the product to local experts, QR codes, and places.
- [ ] Expand `check-landing-hardcoded-copy.mjs` to scan `About.tsx` and `UseCases.tsx` and reject the new visible English strings when written outside i18n.
- [ ] Add focused Vitest and `e2e/marketing-pages.spec.ts` coverage; run landing checks, unit tests, Playwright, typecheck/build, then responsive visual QA.

## Deployment and Rollback

No migration or feature flag is needed. Production deploys through the main-branch GitHub Actions workflow: CI succeeds, the explorers workflow builds, uploads `dist` over SSH, and reloads Nginx. Post-deploy smoke checks fetch the public `/`, `/about`, `/use-cases`, each persona hash, guest and authenticated header behavior, public `/sitemap.xml`, mobile navigation, registration CTA, and one non-English locale. Existing route-level analytics can show reach, but not comprehension.

Rollback is revert-and-redeploy, not an instant local revert: create and push a revert commit, wait for CI, wait for the SSH upload/Nginx reload, then repeat the public smoke checks. There is no atomic artifact switch in the current workflow, so the plan states that slower recovery honestly rather than expanding this marketing release into deployment-infrastructure work.

## Performance Budget

- Use Cases initial hero raster transfer target: <=450KB total (current three whitelisted files are about 351KB).
- Total raster transfer per new page: <=1.2MB. Do not use the existing ~0.9-1.0MB `profile-2.png` / `profile-3.png` files without producing optimized WebP/AVIF derivatives.
- Eager-load only the likely LCP hero asset; below-fold images use `loading="lazy"` and `decoding="async"` with explicit width/height or aspect ratio.
- Reuse CSS/SVG product compositions where possible. If any selected raster exceeds 250KB, optimize it before inclusion.
- Validate the built page with browser network totals and ensure no horizontal overflow at the three required viewports.

## Dream State Delta

```text
CURRENT
Strong product homepage + incomplete philosophy + broad audience cards
   -> THIS RELEASE
Coherent About + one use-case hub + connected navigation
   -> 12-MONTH IDEAL
Marketing system with editorial localization, Explore/global map, honest pricing,
and category stories added only when each has a distinct audience and purpose
```

## NOT in Scope

- Eight category marketing pages: the interactive category section already proves breadth; separate pages need distinct demand and content first.
- Explore/global recommendations map: compelling future public surface, but it introduces product/data scope beyond this narrative release.
- Pricing page and quota-copy reconciliation: strategically important, but requires a product/pricing decision rather than a visual placeholder.
- Collaboration page or collaboration workflows: future direction is acknowledged without advertising an unfinished capability.
- New design system or font dependency: reuse the landing system so the pages feel native.
- Machine-translating 46 non-English locale files: use an explicit, tested English-fallback checker contract now and do editorial translation as a dedicated localization pass.
- Atomic/versioned production deploy directories: valuable infrastructure hardening, but outside this static marketing feature; rollback uses the existing revert-and-redeploy path.
- New conversion analytics or interview program: existing route views are sufficient for this build; narrative comprehension research is a separate product-learning activity.
- Mockup-only footer destinations, per-persona CTAs, and six-step journey: they were visual scaffolding, not approved product scope.

## Review Scorecard

| Review | Initial | Reviewed | Result |
|---|---:|---:|---|
| CEO / product coherence | 6/10 | 9/10 | Scope focuses on belief, identification, and action; speculative pages deferred |
| Information architecture | 6/10 | 9/10 | Header, page hierarchy, anchors, and footer destinations specified |
| Interaction states | 5/10 | 9/10 | Static, fallback, hash, asset, and reduced-motion behavior named |
| Emotional journey | 7/10 | 9/10 | Philosophy remains primary while product connection stays quiet |
| AI-slop resistance | 6/10 | 9/10 | No generic persona cards, icon grid, decorative blobs, or uniform centered rhythm |
| Design-system alignment | 7/10 | 9/10 | Existing tokens, typography, patterns, motion, and shell reused |
| Responsive/accessibility | 5/10 | 9/10 | Viewport behavior, semantics, contrast, focus, touch, anchors, and RTL specified |
| Engineering readiness | 6/10 | 9/10 | Hash runtime, checker fallback, both sitemap providers, SEO identity, E2E, performance, deploy, and rollback specified |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| CEO Review | `/plan-ceo-review` via `/autoplan` | Scope and strategy | 1 | CLEAR | One coherent hub chosen; Explore, Pricing, collaboration, and category pages deferred |
| Codex Review | `/codex review` | Independent second opinion | 1 | ISSUES FIXED | Auth navigation, tone/mockup boundary, assets, sitemap/GEO, and i18n contract tightened |
| Eng Review | `/plan-eng-review` via `/autoplan` | Architecture and tests | 1 | ISSUES FIXED | Initial 6.2/10; hash runtime, i18n gate, sitemap authority, E2E, SEO, performance, and deploy corrections incorporated |
| Design Review | `/plan-design-review` via `/autoplan` | UI/UX gaps | 2 | CLEAR | 5.7/10 initial to 8.6/10 reviewed; two user-approved mockups |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | SKIPPED | No developer-facing product surface in scope |

- **UNRESOLVED:** 0 product decisions; implementation details are bounded by the approved mockups and this plan.
- **VERDICT:** CEO + DESIGN + ENG CLEARED. Independent adversarial review required before implementation.
