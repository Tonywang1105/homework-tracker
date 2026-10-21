// The short confirmation message at the bottom of the page, optionally with Undo.

import { elements } from "./dom.js?v=32c9527b";
import { state } from "./store.js?v=32c9527b";

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
