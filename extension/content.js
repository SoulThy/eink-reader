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
let indicator = null;
let indicatorTimer = 0;

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

function setSiteState(on) {
  return writeSiteState(() => on);
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

function pageScroller(scroller, direction) {
  const step = Math.floor(scroller.clientHeight) - OVERLAP_PX;
  if (step <= 0) {
    return;
  }
  const current = Math.floor(scroller.scrollTop);
  const maxScroll = Math.floor(scroller.scrollHeight - scroller.clientHeight);
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
  } else if (x > width * 0.75) {
    pageScroller(getScroller(), 1);
  }
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

function showIndicator(text) {
  if (indicator !== null) {
    indicator.remove();
    indicator = null;
  }
  clearTimeout(indicatorTimer);

  const element = document.createElement("div");
  element.textContent = text;
  element.style.position = "fixed";
  element.style.top = "12px";
  element.style.right = "12px";
  element.style.zIndex = "2147483647";
  element.style.background = "#fff";
  element.style.color = "#000";
  element.style.border = "2px solid #000";
  element.style.padding = "8px 12px";
  element.style.fontSize = "20px";
  element.style.fontWeight = "bold";
  element.style.pointerEvents = "none";

  document.documentElement.appendChild(element);
  indicator = element;

  indicatorTimer = setTimeout(() => {
    element.remove();
    if (indicator === element) {
      indicator = null;
    }
  }, INDICATOR_VISIBLE_MS);
}

function toggleSiteState() {
  writeSiteState((states) => states[site] !== true)
    .then((on) => {
      siteOn = on;
      showIndicator(on ? "ON" : "OFF");
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
