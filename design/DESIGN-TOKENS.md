# Verdé — Eco Design Token System

> Carbon-footprint awareness web app · Next.js 15 (App Router) + Tailwind CSS + TypeScript
> Status: **v2.0 — soft-premium foundation (Phase A)** · Owner: Design Systems · Last updated: 2026-06-20
>
> v2 lifts Verdé from "accessible-but-generic" to a **soft-premium / agency** aesthetic
> **without regressing accessibility or the 180 KB bundle budget.** It keeps every verified
> v1 role token as the accessible **floor** and enriches it: a distinctive display typeface,
> **layered surfaces**, **tinted soft shadows**, a **Double-Bezel** card material, brand
> presence, **cubic-bezier motion tokens**, refined dark mode, and a non-leaf **brand mark**.
>
> **All text/UI pairings below carry a measured WCAG 2.x contrast ratio** (computed from the hex
> values with the standard sRGB relative-luminance formula) and are confirmed AA: body ≥ 4.5:1,
> large/UI ≥ 3:1. Translucent fills are flattened over their surface before measuring.

---

## 0. Direction (the v2 brief in one screen)

- **Vibe archetype: Soft Structuralism.** Silver-grey / near-white canvas, **massive bold
  grotesque** display type, airy floating components with **unbelievably soft, highly diffused
  ambient shadows** — not glass, not editorial-cream. The right register for a calm data product.
- **Layout archetype: Asymmetrical Bento.** Later phases arrange the dashboard as a masonry grid
  of varying tile sizes (hero footprint spanning wide, breakdown + trend stacked) that collapses
  to a single column below `768px`. (Phase A only ships the foundation — **no screens are
  redesigned yet.**)
- **Restraint is the brand.** Color carries meaning only (category, status, delta); green stays
  ≤ 15% of any surface. Numbers are the hero. v2 adds *material and motion* quality, not visual
  noise.
- **Banned-default guard:** no Inter/Roboto, no harsh black drop-shadows, no `linear`/`ease-in-out`
  state changes, no over-rounded 32px+ cards, no gradient text, no ghost-card (1px border + ≥16px
  blur on the same element). Accessibility (contrast, visible focus, reduced-motion, ≥24px targets,
  semantic z-index) is honored as a hard floor.

---

## 1. How to read this document

- **Measured contrast** is `X.XX:1 ✓AA` (body, ≥ 4.5) or `X.XX:1 ✓AA-large` (large/UI, ≥ 3.0),
  computed from the hex in this file. Change a hex → re-measure.
- **"Large text"** per WCAG = ≥ 24px regular **or** ≥ 18.66px bold.
- Tokens are named by **role**, never raw value. Build against `--surface-raised`, `--text`,
  `--brand-fg` — never against ramp steps in components.
- Two themes — **light (default)** and **dark** — switch via `[data-theme]` on `<html>` (written by
  `next-themes`); every role token is redefined per theme so component code is theme-agnostic.

---

## 2. Typography

### 2.1 Faces — paired on a contrast axis

One change from v1: a **display face** is introduced for structural/hero headings, paired with
Geist Sans on a true contrast axis (geometric grotesque × humanist sans — _not_ two similar
sans). Body and figures are unchanged, so the verified reading experience is preserved.

| Role | Family | Loaded via | Weights | Used for |
|---|---|---|---|---|
| **Display** | **Space Grotesk** | `next/font/google` | 500 / 600 / **700** | hero footprint number, H1–H2, eyebrow/overline |
| **Body / UI** | **Geist Sans** | `next/font/google` | 400 / 500 / 600 | paragraphs, labels, H3–H4, controls |
| **Numeric** | **Geist Mono** | `next/font/google` | 500 | all carbon figures, table numerals (tabular `tnum`) |

**Why Space Grotesk:** a distinctive wide grotesque with real character at large sizes — the
"massive bold Grotesk typography" Soft Structuralism calls for — while staying off the banned
list and self-host-free (Google Fonts via `next/font`, subset to latin, only the 3 weights we
use, so the payload stays small). Geist Sans + Geist Mono are retained verbatim.

```ts
// src/app/fonts.ts
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
export const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
export const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
export const display = Space_Grotesk({
  subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap",
});
```

**Stacks (CSS):**
```css
--font-sans: var(--font-geist-sans), "Geist", ui-sans-serif, system-ui, -apple-system,
             "Segoe UI", Helvetica, "Helvetica Neue", Arial, sans-serif;
--font-mono: var(--font-geist-mono), "Geist Mono", ui-monospace, "SF Mono",
             "JetBrains Mono", "Cascadia Code", monospace;
--font-display: var(--font-display), "Space Grotesk", var(--font-geist-sans),
             ui-sans-serif, system-ui, sans-serif;
```
> Numeric contexts enable `font-feature-settings: "tnum" 1;` for tabular figures (`.numeric`).
> Apply the display face with the `font-display` Tailwind utility or the `.font-display` class.

### 2.2 Modular type scale

Base **16px** body (never smaller); modular ratio **1.20 → 1.25** opening up at display sizes.
Hero display is **fluid `clamp()`**, max ≤ 6rem (hard ceiling); tracking floor **−0.02em** (never
tighter than −0.04em). Body measure is capped **65–75ch** (we use `max-w-[68ch]`).

| Role | Token | Size (rem / px) | Line-height | Weight | Tracking | Face | Notes |
|---|---|---|---|---|---|---|---|
| Display (hero number) | `text-display` | `clamp(2.75rem, 6vw, 4.5rem)` / 44–72 | 1.04 | **700** | −0.02em | mono (figure) / display (label) | the footprint kg CO₂e; one per screen |
| H1 | `text-h1` | `2.25rem` / 36 | 1.15 | 600 | −0.015em | **display** | page title; `text-wrap: balance` |
| H2 | `text-h2` | `1.75rem` / 28 | 1.2 | 600 | −0.01em | **display** | section; `text-wrap: balance` |
| H3 | `text-h3` | `1.375rem` / 22 | 1.25 | 600 | −0.005em | sans | card title |
| H4 | `text-h4` | `1.125rem` / 18 | 1.3 | 600 | 0 | sans | sub-section / label-strong |
| Body-lg | `text-body-lg` | `1.125rem` / 18 | 1.6 | 400 | 0 | sans | lead paragraph |
| Body | `text-body` | `1rem` / 16 | 1.6 | 400 | 0 | sans | default; **max-width 68ch** |
| Body-sm | `text-body-sm` | `0.875rem` / 14 | 1.55 | 400 | 0 | sans | dense UI, helper text |
| Caption | `text-caption` | `0.8125rem` / 13 | 1.45 | 500 | 0.01em | sans | meta, timestamps, axis labels |
| Overline | `text-overline` | `0.6875rem` / 11 | 1.4 | 600 | 0.08em | display | micro-label (use sparingly) |
| Mono / numeric | `text-num` | inherits | 1.4 | 500 | 0 | mono | table & metric figures, `tnum` |

> v1→v2 deltas: display weight 600 → **700** and line-height 1.05 → 1.04 (more presence);
> H1/H2/overline now render in the **display** face. Everything else is unchanged.

---

## 3. Color — enriched, layered, AA-verified

Hue strategy unchanged: a **calm cool green** brand anchored against a **green-tinted slate**
neutral ramp (chroma nudged ~0.01 toward the brand hue — _not_ warm-by-default, _not_
cream/sand). v2 adds **layered surfaces** with subtle tints, a **brand-subtle wash** + **brand
text** token, and refined dark surfaces — every new pairing measured below.

### 3.1 Layered surfaces — light theme

Four depth planes (canvas → sunken → surface → raised) give the Asymmetrical Bento its
floating-tile feel without harsh borders. Tints are tiny (≤ 1% off white) so the whole stays
"near-white", not muddy.

| Token | Hex | Plane | Role |
|---|---|---|---|
| `--bg` | `#FBFCFB` | base | app canvas |
| `--surface-sunken` | `#F1F5F2` | −1 (recessed) | wells, table stripes, input backdrops |
| `--surface` | `#FFFFFF` | 0 | resting cards, panels |
| `--surface-raised` | `#FFFFFF` | +1 | floating bento tile / popover (lifted by `--shadow-float`, not by color) |
| `--surface-brand-subtle` | `#EAF6EF` | tint | eyebrow chips, brand washes (green ≤ 15% of surface) |

**Text legibility on every plane (measured):**

| Text token | Hex | on `--bg` | on `--surface-sunken` | on `--surface` / `--surface-raised` |
|---|---|---|---|---|
| `--text` | `#1C2A24` | **14.52:1 ✓AA** | **13.57:1 ✓AA** | **14.94:1 ✓AA** |
| `--text-secondary` | `#4A5A52` | **7.10:1 ✓AA** | **6.64:1 ✓AA** | **7.30:1 ✓AA** |
| `--text-muted` | `#5C6B63` | **5.46:1 ✓AA** | **5.10:1 ✓AA** | **5.62:1 ✓AA** |

> The deeper sunken (`#F1F5F2` vs v1 `#F4F7F5`) still clears AA for muted text at **5.10:1** —
> the lowest light-theme pairing, comfortably over 4.5.

### 3.2 Layered surfaces — dark theme

Refined four-plane dark: a true tinted near-black base, a card surface, a **lifted raised**
plane, and a deepest **overlay** for popovers/menus.

| Token | Hex | Plane | Role |
|---|---|---|---|
| `--bg` | `#0E1512` | base | app canvas |
| `--surface-sunken` | `#0A0F0C` | −1 | wells |
| `--surface` | `#16201B` | 0 | resting cards |
| `--surface-raised` | `#1B261F` | +1 | lifted bento tile |
| `--surface-hover` | `#1C2820` | hover | row/button hover |
| `--surface-brand-subtle` | `rgba(21,48,34,0.13)` | tint | brand wash over surface |

**Text legibility on every dark plane (measured):**

| Text token | Hex | on `--bg` | on `--surface` | on `--surface-raised` | on `#20302A` (deepest overlay) |
|---|---|---|---|---|---|
| `--text` | `#E6EDE9` | **15.56:1 ✓AA** | **14.05:1 ✓AA** | **13.14:1 ✓AA** | **11.63:1 ✓AA** |
| `--text-secondary` | `#AEBDB5` | **9.47:1 ✓AA** | **8.55:1 ✓AA** | **8.00:1 ✓AA** | **7.08:1 ✓AA** |
| `--text-muted` | `#8B9A92` | **6.29:1 ✓AA** | **5.68:1 ✓AA** | **5.31:1 ✓AA** | **4.70:1 ✓AA** |

> Even on the deepest dark overlay, muted text holds **4.70:1 ✓AA**.

### 3.3 Brand presence

| Token | Light | Dark | Role | Contrast on its wash |
|---|---|---|---|---|
| `--brand` | `#1E7A4D` | `#4FC284` | primary fill / accent | white on light **5.32:1 ✓AA**; ink on dark **8.27:1 ✓AA** |
| `--brand-hover` | `#1E8553` | `#7DD6A4` | hover | (per §6 button rules) |
| `--brand-active` | `#15643F` | `#B4E0C6` | active / hero number | white on light-active **7.18:1 ✓AA** |
| `--brand-accent` | `#239A5F` | `#4FC284` | brand-mark seed (decorative) | — |
| **`--brand-fg`** _(new)_ | `#13593C` | `#7DD6A4` | **brand text on `--surface-brand-subtle`** | light **7.51:1 ✓AA**; dark **7.36:1 ✓AA** |

> `--brand-fg` is the safe text color for eyebrow chips / brand washes — green text on the pale
> brand-subtle surface, both themes AA-measured. (White body text on `green-500`/`green-600`
> remains banned: 3.58:1 / 4.21:1-large.)
>
> **Margin hardening (a11y, light theme):** the on-tint text tokens were deepened one step so they
> clear AA with comfortable margin on **every** tint they actually render over (not only the
> canonical wash). `--brand-fg` / `--success-fg` `#15643F → #13593C` (6.47 → **7.51:1** on
> `--surface-brand-subtle`; 6.34 → **7.36:1** on `--success-bg`); `--info-fg` `#1C5A8A → #1A567F`
> (6.30 → **6.77:1** on `--info-bg`). Only the text deepens — the airy tint surfaces are unchanged.

### 3.4 Role tokens, semantic status, and data-viz palette — unchanged from v1

The v1 role tables (§2.3/§2.4), semantic status pairs (§2.5), carbon directionality, and the
six-series colorblind-safe data-viz palette (§2.6) are **carried verbatim** — they were already
AA-verified and remain the floor. Summary of the load-bearing pairings still in force:

| Pairing | Light | Dark |
|---|---|---|
| `--text` on `--surface` | 14.94:1 ✓AA | 14.05:1 ✓AA |
| `--text-muted` / placeholder on `--surface` | 5.62:1 ✓AA | 5.68:1 ✓AA |
| `--text-on-brand` on `--brand` | 5.32:1 ✓AA | 8.27:1 ✓AA |
| `--ring` on `--surface`/`--bg` | 5.32 / 5.17:1 ✓AA | 7.47:1 ✓AA |
| `--border-interactive` on `--surface` | 3.58:1 ✓AA-large | 3.41:1 ✓AA-large |
| Success / Warning / Danger / Info tint pairs | 7.36 / 5.28 / 6.47 / 6.77:1 ✓AA | 9.45 / 8.92 / 7.14 / 7.59:1 ✓AA |
| Data-viz series 1–6 on white | all ≥ 4.73:1 ✓AA | shifted +2 steps, all ≥ 4.5:1 on `#16201B` |

Carbon directionality is unchanged: **reduction = success + down-arrow icon + signed `−%`**,
**increase = danger + up-arrow icon + signed `+%`**. Color is never the sole channel. In v2 the
▼/▲ glyphs are replaced by the `ArrowDown` / `ArrowUp` inline icons (§7) — same meaning, crisper
mark.

---

## 4. Materials — the Double-Bezel card

v2's signature material. A premium card never sits flatly on the background; it reads like a
glass plate in a machined tray — an **outer shell** holding an **inner core** with concentric
curves. This replaces generic "border + shadow" cards in later phases (Phase A only defines the
tokens + spec).

**Outer shell**
- background `--bezel-shell` (light `rgba(28,42,36,0.05)` / dark `rgba(255,255,255,0.04)`)
- hairline ring `--bezel-ring` (light `rgba(28,42,36,0.06)` / dark `rgba(255,255,255,0.08)`)
- padding `6px` (the bezel gap) · radius `--radius-2xl` = **24px**

**Inner core**
- background `--surface` (or `--surface-raised` when floating)
- inner top highlight `--shadow-bezel-inner` = `inset 0 1px 0 rgba(255,255,255, .9/.06)`
- radius `--radius-bezel-inner` = **18px** = `24px − 6px` padding → **mathematically concentric**

```html
<!-- reference markup (later phases) -->
<div class="rounded-2xl bg-[--bezel-shell] p-1.5 ring-1 ring-[--bezel-ring] shadow-float">
  <div class="rounded-bezel-inner bg-surface shadow-bezel-inner p-6">…content…</div>
</div>
```

> Guard: the inner core uses **either** a soft shadow **or** a border to separate from the shell
> — never a 1px border + ≥16px blur on the same element (ghost-card). The 24px shell is the
> ceiling; content cards still top out at 12–16px when used without the bezel.

### 4.1 Radius scale

| Token | px | Use |
|---|---|---|
| `--radius-xs` | 4 | inputs, kbd |
| `--radius-sm` | 6 | buttons |
| `--radius-md` | 8 | inner card elements, chart container |
| `--radius-lg` | 12 | cards (default), theme toggle |
| `--radius-xl` | 16 | feature/hero card |
| `--radius-bezel-inner` | 18 | double-bezel inner core (concentric) |
| `--radius-2xl` | 24 | double-bezel outer shell (ceiling) |
| `radius-pill` (`9999`) | — | badges, chips, ring caps only — never large containers |

### 4.2 Tinted soft shadows

Ultra-diffuse, low-opacity, **tinted to the neutral hue** (never pure-black harsh). Light
opacities ≤ 0.08. v2 adds a **layered float** (two stacked tinted shadows) for bento tiles and a
**bezel inner-highlight**.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(16,33,27,.04)` | `0 1px 2px rgba(0,0,0,.30)` | resting card (with border) |
| `--shadow-sm` | `0 2px 8px rgba(16,33,27,.05)` | `0 2px 8px rgba(0,0,0,.40)` | card hover lift |
| `--shadow-md` | `0 6px 16px rgba(16,33,27,.06)` | `0 6px 18px rgba(0,0,0,.48)` | popover, dropdown |
| `--shadow-lg` | `0 16px 40px rgba(16,33,27,.08)` | `0 16px 44px rgba(0,0,0,.55)` | modal, command palette |
| **`--shadow-float`** _(new)_ | `0 1px 2px rgba(16,33,27,.04), 0 12px 32px rgba(16,33,27,.07)` | `0 1px 2px rgba(0,0,0,.40), 0 12px 32px rgba(0,0,0,.50)` | floating bento tile (the soft "Structuralism" ambient lift) |
| **`--shadow-bezel-inner`** _(new)_ | `inset 0 1px 0 rgba(255,255,255,.9)` | `inset 0 1px 0 rgba(255,255,255,.06)` | inner-core top edge light |

---

## 5. Macro-whitespace & layout

Spacing scale (4px base) and breakpoints are unchanged from v1; v2 **leans into macro-whitespace**
— sections breathe at `py-20`→`py-24` desktop, tiles get generous internal padding. Container
widths (`container-app 1200px`, `container-wide 1360px`, `container-prose 68ch`) and the 12-col
Asymmetrical-Bento grid (hero `lg:col-span-7`, breakdown `lg:col-span-5`, trend `col-span-12`,
single-column below `768px`) carry over. Full-height shells use `min-h-[100dvh]`.

| Token | px | Typical use |
|---|---|---|
| `space-4` | 16 | base unit; card inner gap |
| `space-6` | 24 | card padding (default) |
| `space-8` | 32 | card padding (spacious) |
| `space-10` | 40 | between cards |
| `space-12` | 48 | sub-section gap |
| `space-16` | 64 | section gap (mobile) |
| `space-20` | 80 | section gap (desktop) |
| `space-24` | 96 | hero / page top padding |

---

## 6. Motion — cubic-bezier tokens

Easing is exponential **ease-out** (decelerate, settle) — no bounce, no elastic, no `linear` for
state changes. Animate **only `transform`, `opacity`, `box-shadow`, `filter` (blur)** — never
layout properties. v2 adds a premium **soft settle** curve (from the soft-skill) and a **slower**
duration for hero entrances; the Framer Motion layer (`MotionProvider`) is wired for later phases.

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | `80ms` | toggles, checkbox |
| `--duration-fast` | `160ms` | hover, focus ring, button press |
| `--duration-base` | `240ms` | dropdown/popover, card lift |
| `--duration-slow` | `320ms` | modal/drawer, route content fade |
| **`--duration-slower`** _(new)_ | `480ms` | hero entrance / number count-up only |
| `--ease-out-quart` | `cubic-bezier(0.25, 1, 0.5, 1)` | **default UI ease** |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | entrances, drawers |
| **`--ease-out-soft`** _(new)_ | `cubic-bezier(0.32, 0.72, 0, 1)` | premium settle (soft-skill signature) |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | symmetric (rare) |

**Patterns** (carry over): entrance `opacity 0→1` + `translateY(8px)→0` over `base`/`out-expo`,
list stagger `calc(var(--index) * 60ms)`, hero number roll over `slower`, chart `stroke-dashoffset`
draw. Content is **visible by default**; reveals enhance, never gate visibility.

**`prefers-reduced-motion: reduce` (mandatory, shipped in `globals.css`):**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  /* Force motion-driven reveals (the only inline `style="opacity:…"` in the app)
     to their final, fully-opaque state. */
  [style*="opacity"] { opacity: 1 !important; }
}
```
At the JS layer, `MotionProvider` sets `MotionConfig reducedMotion="user"` AND collapses every
transition to `{ duration: 0 }` when reduced motion is requested, so reveals resolve to their
steady state with no animation. Tailwind `motion-safe:` still gates any `translate`/`scale`/draw at
the utility level.

> **Why the `[style*="opacity"]` guard (a11y, WCAG 1.4.3).** Framer Motion treats an `opacity`
> crossfade as motion-safe and **keeps it even under reduced motion** — so an entrance reveal that
> mounts at `opacity: 0` and fades to `1` can paint while still semi-transparent. Content rendered
> through a faded container drops below its measured AA contrast for that frame (and an automated
> contrast snapshot catches exactly that). Our decorative dimming all uses Tailwind `opacity-*`
> utility **classes** or SVG `opacity` **attributes** — never inline `style` — so the inline-style
> selector scopes precisely to Framer's reveal containers and forces them visible. This upholds the
> rule "**content is visible by default; reveals enhance, never gate visibility**."

### 6.1 Semantic z-index — unchanged

`dropdown 1000 · sticky 1100 · backdrop 1200 · modal 1300 · toast 1400 · tooltip 1500`. Never
arbitrary `999`/`9999`.

---

## 7. Identity — brand mark & icon set

### 7.1 Brand mark — "Concentric Ripple / Strata"

The eco motif is **not a leaf** (the saturated eco cliché). `BrandMark` reads two ways at once:

- a **ripple** radiating from a centre seed dot — one small action sending rings outward (the
  product's thesis: small changes propagate), and
- **strata / contour lines** — earth and topographic layers, plus a horizon baseline so the lower
  half reads as a calm measuring dial / instrument, not a logo shouting "green".

Three concentric down-opening arcs (decreasing opacity outward) over a horizon line, with the
**`--brand-accent` seed dot** at centre carrying brand color while the rings inherit
`currentColor` (theme-adaptive). Accessibility: `aria-hidden` when paired with the visible "Verdé"
wordmark (text is the name); pass a `title` only when it stands alone (favicon-style) → gains
`role="img"` + `<title>`.

### 7.2 Icon set

A small, consistent **inline-SVG** set (stroke **1.5**, round caps/joins, 24×24 grid,
`currentColor`) that replaces the v1 emoji / Unicode glyphs (`▲ ▼ ↗ ☰ ⚙ ✓`) in later phases —
no icon-font dependency, no banned thick Lucide/Material look. Each icon defaults to
`aria-hidden="true"` + `focusable={false}`; pass a `title` to make it meaningful (then also give
the control an `aria-label`). Set: `ArrowDown ArrowUp ArrowUpRight ChevronRight ChevronDown
CheckCircle AlertTriangle AlertCircle InfoCircle Close Gauge PlusLog ChartLine Target Settings
Menu Sun Moon Monitor Ripple`.

### 7.3 Theme toggle

`ThemeToggle` cycles **light → dark → system** (not the banned sun/moon _switch_; system/auto is a
first-class state). SSR-safe (mounted guard → stable placeholder, no hydration mismatch), keyboard
operable, ≥44px target, focus-visible ring, `aria-label` naming current state + next action.
Placed in the shell header in **Phase B**; exposed now.

---

## 8. Implementation map (Phase A)

| File | Change |
|---|---|
| `design/DESIGN-TOKENS.md` | this v2 spec |
| `src/app/fonts.ts` | + Space Grotesk display face (`--font-display`) |
| `src/app/globals.css` | full v2 CSS custom properties: layered surfaces, brand-subtle/brand-fg, tinted `--shadow-float` + bezel inner, bezel material vars, radius vars, motion durations + 4 easings, display font stack, reduced-motion block |
| `tailwind.config.ts` | theme-extend mapping: `surface.raised`/`surface.brand-subtle`, `brand.fg`, `fontFamily.display`, display weight 700, `rounded-2xl`/`rounded-bezel-inner`, `shadow-float`/`shadow-bezel-inner`, `duration-slower`, `ease-out-soft`/`standard`, `fade-in` keyframe |
| `src/app/_components/ThemeProvider.tsx` | `next-themes` (attribute `data-theme`, defaultTheme system, persisted) |
| `src/app/_components/ThemeToggle.tsx` | accessible light/dark/system cycle button |
| `src/app/_components/MotionProvider.tsx` | Framer Motion `LazyMotion` + `domAnimation` + `MotionConfig reducedMotion="user"` |
| `src/app/_components/BrandMark.tsx` | the Concentric Ripple / Strata SVG mark |
| `src/app/_components/icons.tsx` | inline-SVG icon set |
| `src/app/layout.tsx` | wires `ThemeProvider` + `MotionProvider`, registers display font, `suppressHydrationWarning` |

`packages/core` and all server code are **untouched**. No screens redesigned.

---

## 9. Acceptance checklist (build gate)

- [x] Every text token resolves to a pairing in §3 with a measured ✓AA on all four surface planes,
      both themes (lowest: dark muted on deepest overlay **4.70:1**, light muted on sunken **5.10:1**).
- [x] Display face is a distinctive grotesque (Space Grotesk), not Inter/Roboto; body stays Geist.
- [x] Display tracking −0.02em (≥ −0.04em floor); clamp max 4.5rem (≤ 6rem ceiling).
- [x] Brand text on washes uses `--brand-fg` (AA both themes); no white body text on green-500/600.
- [x] Double-Bezel radii are concentric (24px shell − 6px gap = 18px inner core).
- [x] Shadows are hue-tinted and ≤ 0.08 opacity (light); no ghost-card (border + ≥16px blur).
- [x] All motion is `transform`/`opacity`/`box-shadow`/`filter` only, with a `prefers-reduced-motion`
      fallback (CSS block + `MotionConfig reducedMotion="user"`).
- [x] z-index uses the semantic scale; no `999`/`9999`.
- [x] Icons + brand mark are `aria-hidden` by default, labelable; theme toggle is keyboard-operable
      with an `aria-label`, ≥44px target, SSR-safe.
- [x] Bundle ≤ 180 KB (see report).
```
