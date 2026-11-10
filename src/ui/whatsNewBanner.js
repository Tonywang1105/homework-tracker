// The "New:" banner above the list: features added since this device last looked (src/whatsNew.js), until Got it.

import { t } from "../i18n.js?v=a4a2142e";
import { render } from "../main.js?v=a4a2142e";
import { NOTES, notesToShow } from "../whatsNew.js?v=a4a2142e";
import { elements } from "./dom.js?v=a4a2142e";
import { loadText, saveChoice, state } from "./store.js?v=a4a2142e";

const SEEN_KEY = "homework-tracker.newsSeen";
// Names in the banner's one line before "and N more".
const MAX_NAMED = 2;

const banner = {
  box: document.getElementById("new-banner"),
  text: document.getElementById("new-banner-text"),
  list: document.getElementById("new-banner-list"),
  all: document.getElementById("new-banner-all"),
  dismiss: document.getElementById("new-banner-dismiss"),
};
// Worked out once at start-up, so notes don't appear part-way through a visit.
let shown = [];

export function startWhatsNew() {
  const { show, markSeen } = notesToShow(NOTES, loadText(SEEN_KEY), state.assignments.length > 0);
  if (markSeen) {
    saveChoice(SEEN_KEY, markSeen);
  }
  shown = show;
  banner.all.addEventListener("click", () => {
    banner.list.hidden = !banner.list.hidden;
    render();
  });
  banner.dismiss.addEventListener("click", () => {
    saveChoice(SEEN_KEY, NOTES.at(-1).id);
    shown = [];
    render();
    // The button is gone, so give keyboard focus a place in the list.
    elements.listHeading.focus({ preventScroll: true });
  });
}

/** "New: Copy this week · The version number · and 4 more", or every note once Show all is pressed. */
export function renderWhatsNew() {
  banner.box.hidden = shown.length === 0;
  if (shown.length === 0) {
    return;
  }
  const expanded = !banner.list.hidden;
  const names = shown.slice(0, MAX_NAMED).map((note) => t(note.phrase));
  if (shown.length > MAX_NAMED) {
    names.push(t("new.more", { n: shown.length - MAX_NAMED }));
  }
  banner.text.hidden = expanded;
  banner.text.textContent = names.join(" · ");
  banner.list.replaceChildren(
    ...shown.map((note) => {
      const item = document.createElement("li");
      item.textContent = t(note.phrase);
      return item;
    }),
  );
  banner.all.hidden = shown.length <= MAX_NAMED || expanded;
  banner.all.setAttribute("aria-expanded", String(expanded));
}
