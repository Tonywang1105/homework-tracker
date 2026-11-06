// Keyboard shortcuts on a laptop: n adds, / searches, t switches views, ? lists them, Ctrl+Z (Cmd+Z) undoes
// (src/shortcuts.js says which key is which).

import { t } from "../i18n.js?v=5a7c35b2";
import { render } from "../main.js?v=5a7c35b2";
import { isUndoKey, nextView, SHORTCUTS, shortcutAction } from "../shortcuts.js?v=5a7c35b2";
import { elements } from "./dom.js?v=5a7c35b2";
import { panels, setPanelOpen } from "./panels.js?v=5a7c35b2";
import { setView, VIEWS } from "./settings.js?v=5a7c35b2";
import { state } from "./store.js?v=5a7c35b2";
import { canUndo, runUndo, showToast } from "./toast.js?v=5a7c35b2";

// The shortcuts are listed in Settings, so ? opens Settings at that section.
const shortcutsPanel = panels.find((panel) => panel.panel.id === "settings-panel");
const guide = document.getElementById("guide");

// Boxes where a key types a letter. Checkboxes and buttons aren't, so "n" still works after ticking one.
const TYPING_SELECTOR = 'input:not([type="checkbox"], [type="radio"], [type="button"], [type="file"]), textarea, select, [contenteditable]';

export function startShortcuts() {
  renderShortcutList();
  document.addEventListener("keydown", handleShortcutKey);
}

/** The list of shortcuts in Settings, in the chosen language. */
export function renderShortcutList() {
  document.getElementById("shortcut-list").replaceChildren(
    ...SHORTCUTS.flatMap(({ key, description }) => {
      const term = document.createElement("dt");
      const keyCap = document.createElement("kbd");
      keyCap.textContent = key;
      term.append(keyCap);
      const definition = document.createElement("dd");
      definition.textContent = t(description);
      return [term, definition];
    }),
  );
}

function handleShortcutKey(event) {
  if (event.key === "Escape" && !shortcutsPanel.panel.hidden) {
    setPanelOpen(shortcutsPanel, false);
    return;
  }
  // While the first-time tour is showing, keys belong to it.
  const typing = (event.target instanceof Element && event.target.closest(TYPING_SELECTOR) !== null) || !guide.hidden;
  // Ctrl+Z (Cmd+Z) presses the message's Undo, so a keyboard user can undo a delete without Tabbing to the button.
  if (isUndoKey(event, typing) && canUndo()) {
    event.preventDefault();
    runUndo();
    return;
  }
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
      render();
      document.getElementById("settings-shortcuts").scrollIntoView({ block: "nearest" });
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
    showToast(t("msg.nothing_to_search"));
    return;
  }
  elements.search.focus();
}
