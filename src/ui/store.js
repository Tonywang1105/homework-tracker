// The app's in-memory state, saving the list, and remembered settings in localStorage.

import { currentMonth } from "../calendar.js?v=14885c19";
import { render } from "../main.js?v=14885c19";
import { DEFAULT_DAILY_HOURS } from "../plan.js?v=14885c19";
import { saveAssignments } from "../storage.js?v=14885c19";
import { syncAssignments } from "./account.js?v=14885c19";
import { showToast } from "./toast.js?v=14885c19";

export const state = {
  assignments: [],
  editingId: null,
  // Whether the form is open from Extend… (rather than Edit), so saving a new date keeps the original.
  extending: false,
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
  // Each course's tag color (course -> color), worked out on every render from the courses and the colors
  // chosen in Course colors… (course -> color, saved in this browser).
  courseColors: new Map(),
  chosenColors: {},
  // Every course's links ({ course, label, url }), shown on the course pages; saved in this browser and synced.
  courseLinks: [],
  // The course chosen in the Course filter ("" for all), kept here because the dropdown is rebuilt on every render.
  courseFilter: "",
  // Whether Completed shows finished work due over two weeks ago too (not remembered after a reload).
  showOlderDone: false,
  // Whether Completed was open before a search opened it, so clearing the search puts it back; null when not searching.
  doneOpenBeforeSearch: null,
  // Focus blocks on this device ({ on, workMinutes, breakMinutes }), and the break after a block, or null.
  focus: { on: false, workMinutes: 25, breakMinutes: 5 },
  focusBreak: null,
  // Hours of homework per day the start-date planner fits work into, and its latest plan (id -> start).
  dailyHours: DEFAULT_DAILY_HOURS,
  startPlan: new Map(),
  // Today's plan's entries ({ assignment, reason, todayHours, hoursLeft }), worked out on every render.
  todayPlan: [],
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
