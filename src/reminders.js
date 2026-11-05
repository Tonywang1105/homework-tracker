// Reminders: which unfinished work is close enough to its deadline for a notification (big work a day before,
// everything else an hour before, like the calendar export), each reminded once. No DOM, so it can be unit-tested.

import { toDueDate } from "./assignments.js?v=7b6e7ff5";

const HOUR_MS = 60 * 60 * 1000;
// Remembered reminders older than this are forgotten, so the saved list doesn't grow all semester.
const KEEP_SENT_MS = 3 * 24 * HOUR_MS;

/** How long before the deadline an assignment is reminded: a day for big work, an hour for the rest. */
export function reminderLead(assignment) {
  return assignment.priority === "big" ? 24 * HOUR_MS : HOUR_MS;
}

/** What identifies one reminder: the assignment and its deadline, so moving the deadline reminds again. */
export function reminderKey(assignment) {
  return `${assignment.id}@${assignment.dueDate}T${assignment.dueTime}`;
}

/**
 * The unfinished assignments to remind about now: due in the future, within their lead time, and not reminded yet
 * (`sent` is a Set of reminder keys). Soonest first.
 */
export function dueReminders(assignments, sent, now = new Date()) {
  return assignments
    .filter((a) => !a.done)
    .map((assignment) => ({ assignment, left: toDueDate(assignment.dueDate, assignment.dueTime) - now }))
    .filter(({ assignment, left }) => left > 0 && left <= reminderLead(assignment) && !sent.has(reminderKey(assignment)))
    .sort((a, b) => a.left - b.left)
    .map(({ assignment }) => assignment);
}

/** The saved reminder keys, without ones whose deadline passed more than three days ago. */
export function readSentReminders(text, now = new Date()) {
  let saved;
  try {
    saved = JSON.parse(text ?? "[]");
  } catch {
    saved = [];
  }
  if (!Array.isArray(saved)) {
    return new Set();
  }
  return new Set(
    saved.filter((key) => {
      const due = typeof key === "string" ? new Date(key.split("@")[1]) : null;
      return due && !Number.isNaN(due.getTime()) && now - due < KEEP_SENT_MS;
    }),
  );
}
