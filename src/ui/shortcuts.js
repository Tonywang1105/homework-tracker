// Keyboard shortcuts on a laptop: n adds, / searches, t switches views, ? lists them (src/shortcuts.js says which key is which).

import { render } from "../main.js?v=58e8efec";
import { nextView, SHORTCUTS, shortcutAction } from "../shortcuts.js?v=58e8efec";
import { elements } from "./dom.js?v=58e8efec";
import { panels, setPanelOpen } from "./panels.js?v=58e8efec";
import { setView, VIEWS } from "./settings.js?v=58e8efec";
import { state } from "./store.js?v=58e8efec";
import { showToast } from "./toast.js?v=58e8efec";

const shortcutsPanel = panels.find((panel) => panel.panel.id === "shortcuts-panel");
const guide = document.getElementById("guide");

// Boxes where a key types a letter. Checkboxes and buttons aren't, so "n" still works after ticking one.
const TYPING_SELECTOR = 'input:not([type="checkbox"], [type="radio"], [type="button"], [type="file"]), textarea, select, [contenteditable]';

export function startShortcuts() {
  document.getElementById("shortcut-list").replaceChildren(
    ...SHORTCUTS.flatMap(({ key, description }) => {
      const term = document.createElement("dt");
      const keyCap = document.createElement("kbd");
      keyCap.textContent = key;
      term.append(keyCap);
      const definition = document.createElement("dd");
      definition.textContent = description;
      return [term, definition];
    }),
  );
  document.addEventListener("keydown", handleShortcutKey);
}

function handleShortcutKey(event) {
  if (event.key === "Escape" && !shortcutsPanel.panel.hidden) {
    setPanelOpen(shortcutsPanel, false);
    return;
  }
  // While the first-time tour is showing, keys belong to it.
  const typing = (event.target instanceof Element && event.target.closest(TYPING_SELECTOR) !== null) || !guide.hidden;
  const action = shortcutAction(event, typing);
  if (!action) {
    return;
  }
  // "/" would otherwise open Firefox's find bar, and the letters would scroll some pages.
  event.preventDefault();
  switch (action) {
    case "add":
      elements.form.elements.title.focus();
      break;
    case "search":
      focusSearch();
      break;
    case "view":
      setView(nextView(state.view, VIEWS));
      break;
    case "help":
      setPanelOpen(shortcutsPanel, true);
      break;
  }
}

/** Search lives in the list view, so go there first; with nothing to search, the box isn't shown. */
function focusSearch() {
  if (state.view !== "list") {
    setView("list");
  }
  render();
  if (elements.search.offsetParent === null) {
    showToast("Nothing to search yet. Add an assignment first.");
    return;
  }
  elements.search.focus();
}
