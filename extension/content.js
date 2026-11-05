const STORAGE_KEY = "einkSiteStates";
const DOUBLE_TAP_WINDOW_MS = 300;
const DOUBLE_TAP_DISTANCE_PX = 30;
const INDICATOR_VISIBLE_MS = 1500;
const INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, label, summary, [role="button"], [role="link"]';

const site = normalizeSite();

let lastTap = null;
let writeChain = Promise.resolve();
let indicator = null;
let indicatorTimer = 0;
let selectionGuardTimer = 0;

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

// Android selects a word on double tap. Blocking selection for the double tap
// window only, from the first tap's touchend, keeps long press selection
// working because that gesture starts before any touchend.
function guardTextSelection() {
  document.documentElement.style.userSelect = "none";
  clearTimeout(selectionGuardTimer);
  selectionGuardTimer = setTimeout(restoreTextSelection, DOUBLE_TAP_WINDOW_MS);
}

function restoreTextSelection() {
  clearTimeout(selectionGuardTimer);
  document.documentElement.style.userSelect = "";
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
    restoreTextSelection();
    return;
  }

  const touch = event.changedTouches[0];
  const now = Date.now();

  if (isDoubleTap(now, touch.clientX, touch.clientY)) {
    lastTap = null;
    restoreTextSelection();
    clearSelection();
    toggleSiteState();
    return;
  }

  guardTextSelection();
  lastTap = { time: now, x: touch.clientX, y: touch.clientY };
}

function installDoubleTapToggle() {
  if (document.documentElement !== null) {
    document.documentElement.style.touchAction = "manipulation";
  }

  document.addEventListener("touchend", handleTouchEnd, {
    capture: true,
    passive: true,
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
    .then(logState)
    .catch((error) => console.error("eink: failed to read state", error));
}

init();
