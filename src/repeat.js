// Repeating assignments: one form entry becomes a series of separate weekly or every-other-week
// assignments. No DOM, so it can be unit-tested with Node, like assignments.js.

import { createAssignment } from "./assignments.js?v=0e407b5c";
import { toDateKey } from "./calendar.js?v=0e407b5c";

// The Repeat choices in the form, as days between copies. "" means the assignment doesn't repeat.
export const REPEAT_DAYS = { "": 0, weekly: 7, biweekly: 14 };
export const MAX_REPEATS = 20;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** "Quiz 5" counts up to "Quiz 6" after one step; a title that doesn't end in a number stays the same. */
export function numberedTitle(title, steps) {
  const match = /^(.*?)(\d+)$/.exec(title);
  return match ? `${match[1]}${Number(match[2]) + steps}` : title;
}

/** Due dates from `firstDate` through `untilDate`, `everyDays` apart (calendar days, so clock changes don't matter). */
export function repeatDates(firstDate, everyDays, untilDate) {
  const [year, month, day] = firstDate.split("-").map(Number);
  const dates = [];
  for (let offset = 0; ; offset += everyDays) {
    const key = toDateKey(new Date(year, month - 1, day + offset));
    if (key > untilDate) {
      return dates;
    }
    dates.push(key);
  }
}

/**
 * Checks the Repeat part of the form. `repeat` is a REPEAT_DAYS key; `untilDate` is "YYYY-MM-DD".
 * Returns { ok: true, dates } (just the one date when not repeating) or { ok: false, errors }.
 */
export function validateRepeat({ repeat = "", untilDate = "" }, dueDate) {
  if (!(repeat in REPEAT_DAYS)) {
    return { ok: false, errors: { repeat: "Choose how often it repeats." } };
  }
  if (repeat === "") {
    return { ok: true, dates: [dueDate] };
  }
  if (!DATE_PATTERN.test(untilDate)) {
    return { ok: false, errors: { untilDate: "Pick the last date it repeats." } };
  }
  if (untilDate < dueDate) {
    return { ok: false, errors: { untilDate: "Pick a date after the first due date." } };
  }
  const dates = repeatDates(dueDate, REPEAT_DAYS[repeat], untilDate);
  if (dates.length > MAX_REPEATS) {
    return { ok: false, errors: { untilDate: `That makes ${dates.length} copies; pick an earlier date (at most ${MAX_REPEATS}).` } };
  }
  return { ok: true, dates };
}

/**
 * One assignment per date, all sharing a seriesId so the whole series can be undone together.
 * Titles that end in a number count up: Quiz 5, Quiz 6, Quiz 7...
 */
export function createSeries(fields, dates, { now = new Date(), seriesId = crypto.randomUUID() } = {}) {
  return dates.map((dueDate, index) => ({
    ...createAssignment({ ...fields, title: numberedTitle(fields.title, index), dueDate }, { now }),
    ...(dates.length > 1 ? { seriesId } : {}),
  }));
}
