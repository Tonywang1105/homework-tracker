// The short confirmation message at the bottom of the page, optionally with Undo.

import { t } from "../i18n.js?v=da81b4bb";
import { elements } from "./dom.js?v=da81b4bb";
import { state } from "./store.js?v=da81b4bb";

// A short confirmation ("Added "MP3".") goes quickly, so it isn't in the way; a longer message stays long
// enough to read, and one with Undo stays long enough to use it.
const MIN_DURATION_MS = 3000;
const MS_PER_CHARACTER = 60;
const MAX_DURATION_MS = 8000;

// Whether the message's button is Undo (rather than, say, "Mark done"), so Ctrl+Z (Cmd+Z) may press it.
let buttonIsUndo = false;

/**
 * Shows a message, optionally with a button (labelled Undo unless `actionLabel` says otherwise) that runs `undoAction`.
 * `durationMs` overrides how long it stays (deleting a row gives 7 seconds to Undo).
 */
export function showToast(message, undoAction = null, actionLabel = t("msg.undo"), durationMs = null) {
  clearTimeout(state.toastTimer);
  state.undoAction = undoAction;
  buttonIsUndo = undoAction !== null && actionLabel === t("msg.undo");
  elements.toastMessage.textContent = message;
  elements.toastUndo.textContent = actionLabel;
  elements.toastUndo.hidden = undoAction === null;
  elements.toast.hidden = false;
  state.toastTimer = setTimeout(hideToast, durationMs ?? toastDuration(message, undoAction !== null));
}

/** How long a message stays, in milliseconds. */
function toastDuration(message, hasUndo) {
  if (hasUndo) {
    return MAX_DURATION_MS;
  }
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, message.length * MS_PER_CHARACTER));
}

export function hideToast() {
  elements.toast.hidden = true;
  state.undoAction = null;
}

/** Whether a message with Undo is showing, so Ctrl+Z (Cmd+Z) has something to undo. */
export function canUndo() {
  return buttonIsUndo && state.undoAction !== null && !elements.toast.hidden;
}

/** Runs the message's Undo and hides the message. Keyboard focus stays where it is (Ctrl+Z, Cmd+Z). */
export function runUndo() {
  const undo = state.undoAction;
  hideToast();
  if (undo) {
    undo();
  }
}

/** The Undo button: runs it, then gives keyboard focus a place, since the button is now hidden. */
export function handleUndo() {
  runUndo();
  elements.listHeading.focus({ preventScroll: true });
}
