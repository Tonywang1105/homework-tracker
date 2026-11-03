// Keyboard shortcuts: which key does what. No DOM, so it can be unit-tested with Node; src/ui/shortcuts.js acts on it.

// Each description is a phrase key in src/i18n.js, shown in the chosen language.
export const SHORTCUTS = [
  { key: "n", action: "add", description: "shortcut.add" },
  { key: "/", action: "search", description: "shortcut.search" },
  { key: "t", action: "view", description: "shortcut.view" },
  { key: "?", action: "help", description: "shortcut.help" },
];

/**
 * The shortcut a key press means, or null. Keys are ignored while typing in a box (so "n" types an n),
 * with Ctrl, Cmd or Alt held (so browser shortcuts still work), and while a key is held down and repeating.
 */
export function shortcutAction({ key, ctrlKey = false, metaKey = false, altKey = false, repeat = false }, typing = false) {
  if (typing || ctrlKey || metaKey || altKey || repeat) {
    return null;
  }
  return SHORTCUTS.find((shortcut) => shortcut.key === key.toLowerCase())?.action ?? null;
}

/** The view after `view`, going round List, Calendar, Agenda and back to List. */
export function nextView(view, views) {
  return views[(views.indexOf(view) + 1) % views.length];
}
