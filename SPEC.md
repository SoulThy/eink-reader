# SPEC: E-ink browsing extension

## Goal
Make web pages comfortable to read and navigate on e-ink screens by replacing
scrolling with page-based navigation and removing visual noise (colors,
backgrounds, sticky elements, autoplaying media).

## Target
- Primary: Firefox for Android on e-ink devices
- Secondary: desktop Firefox/Chromium for development
- Screen assumptions: very slow refresh, grayscale, touch-first

## Terms
- **ON/OFF**: whether the extension is active on the current site.
- **Site**: the hostname with a leading "www." removed
  (www.news.com and news.com are the same site; blog.news.com is a different one).
- **Step**: one page turn = viewport height minus 40px.

## Must (v1)

### Site state
- State is stored per site (see Terms), in extension storage.
- Default is OFF on every site. Turning it ON on one page applies to every
  page of that site, and the state persists across sessions.

### Page-based navigation (only while ON)
- Tap zones: left 25% of the screen = page up, right 25% = page down.
  The center 50% does nothing on single tap.
- A page turn scrolls exactly one step, instantly, with no animation.
- Only the main window scroll is paged. If the page doesn't scroll at window
  level, taps do nothing.
- At the first/last page, further taps in that direction do nothing.
- Tap zones ignore taps on links, buttons, inputs, and other interactive elements.
- Taps must not interfere with text selection or long press.

### Page indicator
- A small fixed badge at the bottom of the screen showing example "3/12".
- It appears briefly (~1.5s) after a page turn, then hides.
- After a toggle it shows "ON" or "OFF" instead, then hides.
- Page total is recalculated at every turn (page height can change).

### Gestures
- **Double tap anywhere** (any zone, ON or OFF): toggle the extension for the site.
  - Because the first tap of a double tap already turned the page, the second
    tap restores the exact scroll position from before the first tap, then toggles.
  - Double tap window: ~300ms.
- **Pinch out** (ON only): enter fullscreen. The Firefox UI is hidden, and the
  Android system navigation bar is hidden where the browser allows it.
  Only the page is visible.
- **Pinch in** (ON only): exit fullscreen if it was entered by pinch out.
- While ON, native pinch zoom is fully disabled. While OFF, native zoom is untouched.

### Visual noise removal (while ON)
- Black text on white background, grayscale, no background images, no gradients.
- Hide elements with fixed or sticky positioning (headers, cookie banners,
  floating buttons), except the extension's own badge.
- Disable all CSS animations, transitions, and smooth scrolling.
- Stop autoplay: videos and audio that start without user interaction are paused.

## Nice (later, in rough priority order)
1. Larger fonts, larger tap targets, underlined links
2. Simple ad hiding (common CSS selectors only, no filter lists)
3. Freeze animated GIFs
4. Hide or optionally hide images/video
5. Detect and page inner scroll containers (web apps, forums)
6. Settings page (overlap size, zone width, swap left/right for left-handed use)
7. If device has a hardware key that sends a page up or page down (custom key) react to it.
7. Hardware volume key paging

## Never
- No frameworks, bundlers, or dependencies
- No analytics, network requests, or remote code
- No reader-mode/article extraction
- No settings UI in v1
- No ad blocking or filter lists in v1
- No permissions beyond `storage` and running the content script on all sites

## Acceptance criteria
- Each page turn scrolls exactly viewport height minus 40px, instantly.
- Double tap on a page: the scroll position ends exactly where it started,
  and the site state flips.
- With the extension ON, forms, logins, links, and buttons work normally.
- With the extension OFF, the page behaves as it does without the extension
  (including native zoom).
- No visible animation anywhere, including the badge.

## Defaults
- Overlap: 40px. Tap zones: left/right 25% of the screen.
- Badge visible for ~1.5s. Double tap window: ~300ms.
- State: OFF for every site.

## Open questions (agent should ask before implementing the related milestone)
- When OFF, should double tap also suppress Firefox's native double-tap-to-zoom?
- Fullscreen usually exits when navigating to a new page. Re-enter automatically
  or require a new pinch out?
- Hiding fixed elements may hide consent walls or modal dialogs that block the
  page. Should there be an escape hatch, or is that accepted for v1?
- If the Android navigation bar cannot be hidden by the browser, is a
  browser-only fullscreen acceptable?
