# RESEARCH — Notes on reference repos

Reviewed for the e-ink browsing extension (see `SPEC.md`). Only **one** reference
project is present in `/reference`: **InkPages** (`reference/InkPages-main`).

> Scope note: the task said "reference projects listed" (plural), but the folder
> contains a single project. InkPages is a *reader-mode / article-extraction*
> extension, which is a different beast from our spec (page-based navigation of
> the *existing* page + noise removal). Its value is mostly in the pagination and
> e-ink-optimization ideas, not the extraction pipeline.

---

## 1. AI navigation files found

InkPages ships **`CLAUDE.md`** (a ~620-line "Claude" equivalent of our `AGENTS.md`).
It is unusually good and I used it as the primary map:

- **Architecture decisions with *why*** (shadow-DOM overlay, MV2 choice, Readability bundling).
- **"Intentional Design Decisions"** that flag things not to "fix" (e.g. header hidden on pages 2+, absolute header + spacer).
- **"Important Code Locations"** — function name + line number for every subsystem.
- **A bug-history narrative** (v1.0.1 → v1.5.0) explaining *why* each non-obvious piece exists (sub-pixel drift, CSS-specificity wars, position-restore race).

This is a strong template for how a project should document itself for an agent.
Our split (`AGENTS.md` = how to work, `SPEC.md` = what to build, `PLAN.md` = tasks)
is cleaner for a spec-driven build than InkPages' single all-in-one file, but its
"line-numbered code map + gotchas" section is worth borrowing once we have real code.

---

## 2. What InkPages is and its features

A Firefox MV2 extension (kindle/boox/reMarkable target) that turns an article into
a paginated "book" overlay — no vertical scrolling. Features:

- **Article mode** — Mozilla Readability extraction → clean article, paginated.
- **TOC/listing mode** — for homepages/section pages, shows a paginated list of links.
- **True pagination** — tap/swipe/arrow-keys; each page is a full screen, no scroll.
- **Themes** — Light / Dark / Sepia / high-contrast **E-ink**.
- **Typography** — font family/size, line height, page width.
- **E-ink toggles** — bold text, justify, force grayscale, hide images (captions kept as a note), image size share.
- **Link modes** — normal / plain text / hide link-heavy blocks.
- **Exports** — HTML, **EPUB** (hand-rolled zip writer, no library), **Markdown** (hand-rolled converter).
- **Floating "Ink" button** — draggable launcher, on by default on Android.
- **Per-site auto-open** — remembers whether to auto-open articles and/or homepages per site, with a once-per-site prompt and a data migration.
- **Reading-position memory** — per URL, last 50.

---

## 3. How it works

### 3.1 "Scrolling" — there is none; pagination is CSS columns + `translateX`
The reader does not scroll the window at all. The article is laid out as a
horizontal **film strip** using CSS multi-column:

- Content container gets `column-width = viewport width`, a fixed `column-gap`,
  `column-fill: auto`, and `width: max-content`, so the browser flows the text
  into side-by-side columns.
- `totalPages` is computed from `content.scrollWidth / (viewport + gap)`.
- Turning a page is a **single instant `transform: translateX(-offset)`** — no
  animation, no scroll. `scroll-behavior: auto` everywhere (no smooth scroll).
- The viewport wrapper has `overflow: hidden` to clip to one column.

Key mechanics worth stealing:

- **Measure natural height first** (position absolute, hidden, read `scrollHeight`)
  before setting columns.
- **Round viewport dims down** (`Math.floor`) — InkPages hit a real bug where
  fractional pixels (e.g. 359.5px) accumulated into "drifting out of frame" over
  pages. For our `viewport − 40px` step this is directly relevant: floor, don't
  round up, or text gets cut.
- **Descender buffer** — subtract a few px so the last line's descenders don't
  collide with the footer/progress bar. Conceptually the same idea as our 40px
  overlap.
- **Repaginate at the same fractional position** — after a settings change or
  resize it re-measures but jumps to the same *fraction* of the article, not page
  1. Our spec's "recalculate total at every turn" is a lighter version of this.

### 3.2 CSS injection — Shadow DOM for the UI, not the page
InkPages renders its reader **inside the page** as an overlay with a **closed
Shadow DOM** root:

- `reader.html` + `reader.css` are declared in `web_accessible_resources` and
  fetched at runtime, then injected as `<style>` + markup into the shadow root.
- Shadow DOM gives **style isolation** (page CSS can't restyle the reader, and
  vice versa). The floating button and the reader UI are also custom-element +
  closed-shadow so generic page selectors can't hit them.
- Theme/settings are applied by setting a `data-theme` attribute + **CSS custom
  properties** (`--bg-color`, `--text-color`, …) and toggling host classes
  (`:host(.grayscale)`, `:host(.no-images)`, …). Grayscale is literally one rule:
  `filter: grayscale(100%)`.

**Relevance to us:** this shadow-DOM approach works because InkPages renders its
*own* content. Our spec restyles the *live page* (hide fixed/sticky elements,
grayscale the page, kill animations), so we can't wrap the page in a shadow root.
The transferable part is narrow:

- Use shadow DOM only for **our own chrome** — the "3/12" badge (so page CSS can't
  restyle it, exactly like their floating button).
- For the page itself we inject a normal `<style>` (or set `document.documentElement`
  classes/vars) and toggle body-level classes, not an isolated shadow tree.
- Their **theme-as-CSS-variables + one class per effect** pattern is clean and
  maps well to our "black text on white, grayscale, no background images" rules.

### 3.3 Settings — sync vs local split, one `applySettings()` funnel
- `storage.sync` → **preferences** (font, size, theme, e-ink toggles, export
  format) — follow the user across devices.
- `storage.local` → **per-site state** (auto-open origins, reading positions,
  floating-button position) — device-only.
- One `readerSettings` object with defaults; `loadSettings()` merges saved values,
  `applySettings()` writes them all out as CSS vars + host classes, then
  `repaginate()` re-runs layout at the same position.
- Cross-tab propagation via `storage.onChanged` (a setting changed in one tab
  updates other open tabs without reload).

**Relevance:** matches our spec's shape. We want per-site ON/OFF in `storage`
(local makes sense; sync is optional), a single defaults object, and one function
that applies state → CSS classes. Their "merge defaults, then write classes" is
the right minimal pattern.

### 3.4 Input — tap zones + swipe + keyboard
- Left/right **fixed tap zones at 25% width**, full height between header and
  progress bar, mapped to prev/next.
- Swipe: `touchstart`/`touchend` with a 50px horizontal threshold and a
  horizontal-beats-vertical check.
- Keyboard: arrows/space/Home/End, `S` settings, `Esc` close.

**Relevance:** our spec's tap zones (left 25% = up, right 25% = down) are almost
identical, but ours must additionally (a) ignore taps on links/buttons/inputs,
(b) not break text selection/long-press, and (c) coexist with double-tap and
pinch. InkPages doesn't solve (a)/(b) because it renders its own content — its
tap zones are empty divs with nothing interactive behind them. We must handle the
"is this tap on an interactive element?" check ourselves.

### 3.5 Extraction / sanitization pipeline (mostly out of scope for us)
Readability → `preprocessDOM` (strip embeds, cookie banners, screen-reader-only
text, forms, sign-in gates, collapsed sections, logo links) → `sanitizeHTML`
(allowlist tags/attributes/URL schemes, strip scripts/iframes/forms, unwrap
web components). Large, site-specific, and bug-fix-heavy. Our spec explicitly
says **no reader-mode/article extraction**, so none of this is needed.

### 3.6 Export (EPUB / Markdown / HTML) — out of scope
`epub.js` (stored-zip writer + CRC32, XHTML cleanup, image re-encode/grayscale)
and `markdown.js` (hand-rolled HTML→MD) are impressive and dependency-free, but
purely for saving articles. Not needed for v1.

---

## 4. What is overcomplicated (relative to our SPEC)

1. **The whole Readability extraction + sanitization stack** (`Readability.js`,
   `preprocessDOM`, `sanitizeHTML`, web-component shadow copying, sign-in-gate
   heuristics). Hundreds of lines of site-specific edge cases we don't need.

2. **Export suite** (`epub.js`, `markdown.js`, `exportArticle`,
   `prepareExportDocument`). Large, and unrelated to page-turn navigation.

3. **Auto-open + per-site memory with 6 lists and a migration.** They track
   `enabled/disabled/legacy` × `articles/toc` per origin, plus a one-time data
   migration and a once-per-site prompt. Our spec needs only a simple ON/OFF per
   site with OFF default.

4. **SPA navigation watcher** (`watchForNavigation`, `waitForNewPage`, page
   fingerprinting) to re-detect auto-open after `pushState`. Entirely an
   auto-open concern; we don't auto-open.

5. **Article-vs-TOC dual mode** and the CSS-specificity war it caused (they had
   to prefix every listing selector with `#article-content` to win specificity).
   A symptom of two modes sharing one stylesheet; our single mode avoids it.

6. **Caption/credit tagging, link-block detection, image-size fractions.** Nice
   reader polish, irrelevant to noise removal + paging.

7. **Floating-button drag logic** (pointer capture, drag-vs-tap disambiguation,
   position persistence). We don't ship a floating launcher; our double-tap and
   pinch are simpler.

---

## 5. What to steal conceptually

Mapped to our `SPEC.md` goals:

| Our need | InkPages idea to borrow |
|---|---|
| Page turn = viewport − 40px, instantly, no animation | Instant `translateX`/scroll jump; `scroll-behavior: auto`; **zero transitions** (they already treat e-ink as no-animation) |
| No text cut off / drift over turns | **Floor viewport dims to ints**; the "descender buffer" ≈ our 40px overlap |
| Recalculate page total every turn | `totalPages` from measured scroll size; re-measure on layout change |
| Black-on-white, grayscale, no backgrounds | One `filter: grayscale(100%)` rule + theme-as-CSS-variables; a single high-contrast palette |
| Kill sticky/fixed overlays | They strip cookie banners/embeds on *extracted* content; conceptually the same "hide floating junk", applied to the live page instead |
| "3/12" badge that hides ~1.5s | Their page-indicator "n / m" + progress bar; add a timed show/hide |
| Badge must not be restyled by page CSS | Put the badge in a **closed shadow root / custom element**, exactly like their floating button |
| Per-site state, OFF default, persists | `storage.local` keyed by normalized origin (strip `www.`), `storage.sync` for any global prefs |
| Minimal, dependency-free, no build | Their MV2 → MV3 migration notes confirm content script + CSS is ~100% reusable with no deps |

**Don't steal:** article extraction, sanitization heuristics, exports, auto-open
machinery, listing mode, floating button — all outside our v1 scope and heavier
than our spec allows.

---

## 6. Bottom line

InkPages proves the *hard parts* of e-ink paging are (a) exact integer math for
page steps, (b) zero animation, and (c) a single grayscale/high-contrast style
layer — not the extraction. Its real gold for us is the **pagination math + no-
animation discipline + shadow-DOM badge isolation**, while most of its ~9k lines
(exports, extraction, auto-open) is weight we must *not* carry.
