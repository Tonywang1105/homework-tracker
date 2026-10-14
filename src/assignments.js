// Pure logic for assignments: no DOM and no storage, so it can be unit-tested with Node.

export const PRIORITIES = ["big", "small"];
export const DEFAULT_DUE_TIME = "23:59";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;
const MAX_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 5000;

/**
 * Checks raw form input and turns it into clean assignment fields.
 * Returns { ok: true, fields } or { ok: false, errors }, where errors maps a field name to a message.
 */
export function validateAssignmentInput(input) {
  const title = (input.title ?? "").trim();
  const course = (input.course ?? "").trim();
  const dueDate = (input.dueDate ?? "").trim();
  const dueTime = (input.dueTime ?? "").trim() || DEFAULT_DUE_TIME;
  const priority = input.priority ?? "big";
  const notes = (input.notes ?? "").trim();
  const errors = {};

  if (title === "") {
    errors.title = "Give the assignment a name.";
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.title = `Keep the name under ${MAX_TITLE_LENGTH} characters.`;
  }
  if (!DATE_PATTERN.test(dueDate) || Number.isNaN(toDueDate(dueDate, DEFAULT_DUE_TIME).getTime())) {
    errors.dueDate = "Pick a due date.";
  }
  if (!TIME_PATTERN.test(dueTime)) {
    errors.dueTime = "Pick a time, or leave it empty for 11:59 PM.";
  }
  if (!PRIORITIES.includes(priority)) {
    errors.priority = "Choose big or small.";
  }
  if (notes.length > MAX_NOTES_LENGTH) {
    errors.notes = `Keep notes under ${MAX_NOTES_LENGTH} characters.`;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, fields: { title, course, dueDate, dueTime, priority, notes } };
}

/** Builds a new assignment from validated fields. */
export function createAssignment(fields, { id = crypto.randomUUID(), now = new Date() } = {}) {
  return { id, ...fields, done: false, createdAt: now.toISOString() };
}

/** A new list where the assignment with this id has `changes` applied, e.g. { done: true }. */
export function updateAssignment(assignments, id, changes) {
  return assignments.map((a) => (a.id === id ? { ...a, ...changes } : a));
}

/** A new list without the assignment with this id. */
export function removeAssignment(assignments, id) {
  return assignments.filter((a) => a.id !== id);
}

/** The due moment as a Date, read in the browser's local time zone. */
export function toDueDate(dueDate, dueTime) {
  return new Date(`${dueDate}T${dueTime}`);
}

/** Returns a new array sorted soonest-due first; ties keep big items ahead of small ones. */
export function sortByDue(assignments) {
  return [...assignments].sort((a, b) => {
    const difference = toDueDate(a.dueDate, a.dueTime) - toDueDate(b.dueDate, b.dueTime);
    if (difference !== 0) {
      return difference;
    }
    return PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority);
  });
}

/** Splits assignments into the to-do list and the completed list, each sorted by due date. */
export function groupAssignments(assignments) {
  const sorted = sortByDue(assignments);
  return {
    todo: sorted.filter((a) => !a.done),
    done: sorted.filter((a) => a.done),
  };
}

/**
 * The assignments that pass the list's filters, used by both the list and the calendar so they agree.
 * course: only that course ("" for all); bigOnly: hide small reminders; hideDone: hide finished work.
 */
export function filterAssignments(assignments, { course = "", bigOnly = false, hideDone = false } = {}) {
  return assignments.filter(
    (a) => (course === "" || a.course === course) && (!bigOnly || a.priority === "big") && (!hideDone || !a.done),
  );
}

/** Every course name used in the list, sorted, without blanks or repeats. */
export function courseNames(assignments) {
  return [...new Set(assignments.map((a) => a.course).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * A short, human description of how far away a due date is, e.g. "due in 3 days" or "overdue by 2 hours".
 * `urgency` is "overdue", "soon" (within 48 hours) or "later", for styling.
 */
export function describeDue(assignment, now = new Date()) {
  const remaining = toDueDate(assignment.dueDate, assignment.dueTime) - now;
  const urgency = remaining < 0 ? "overdue" : remaining <= 2 * DAY ? "soon" : "later";
  const amount = formatDuration(Math.abs(remaining));
  const text = remaining < 0 ? `overdue by ${amount}` : `due in ${amount}`;
  return { text, urgency };
}

function formatDuration(milliseconds) {
  if (milliseconds < HOUR) {
    return plural(Math.max(1, Math.round(milliseconds / MINUTE)), "minute");
  }
  if (milliseconds < DAY) {
    return plural(Math.round(milliseconds / HOUR), "hour");
  }
  return plural(Math.round(milliseconds / DAY), "day");
}

function plural(count, unit) {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}
