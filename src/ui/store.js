// The app's in-memory state, saving the list, and remembered settings in localStorage.

import { currentMonth } from "../calendar.js?v=3fc4391b";
import { render } from "../main.js?v=3fc4391b";
import { DEFAULT_DAILY_HOURS } from "../plan.js?v=3fc4391b";
import { saveAssignments } from "../storage.js?v=3fc4391b";
import { syncAssignments } from "./account.js?v=3fc4391b";
import { showToast } from "./toast.js?v=3fc4391b";

export const state = {
  assignments: [],
  editingId: null,
  // While saved data is unreadable we never write, so a mistake can't overwrite what is there.
  storageReadable: true,
  toastTimer: null,
  undoAction: null,
  // The assignment whose details box is open on the calendar, or null, and whether a Due soon
  // chip (rather than a calendar tag) opened it, which decides where the box appears.
  detailsId: null,
  detailsFromChip: false,
  // Calendar days ("YYYY-MM-DD") whose "+N more" link was clicked, so they show every tag.
  expandedDays: new Set(),
  // Repeating series whose later items are shown in the to-do list (normally only the next one is).
  expandedSeries: new Set(),
  // Whether Completed was open before a search opened it, so clearing the search puts it back; null when not searching.
  doneOpenBeforeSearch: null,
  // Hours of homework per day the start-date planner fits work into, and its latest plan (id -> start).
  dailyHours: DEFAULT_DAILY_HOURS,
  startPlan: new Map(),
  view: "list",
  // The month the calendar shows, as { year, month } with month 0-11.
  shownMonth: currentMonth(),
};

function persist() {
  if (!state.storageReadable) {
    return;
  }
  if (!saveAssignments(localStorage, state.assignments)) {
    showToast("Couldn't save. Your browser blocked storage, so changes will be lost on reload.");
  }
  syncAssignments(state.assignments);
}

export function findAssignment(id) {
  return state.assignments.find((a) => a.id === id);
}

export function updateAssignments(newAssignments) {
  state.assignments = newAssignments;
  persist();
  render();
}

/** Remembering a choice is only a convenience, so if the browser blocks storage the app just carries on. */
export function saveChoice(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nothing to do: the choice still applies until the page is reloaded.
  }
}

/** A saved value, or null if there is none or storage is blocked. */
export function loadText(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function removeChoice(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to do: blocked storage has nothing saved to remove.
  }
}

/** The saved choice if it is one of `allowed`, otherwise `fallback`. */
export function loadChoice(key, allowed, fallback) {
  const saved = loadText(key);
  return allowed.includes(saved) ? saved : fallback;
}
