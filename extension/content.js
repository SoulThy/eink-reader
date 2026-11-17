const STORAGE_KEY = "einkSiteStates";
const DOUBLE_TAP_WINDOW_MS = 300;
const DOUBLE_TAP_DISTANCE_PX = 30;
const INDICATOR_VISIBLE_MS = 1500;
const OVERLAP_PX = 40;
const TAP_MAX_MS = 500;
const INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, label, summary, [role="button"], [role="link"]';

const site = normalizeSite();

let lastTap = null;
let siteOn = false;
let touchStartAt = 0;
let writeChain = Promise.resolve();
let badgeHost = null;
let badgeInner = null;
let badgeTimer = 0;

function normalizeSite() {
  return location.hostname.toLowerCase().replace(/^www\./, "");
}

function readStates() {
  return browser.storage.local
    .get(STORAGE_KEY)
    .then((result) => result[STORAGE_KEY] || {});
}

function getSiteState() {
  return readStates().then((states) => states[site] === true);
}

// Serializing the whole read-modify-write keeps rapid toggles from clobbering
// each other's changes to the shared map.
function writeSiteState(computeNextState) {
  const write = writeChain
    .catch(() => {})
    .then(() => readStates())
    .then((states) => {
      const on = computeNextState(states);
      states[site] = on;
      return browser.storage.local
        .set({ [STORAGE_KEY]: states })
        .then(() => on);
    });

  writeChain = write;
  return write;
}

function isInteractiveTarget(node) {
  return node instanceof Element && node.closest(INTERACTIVE_SELECTOR) !== null;
}

function isDoubleTap(time, x, y) {
  if (lastTap === null) {
    return false;
  }
  const withinTime = time - lastTap.time <= DOUBLE_TAP_WINDOW_MS;
  const withinDistance =
    Math.abs(x - lastTap.x) <= DOUBLE_TAP_DISTANCE_PX &&
    Math.abs(y - lastTap.y) <= DOUBLE_TAP_DISTANCE_PX;
  return withinTime && withinDistance;
}

// Every scroll read/write goes through the scroller seam so item 5 can swap in
// an inner container without touching the paging logic.
function getScroller() {
  return document.scrollingElement;
}

function getScrollTop() {
  return getScroller().scrollTop;
}

// "instant" is explicit so a site's scroll-behavior: smooth cannot animate a
// page turn; item 4 disables that CSS later, but item 2 must not depend on it.
function restoreScroll(top) {
  getScroller().scrollTo({ top, left: 0, behavior: "instant" });
}

function getPageMetrics(scroller) {
  return {
    step: Math.floor(scroller.clientHeight) - OVERLAP_PX,
    current: Math.floor(scroller.scrollTop),
    maxScroll: Math.floor(scroller.scrollHeight - scroller.clientHeight),
  };
}

function pageScroller(scroller, direction) {
  const { step, current, maxScroll } = getPageMetrics(scroller);
  if (step <= 0) {
    return;
  }
  const target =
    direction > 0
      ? Math.min(current + step, maxScroll)
      : Math.max(current - step, 0);
  if (target === current) {
    return;
  }
  scroller.scrollTo({ top: target, left: 0, behavior: "instant" });
}

function pageOnZone(x) {
  if (!siteOn) {
    return;
  }
  const width = window.innerWidth;
  if (x < width * 0.25) {
    pageScroller(getScroller(), -1);
    showPageIndicator();
  } else if (x > width * 0.75) {
    pageScroller(getScroller(), 1);
    showPageIndicator();
  }
}

function showPageIndicator() {
  const { step, current, maxScroll } = getPageMetrics(getScroller());
  if (step <= 0) {
    showBadge("1/1");
    return;
  }
  const total = maxScroll > 0 ? Math.ceil(maxScroll / step) + 1 : 1;
  const page = Math.min(total, 1 + Math.ceil(current / step));
  showBadge(page + "/" + total);
}

// Cancelling the second tap's default action stops Firefox for Android from
// selecting a word (or flashing the tap highlight) on double tap. Single
// taps are never prevented, so scrolling, clicking and long press still work.
function handleTouchStart(event) {
  touchStartAt = Date.now();
  if (event.changedTouches.length !== 1) {
    return;
  }
  if (isInteractiveTarget(event.target)) {
    return;
  }
  const touch = event.changedTouches[0];
  if (isDoubleTap(Date.now(), touch.clientX, touch.clientY)) {
    event.preventDefault();
  }
}

function clearSelection() {
  const selection = window.getSelection();
  if (selection !== null) {
    selection.removeAllRanges();
  }
}

function handleTouchEnd(event) {
  if (event.changedTouches.length !== 1 || event.touches.length !== 0) {
    return;
  }

  // A tap on a link or control must act normally, so it is neither toggled nor
  // remembered as the first half of a double tap.
  if (isInteractiveTarget(event.target)) {
    lastTap = null;
    return;
  }

  const touch = event.changedTouches[0];
  const now = Date.now();

  // A held finger is a long press (text selection, context menu), not a tap.
  if (now - touchStartAt > TAP_MAX_MS) {
    lastTap = null;
    return;
  }

  if (isDoubleTap(now, touch.clientX, touch.clientY)) {
    const restoreTop = lastTap.scrollTop;
    lastTap = null;
    clearSelection();
    restoreScroll(restoreTop);
    toggleSiteState();
    return;
  }

  const preTurnScrollTop = getScrollTop();
  lastTap = {
    time: now,
    x: touch.clientX,
    y: touch.clientY,
    scrollTop: preTurnScrollTop,
  };
  pageOnZone(touch.clientX);
}

function installDoubleTapToggle() {
  if (document.documentElement !== null) {
    document.documentElement.style.touchAction = "manipulation";
  }

  document.addEventListener("touchend", handleTouchEnd, {
    capture: true,
    passive: true,
  });

  document.addEventListener("touchstart", handleTouchStart, {
    capture: true,
    passive: false,
  });

  if (document.body !== null) {
    document.body.style.touchAction = "manipulation";
  } else {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        if (document.body !== null) {
          document.body.style.touchAction = "manipulation";
        }
      },
      { once: true }
    );
  }
}

function logState(on) {
  console.log("eink:", site, on ? "ON" : "OFF");
}

// A shadow root keeps page CSS (button/div resets) from restyling the badge.
function ensureBadgeHost() {
  if (badgeHost !== null) {
    return;
  }

  badgeHost = document.createElement("div");
  badgeHost.style.position = "fixed";
  badgeHost.style.bottom = "12px";
  badgeHost.style.left = "0";
  badgeHost.style.right = "0";
  badgeHost.style.display = "flex";
  badgeHost.style.justifyContent = "center";
  badgeHost.style.zIndex = "2147483647";
  badgeHost.style.pointerEvents = "none";

  const root = badgeHost.attachShadow({ mode: "open" });
  badgeInner = document.createElement("div");
  badgeInner.style.display = "none";
  badgeInner.style.background = "#fff";
  badgeInner.style.color = "#000";
  badgeInner.style.border = "2px solid #000";
  badgeInner.style.padding = "6px 12px";
  badgeInner.style.fontSize = "18px";
  badgeInner.style.fontWeight = "bold";
  badgeInner.style.fontFamily = "sans-serif";
  badgeInner.style.pointerEvents = "none";
  badgeInner.style.transition = "none";

  root.appendChild(badgeInner);
  document.documentElement.appendChild(badgeHost);
}

function showBadge(text) {
  ensureBadgeHost();
  clearTimeout(badgeTimer);
  badgeInner.textContent = text;
  badgeInner.style.display = "flex";
  badgeTimer = setTimeout(hideBadge, INDICATOR_VISIBLE_MS);
}

function hideBadge() {
  clearTimeout(badgeTimer);
  if (badgeInner !== null) {
    badgeInner.style.display = "none";
  }
}

function toggleSiteState() {
  writeSiteState((states) => states[site] !== true)
    .then((on) => {
      siteOn = on;
      showBadge(on ? "ON" : "OFF");
      logState(on);
    })
    .catch((error) => console.error("eink: failed to save state", error));
}

function init() {
  if (site === "") {
    console.log("eink: no hostname, disabled");
    return;
  }

  installDoubleTapToggle();

  getSiteState()
    .then((on) => {
      siteOn = on;
      logState(on);
    })
    .catch((error) => console.error("eink: failed to read state", error));
}

init();
