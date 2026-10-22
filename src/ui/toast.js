// The short confirmation message at the bottom of the page, optionally with Undo.

import { elements } from "./dom.js?v=f57322c3";
import { state } from "./store.js?v=f57322c3";

const TOAST_DURATION_MS = 6000;

export function showToast(message, undoAction = null) {
  clearTimeout(state.toastTimer);
  state.undoAction = undoAction;
  elements.toastMessage.textContent = message;
  elements.toastUndo.hidden = undoAction === null;
  elements.toast.hidden = false;
  state.toastTimer = setTimeout(hideToast, TOAST_DURATION_MS);
}

function hideToast() {
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
