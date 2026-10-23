// The short confirmation message at the bottom of the page, optionally with Undo.

import { elements } from "./dom.js?v=1641df29";
import { state } from "./store.js?v=1641df29";

// A short confirmation ("Added "MP3".") goes quickly, so it isn't in the way; a longer message stays long
// enough to read, and one with Undo stays long enough to use it.
const MIN_DURATION_MS = 3000;
const MS_PER_CHARACTER = 60;
const MAX_DURATION_MS = 8000;

export function showToast(message, undoAction = null) {
  clearTimeout(state.toastTimer);
  state.undoAction = undoAction;
  elements.toastMessage.textContent = message;
  elements.toastUndo.hidden = undoAction === null;
  elements.toast.hidden = false;
  state.toastTimer = setTimeout(hideToast, toastDuration(message, undoAction !== null));
}

/** How long a message stays, in milliseconds. */
export function toastDuration(message, hasUndo) {
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
}
