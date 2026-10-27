// Pure logic for assignments: no DOM and no storage, so it can be unit-tested with Node.

// Sizes, most important first: ties in due time and busy calendar days follow this order.
export const PRIORITIES = ["big", "regular", "small"];
export const PRIORITY_LABELS = { big: "Big", regular: "Regular", small: "Small" };
export const DEFAULT_DUE_TIME = "23:59";

// Assignment types, each with its own color. "" means no type. The form also offers AUTO_TYPE.
export const TYPES = ["exam", "quiz", "mp", "lab", "homework", "reading"];
export const TYPE_LABELS = { exam: "Exam", quiz: "Quiz", mp: "MP", lab: "Lab", homework: "Homework", reading: "Reading" };
export const AUTO_TYPE = "auto";

// Checked in order, so "Midterm quiz review" counts as an exam. Each matches whole words only.
const TYPE_PATTERNS = [
  ["exam", /\b(exams?|midterms?|final exam)\b/i],
  ["quiz", /\b(quiz|quizzes)\b/i],
  ["mp", /\b(mp\s*\d+|machine problem)/i],
  ["lab", /\blabs?\b/i],
  ["homework", /\b(homework|hw\s*\d*|problem sets?|psets?)\b/i],
  ["reading", /\breadings?\b/i],
];

/** A type guessed from the title, e.g. "MP3: Checkpoint 1" is "mp"; "" when nothing matches. */
export function guessType(title) {
  return TYPE_PATTERNS.find(([, pattern]) => pattern.test(title))?.[0] ?? "";
}

/** The assignment's type; ones saved before types existed get one guessed from their title. */
export function assignmentType(assignment) {
  return assignment.type ?? guessType(assignment.title);
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;
const MAX_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 5000;
// Steps inside an assignment, like an MP's checkpoints: enough for real work, short enough to stay a checklist.
const MAX_STEPS = 20;
const MAX_STEP_LENGTH = 200;
// Time estimates, in hours: from a quarter hour up to a week of full-time work.
const MIN_HOURS = 0.25;
const MAX_HOURS = 40;
const DAY_MS = 24 * 60 * 60 * 1000;

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
  const chosenType = input.type ?? AUTO_TYPE;
  // The estimate is optional: empty means "no estimate", stored as null.
  const hoursText = String(input.hours ?? "").trim();
  const hours = hoursText === "" ? null : Number(hoursText);
  const steps = readSteps(input.steps);
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
    errors.priority = "Choose big, regular or small.";
  }
  if (notes.length > MAX_NOTES_LENGTH) {
    errors.notes = `Keep notes under ${MAX_NOTES_LENGTH} characters.`;
  }
  if (chosenType !== AUTO_TYPE && chosenType !== "" && !TYPES.includes(chosenType)) {
    errors.type = "Choose a type from the list.";
  }
  if (hours !== null && !(hours >= MIN_HOURS && hours <= MAX_HOURS)) {
    errors.hours = `Enter hours between ${MIN_HOURS} and ${MAX_HOURS}, or leave it empty.`;
  }
  if (steps.length > MAX_STEPS) {
    errors.steps = `Keep it to ${MAX_STEPS} steps or fewer.`;
  } else if (steps.some((step) => step.text.length > MAX_STEP_LENGTH)) {
    errors.steps = `Keep each step under ${MAX_STEP_LENGTH} characters.`;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  // "Guess from title" is saved as the guess, so renaming the assignment later doesn't change its type.
  const type = chosenType === AUTO_TYPE ? guessType(title) : chosenType;
  return { ok: true, fields: { title, course, dueDate, dueTime, priority, notes, type, hours, steps } };
}

/**
 * Steps as [{ text, done }], from the form's text (one step per line, all unticked) or from a saved list.
 * Blank lines are dropped.
 */
function readSteps(steps) {
  let list = [];
  if (typeof steps === "string") {
    list = steps.split("\n").map((line) => ({ text: line.trim(), done: false }));
  } else if (Array.isArray(steps)) {
    list = steps.map((step) => ({ text: String(step?.text ?? "").trim(), done: step?.done === true }));
  }
  return list.filter((step) => step.text !== "");
}

/**
 * After editing the steps, keeps the ticks of the ones that are still there: a step whose text is unchanged
 * stays ticked, while new or reworded steps start unticked.
 */
export function keepStepTicks(previousSteps = [], steps) {
  const ticked = previousSteps.filter((step) => step.done).map((step) => step.text);
  return steps.map((step) => {
    const index = ticked.indexOf(step.text);
    if (index === -1) {
      return step;
    }
    ticked.splice(index, 1);
    return { ...step, done: true };
  });
}

/** A new list where step `index` of the assignment with this id is ticked or unticked. */
export function toggleStep(assignments, id, index) {
  return assignments.map((a) =>
    a.id === id ? { ...a, steps: a.steps.map((step, i) => (i === index ? { ...step, done: !step.done } : step)) } : a,
  );
}

/** { done, total } for an assignment's steps, or null if it has none. */
export function stepProgress(assignment) {
  const steps = assignment.steps ?? [];
  return steps.length === 0 ? null : { done: steps.filter((step) => step.done).length, total: steps.length };
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
 * course: only that course ("" for all); hideSmall: hide small reminders; hideDone: hide finished work;
 * search: words that must all appear in the title, course or notes (the list only). While searching,
 * finished work that matches is shown even if hideDone is set, since finding old work is what search is for.
 */
export function filterAssignments(assignments, { course = "", hideSmall = false, hideDone = false, search = "" } = {}) {
  const words = searchWords(search);
  const searching = words.length > 0;
  return assignments.filter(
    (a) =>
      (course === "" || a.course === course) &&
      (!hideSmall || a.priority !== "small") &&
      (searching || !hideDone || !a.done) &&
      words.every((word) => searchableText(a).includes(word)),
  );
}

/**
 * The filters saved in this browser (as JSON), or the usual ones if nothing is saved or it can't be read:
 * { course: "" for all courses, showSmall: true, hideDone: false }.
 */
export function parseSavedFilters(text) {
  const defaults = { course: "", showSmall: true, hideDone: false };
  try {
    const saved = JSON.parse(text ?? "null");
    return {
      course: typeof saved?.course === "string" ? saved.course : defaults.course,
      showSmall: typeof saved?.showSmall === "boolean" ? saved.showSmall : defaults.showSmall,
      hideDone: typeof saved?.hideDone === "boolean" ? saved.hideDone : defaults.hideDone,
    };
  } catch {
    return defaults;
  }
}

/** The separate words of a search, in lowercase, so "MP  Slides" looks for "mp" and "slides". */
export function searchWords(search) {
  return search.toLowerCase().split(/\s+/).filter((word) => word !== "");
}

function searchableText(assignment) {
  return `${assignment.title} ${assignment.course ?? ""} ${assignment.notes ?? ""}`.toLowerCase();
}

/**
 * Unfinished assignments that are overdue or due within the next `hours`, soonest first: the
 * "Due soon" reminder. Every size counts, and the list's filters don't apply, so nothing urgent hides.
 */
export function dueSoon(assignments, now = new Date(), hours = 24) {
  const cutoff = now.getTime() + hours * 60 * 60 * 1000;
  return sortByDue(assignments.filter((a) => !a.done && toDueDate(a.dueDate, a.dueTime).getTime() <= cutoff));
}

/** "~3 h", "~1.5 h", or "~30 min" for under an hour. */
export function formatHours(hours) {
  return hours < 1 ? `~${Math.round(hours * 60)} min` : `~${Math.round(hours * 10) / 10} h`;
}

/** Total estimated hours of the unfinished assignments given (those without an estimate count as 0). */
export function totalHours(assignments) {
  return assignments.reduce((sum, a) => sum + (!a.done && a.hours ? a.hours : 0), 0);
}

/**
 * The workload for the next `days` days: unfinished assignments that are overdue or due by then.
 * Returns { count, hours, unestimated, busiest }, where busiest is { dueDate, hours } for the day
 * with the most estimated hours (null if nothing has an estimate). Every assignment counts,
 * whatever the filters, like the Due soon reminder.
 */
export function workload(assignments, now = new Date(), days = 7) {
  const cutoff = now.getTime() + days * DAY_MS;
  const upcoming = assignments.filter((a) => !a.done && toDueDate(a.dueDate, a.dueTime).getTime() <= cutoff);
  const hoursByDay = new Map();
  for (const a of upcoming.filter((a) => a.hours)) {
    hoursByDay.set(a.dueDate, (hoursByDay.get(a.dueDate) ?? 0) + a.hours);
  }
  let busiest = null;
  for (const [dueDate, hours] of [...hoursByDay].sort(([a], [b]) => a.localeCompare(b))) {
    if (!busiest || hours > busiest.hours) {
      busiest = { dueDate, hours };
    }
  }
  return {
    count: upcoming.length,
    hours: totalHours(upcoming),
    unestimated: upcoming.filter((a) => !a.hours).length,
    busiest,
  };
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
