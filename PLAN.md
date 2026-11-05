# PLAN

Milestones in order; work on ONE at a time and tick it when done.

- [x] **1. Skeleton + per-site state + double-tap toggle**
      Manifest V3 content script. Per-site ON/OFF in `storage.local` keyed by
      normalized hostname (strip `www.`), default OFF. Double-tap anywhere toggles
      state (also while OFF, suppressing native double-tap-to-zoom). No paging yet;
      verify state flips and persists.
      - Decisions: files are `extension/manifest.json` + `extension/content.js`
        only; permission `storage` only; content script `<all_urls>`,
        `document_start`, top frame only.
      - State: one map under `einkSiteStates`; writes serialized through a promise
        chain; gecko id `eink-reader@soulthy.github.io` +
        `data_collection_permissions: ["none"]`, no `strict_min_version`.
      - Double-tap: 300 ms / 30 px; `touch-action: manipulation` on html+body;
        touch only (no mouse fallback). A tap on a link/control wins: it neither
        toggles nor counts as a first tap.
      - Temporary fixed ON/OFF indicator (inline styles, 1.5 s, no animation);
        replaced by the item 3 badge.

- [ ] **2. Window paging**
      Left/right 25% tap zones. Each turn scrolls the window exactly
      `viewport height − 40px`, instantly. Floor pixel values to integers. Ignore
      taps on links/buttons/inputs. First/last page no-ops. Recalc total each turn.
      Complete the double-tap interaction: restore the pre-first-tap scroll position
      on the second tap.
      - Reuse item 1's `INTERACTIVE_SELECTOR` (also covers `label`, `summary`,
        `[role="button"]`, `[role="link"]`).

- [ ] **3. Page indicator badge**
      Shadow-DOM badge showing "n / m", visible ~1.5s after a turn; "ON"/"OFF"
      after a toggle; then hides. No animation.

- [ ] **4. Visual noise removal**
      High contrast (black on white, grayscale, no background images/gradients,
      underlined links). Disable animations/transitions/smooth scrolling. Pause
      autoplaying media. Hide small fixed/sticky elements (<50% viewport, not
      dialogs, not the scroller). Run on enable and after each page turn.

- [ ] **5. Inner-container paging**
      Center-of-viewport heuristic: page the nearest vertically scrollable ancestor
      instead of the window; fall back to window. Exempt the chosen scroller from
      the fixed/sticky hiding rule.

- [ ] **6. Pinch fullscreen (best-effort)**
      Device feasibility spike first. Pinch out → browser-only fullscreen, pinch
      in → exit. If flaky on target device, move to Nice.
