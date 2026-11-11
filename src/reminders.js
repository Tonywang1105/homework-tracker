// Reminders: which unfinished work is close enough to its deadline for a notification (big work a day before,
// regular work a day and an hour before, small reminders an hour before), each reminder sent once. No DOM, so it can
// be unit-tested.

import { toDueDate } from "./assignments.js?v=7a4e1cba";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// Remembered reminders older than this are forgotten, so the saved list doesn't grow all semester.
const KEEP_SENT_MS = 3 * 24 * HOUR_MS;

/** How long before the deadline an assignment's last reminder comes: a day for big work, an hour for the rest. */
export function reminderLead(assignment) {
  return assignment.priority === "big" ? DAY_MS : HOUR_MS;
}

/**
 * An assignment's reminders, earliest first, as { lead, key }: big work a day before; regular work a day before
 * and an hour before (Yihao's choice, since forgetting to check left too little time); small reminders only an hour
 * before, so they don't become noise. The last one keeps the key reminders always had, so none repeat after an update.
 */
export function remindersFor(assignment) {
  const last = { lead: reminderLead(assignment), key: reminderKey(assignment) };
  return assignment.priority === "regular" ? [{ lead: DAY_MS, key: `${reminderKey(assignment)}|day` }, last] : [last];
}

/** What identifies one reminder: the assignment and its deadline, so moving the deadline reminds again. */
export function reminderKey(assignment) {
  return `${assignment.id}@${assignment.dueDate}T${assignment.dueTime}`;
}

/**
 * The reminders to send now, soonest deadline first, as [{ assignment, key }]: unfinished work due in the future whose
 * latest reminder window has started and that reminder isn't sent yet (`sent` is a Set of keys). Only the latest
 * window counts, so work opened an hour before its deadline gets the hour reminder, not the day one as well.
 */
export function dueReminders(assignments, sent, now = new Date()) {
  return assignments
    .filter((a) => !a.done)
    .map((assignment) => ({ assignment, left: toDueDate(assignment.dueDate, assignment.dueTime) - now }))
    .filter(({ left }) => left > 0)
    .map(({ assignment, left }) => ({ assignment, left, current: remindersFor(assignment).filter((r) => left <= r.lead).at(-1) }))
    .filter(({ current }) => current && !sent.has(current.key))
    .sort((a, b) => a.left - b.left)
    .map(({ assignment, current }) => ({ assignment, key: current.key }));
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
      // "id@2026-11-04T15:30", or with "|day" after it for a day-before reminder.
      const due = typeof key === "string" ? new Date(key.split("@")[1]?.split("|")[0]) : null;
      return due && !Number.isNaN(due.getTime()) && now - due < KEEP_SENT_MS;
    }),
  );
}
