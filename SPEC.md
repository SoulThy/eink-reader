# SPEC: E-ink paging extension

## Goal
Replace vertical scrolling with instant, page-based navigation on e-ink screens,
so any site — forums, wikis, docs, news — is comfortable to read and navigate
in grayscale with minimal visual noise.

## Target
- Primary: Firefox for Android on e-ink devices
- Secondary: desktop Firefox/Chromium for development
- Screen assumptions: very slow refresh, grayscale, touch-first

## Terms
- **ON/OFF**: whether the extension is active on the current site.
- **Site**: the hostname with a leading "www." removed
  (www.news.com and news.com are the same site; blog.news.com is a different one).
- **Step**: one page turn = viewport height minus 40px.
- **Scroller**: the element whose scroll position a page turn advances —
  the window by default, or an inner scroll container chosen by the
  center-of-viewport heuristic (see "Inner-container paging").

## Must (v1)

### Site state
- State is stored per site (see Terms), in extension storage (`storage.local`).
- Default is OFF on every site. Turning it ON on one page applies to every
  page of that site, and persists across sessions.

### Page-based navigation (only while ON)
- Tap zones: left 25% of the screen = page up, right 25% = page down.
  The center 50% does nothing on a single tap.
- A page turn advances the scroller by exactly one step, instantly, no animation.
- At the first/last page, further taps in that direction do nothing.
- Tap zones ignore taps on links, buttons, inputs, and other interactive elements.
- Taps must not interfere with text selection or long press.
- Page total is recalculated at every turn (page height can change).

### Inner-container paging (only while ON)
- If the element at the center of the viewport is inside a scrollable container,
  page that container instead of the window. Heuristic: walk up from the center
  element to the nearest ancestor that actually scrolls vertically.
- If no such container, fall back to window paging. If nothing scrolls, taps do
  nothing.
- The chosen scroller is exempt from the fixed/sticky hiding rule.

### Page indicator
- A small fixed badge at the bottom of the screen showing e.g. "3/12".
- Appears briefly (~1.5s) after a page turn, then hides.
- After a toggle it shows "ON" or "OFF" instead, then hides.
- No animation, including the badge.

### Gestures
- **Double tap anywhere** (any zone, ON or OFF): toggle the extension for the site.
  - Always toggles, even while OFF — Firefox Android's native double-tap-to-zoom
    is suppressed on double-tap.
  - Because the first tap of a double tap already turned the page, the second
    tap restores the exact scroll position from before the first tap, then toggles.
  - Double tap window: ~300ms.
- **Pinch out** (ON only): enter fullscreen, best-effort. Browser-only fullscreen
  is acceptable if the Android system nav bar cannot be hidden. **Pinch in**
  (ON only): exit fullscreen if it was entered by pinch out.
  - Treated as the final, best-effort milestone; a device feasibility spike first,
    moved to Nice if it proves flaky.
- While ON, native pinch zoom is fully disabled. While OFF, native zoom is
  untouched (except double-tap-to-zoom, which is used for toggling).

### Visual noise removal (while ON)
- Black text on white background, grayscale, no background images, no gradients.
- Links are underlined (touch affordance).
- Hide **small** elements with fixed or sticky positioning — i.e. under 50% of
  the viewport area — except the extension's own badge and the chosen scroller.
  - Never hide `<dialog>` elements or elements with `role="dialog"`; large
    overlays (consent walls, modals) stay visible.
  - Escape hatch: double-tap OFF.
  - The check runs on enable and after each page turn; no observers.
- Disable all CSS animations, transitions, and smooth scrolling.
- Stop autoplay: videos and audio that start without user interaction are paused.

## Nice (later, in rough priority order)
1. Larger fonts, larger tap targets
2. Simple ad hiding (common CSS selectors only, no filter lists)
3. Freeze animated GIFs
4. Hide or optionally hide images/video
5. Settings page (overlap size, zone width, swap left/right for left-handed use)
6. Hardware key / volume-key paging

## Never
- No frameworks, bundlers, or dependencies
- No analytics, network requests, or remote code
- No reader-mode/article extraction
- No settings UI in v1
- No ad blocking or filter lists in v1
- No permissions beyond `storage` and running the content script on all sites

## Acceptance criteria
- Each page turn advances the scroller exactly viewport height minus 40px, instantly.
- Double tap on a page: the scroll position ends exactly where it started, and
  the site state flips.
- With the extension ON, forms, logins, links, and buttons work normally.
- With the extension OFF, the page behaves as it does without the extension
  (native zoom works, except double-tap which toggles).
- No visible animation anywhere, including the badge.
- Inner scroll containers are paged when the center-of-viewport heuristic finds one.

## Defaults
- Overlap: 40px. Tap zones: left/right 25% of the screen.
- Badge visible for ~1.5s. Double tap window: ~300ms.
- State: OFF for every site.
