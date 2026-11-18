// The note above the list on an iPhone's browser while signed out: the list may be deleted after 7 days unopened, so
// add the app to the Home Screen or sign in (see src/storageNote.js). Got it hides it on this device.

import { render } from "../main.js?v=26fc70a6";
import { isAppleMobile, needsStorageNote } from "../storageNote.js?v=26fc70a6";
import { isSignedIn } from "./account.js?v=26fc70a6";
import { elements } from "./dom.js?v=26fc70a6";
import { loadText, saveChoice, state } from "./store.js?v=26fc70a6";

const DISMISSED_KEY = "homework-tracker.storageNoteSeen";

const note = document.getElementById("storage-note");

export function startStorageNote() {
  document.getElementById("storage-note-dismiss").addEventListener("click", () => {
    saveChoice(DISMISSED_KEY, "yes");
    render();
    // The button is gone, so give keyboard focus a place in the list.
    elements.listHeading.focus({ preventScroll: true });
  });
}

export function renderStorageNote() {
  note.hidden = !needsStorageNote({
    appleMobile: isAppleMobile(navigator),
    homeScreenApp: navigator.standalone === true || matchMedia("(display-mode: standalone)").matches,
    signedIn: isSignedIn(),
    hasAssignments: state.assignments.length > 0,
    dismissed: loadText(DISMISSED_KEY) === "yes",
  });
}
