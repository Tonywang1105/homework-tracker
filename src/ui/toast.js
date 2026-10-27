// The short confirmation message at the bottom of the page, optionally with Undo.

import { elements } from "./dom.js?v=f2a236bc";
import { state } from "./store.js?v=f2a236bc";

// A short confirmation ("Added "MP3".") goes quickly, so it isn't in the way; a longer message stays long
// enough to read, and one with Undo stays long enough to use it.
const MIN_DURATION_MS = 3000;
const MS_PER_CHARACTER = 60;
const MAX_DURATION_MS = 8000;

/** Shows a message, optionally with a button (labelled Undo unless `actionLabel` says otherwise) that runs `undoAction`. */
export function showToast(message, undoAction = null, actionLabel = "Undo") {
  clearTimeout(state.toastTimer);
  state.undoAction = undoAction;
  elements.toastMessage.textContent = message;
  elements.toastUndo.textContent = actionLabel;
  elements.toastUndo.hidden = undoAction === null;
  elements.toast.hidden = false;
  state.toastTimer = setTimeout(hideToast, toastDuration(message, undoAction !== null));
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

export function handleUndo() {
  const undo = state.undoAction;
  hideToast();
  if (undo) {
    undo();
  }
  // The button is now hidden, so give keyboard focus a place in the list instead of losing it.
  elements.listHeading.focus({ preventScroll: true });
}
