// The box above the list naming the due dates a Canvas re-import moved, earlier ones first, until Got it. Kept on
// this device, so it's still there after a reload: a moved deadline is easy to miss in a message that disappears.

import { toDueDate } from "../assignments.js?v=a2302d82";
import { addMovedDates, readMovedDates } from "../canvas.js?v=a2302d82";
import { t } from "../i18n.js?v=a2302d82";
import { render } from "../main.js?v=a2302d82";
import { dueFormatter, elements } from "./dom.js?v=a2302d82";
import { loadText, removeChoice, saveChoice } from "./store.js?v=a2302d82";

const MOVED_KEY = "homework-tracker.canvasMovedDates";

const banner = {
  box: document.getElementById("canvas-moved"),
  list: document.getElementById("canvas-moved-list"),
  dismiss: document.getElementById("canvas-moved-dismiss"),
};

export function startCanvasMoved() {
  banner.dismiss.addEventListener("click", () => {
    removeChoice(MOVED_KEY);
    render();
    // The button is gone, so give keyboard focus a place in the list.
    elements.listHeading.focus({ preventScroll: true });
  });
}

/** After an import: adds what it moved to the box (nothing changes if it moved nothing). */
export function showMovedDates(moved) {
  if (moved.length > 0) {
    saveChoice(MOVED_KEY, JSON.stringify(addMovedDates(readMovedDates(loadText(MOVED_KEY)), moved)));
  }
}

/** Puts the box back as it was before an import, for that import's Undo. */
export function restoreMovedDates(savedText) {
  if (savedText === null) {
    removeChoice(MOVED_KEY);
  } else {
    saveChoice(MOVED_KEY, savedText);
  }
}

/** The box as it is now, to hand back to restoreMovedDates. */
export function currentMovedDates() {
  return loadText(MOVED_KEY);
}

export function renderCanvasMoved() {
  const moved = readMovedDates(loadText(MOVED_KEY));
  banner.box.hidden = moved.length === 0;
  banner.list.replaceChildren(
    ...moved.map((move) => {
      const item = document.createElement("li");
      const format = (due) => dueFormatter.format(toDueDate(due.dueDate, due.dueTime));
      item.textContent = t("canvas.moved_item", { title: move.title, from: format(move.from), to: format(move.to) });
      if (move.earlier) {
        const earlier = document.createElement("strong");
        earlier.className = "moved-earlier";
        earlier.textContent = ` (${t("canvas.moved_earlier")})`;
        item.append(earlier);
      }
      return item;
    }),
  );
}
