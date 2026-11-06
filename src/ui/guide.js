// The first-time tour: a few bubbles, one at a time, each pointing at a part of the page with Back, Next and
// Skip. It starts the first time the list has anything in it (so there is something to point at), and
// "Show the tour again" in Settings brings it back. Called the guide here so it isn't confused with
// the tour test in tests/tour.js.

import { t } from "../i18n.js?v=83b99c44";
import { elements } from "./dom.js?v=83b99c44";
import { loadText, saveChoice } from "./store.js?v=83b99c44";

const GUIDE_SEEN_KEY = "homework-tracker.guideSeen";

// Each step points at the first visible element matching `target`; steps whose target isn't showing
// (like Sign in, once signed in) are left out. Titles and texts are phrase keys in src/i18n.js.
const STEPS = [
  {
    target: "#quick-add",
    title: "guide.quick_title",
    text: "guide.quick_text",
  },
  {
    target: "#today-summary",
    title: "guide.summary_title",
    text: "guide.summary_text",
  },
  {
    target: ".list-header .segmented",
    title: "guide.views_title",
    text: "guide.views_text",
  },
  {
    target: "#todo-list li[data-id]",
    title: "guide.row_title",
    text: "guide.row_text",
  },
  {
    target: ".import-links",
    title: "guide.tools_title",
    text: "guide.tools_text",
  },
  {
    target: "#sign-in",
    title: "guide.phone_title",
    text: "guide.phone_text",
  },
];

const guide = {
  box: document.getElementById("guide"),
  title: document.getElementById("guide-title"),
  text: document.getElementById("guide-text"),
  count: document.getElementById("guide-count"),
  back: document.getElementById("guide-back"),
  next: document.getElementById("guide-next"),
  skip: document.getElementById("guide-skip"),
};

let steps = [];
let current = -1;
let highlighted = null;

export function startGuideListeners() {
  guide.next.addEventListener("click", () => showStep(current + 1));
  guide.back.addEventListener("click", () => showStep(current - 1));
  guide.skip.addEventListener("click", endGuide);
  document.getElementById("guide-start").addEventListener("click", startGuide);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && current !== -1) {
      endGuide();
    }
  });
  window.addEventListener("resize", () => current !== -1 && placeBox());
}

/** Starts the tour the first time there is something to show, once per browser. */
export function offerGuide(assignmentCount) {
  if (assignmentCount > 0 && current === -1 && !loadText(GUIDE_SEEN_KEY)) {
    // After this render has drawn the rows the tour points at.
    setTimeout(startGuide, 0);
  }
}

export function startGuide() {
  // Marked as seen at the start, so a reload part-way through doesn't start it again.
  saveChoice(GUIDE_SEEN_KEY, "yes");
  steps = STEPS.filter((step) => targetOf(step));
  if (steps.length > 0) {
    showStep(0);
  }
}

function showStep(index) {
  if (index >= steps.length) {
    endGuide();
    return;
  }
  current = Math.max(0, index);
  const step = steps[current];
  setHighlight(targetOf(step));
  guide.title.textContent = t(step.title);
  guide.text.textContent = t(step.text);
  guide.count.textContent = t("guide.count", { n: current + 1, total: steps.length });
  guide.back.hidden = current === 0;
  guide.next.textContent = t(current === steps.length - 1 ? "guide.done" : "guide.next");
  guide.box.hidden = false;
  highlighted.scrollIntoView({ block: "center" });
  placeBox();
  guide.next.focus({ preventScroll: true });
}

function endGuide() {
  current = -1;
  setHighlight(null);
  guide.box.hidden = true;
  elements.listHeading.focus({ preventScroll: true });
}

function targetOf(step) {
  return [...document.querySelectorAll(step.target)].find((element) => element.offsetParent !== null) ?? null;
}

function setHighlight(element) {
  highlighted?.classList.remove("guide-target");
  highlighted = element;
  highlighted?.classList.add("guide-target");
}

/** Puts the bubble just below the highlighted part, or above it if there's no room below, inside the screen. */
function placeBox() {
  const target = highlighted.getBoundingClientRect();
  const box = guide.box.getBoundingClientRect();
  const gap = 10;
  const fitsBelow = target.bottom + gap + box.height <= window.innerHeight;
  const top = fitsBelow ? target.bottom + gap : Math.max(gap, target.top - gap - box.height);
  const left = Math.min(Math.max(gap, target.left), window.innerWidth - box.width - gap);
  guide.box.style.top = `${top + window.scrollY}px`;
  guide.box.style.left = `${Math.max(gap, left) + window.scrollX}px`;
}
