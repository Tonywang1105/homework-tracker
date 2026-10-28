// "When to start": using time estimates, the latest day to start each assignment so that no day needs
// more than a daily limit of homework. No DOM, so it can be unit-tested with Node.

import { toDueDate } from "./assignments.js?v=ebc36942";
import { toDateKey } from "./calendar.js?v=ebc36942";

export const DEFAULT_DAILY_HOURS = 3;
const MIN_DAILY_HOURS = 0.5;
const MAX_DAILY_HOURS = 16;
// Something due at or after this time can still be worked on that day; earlier, it has to be done the day before.
const EVENING = "17:00";

function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return toDateKey(new Date(year, month - 1, day + days));
}

/** The last day there's time to work on an assignment: its due day if due in the evening, else the day before. */
export function lastWorkDay(assignment) {
  return assignment.dueTime >= EVENING ? assignment.dueDate : addDays(assignment.dueDate, -1);
}

/**
 * Plans backwards from the latest due date: each assignment takes the latest free hours before it is due,
 * at most `dailyHours` per day, so busy weeks push start dates earlier. Only unfinished assignments with
 * an estimate that aren't due yet are planned.
 * Returns a Map from assignment id to { startDate, status, shortHours }, where status is
 * "later" (start on startDate), "today" (startDate is today or earlier), or "behind" (even starting
 * today, shortHours won't fit at the daily limit).
 */
export function planStarts(assignments, now = new Date(), dailyHours = DEFAULT_DAILY_HOURS) {
  const today = toDateKey(now);
  const planned = assignments
    .filter((a) => !a.done && a.hours > 0 && toDueDate(a.dueDate, a.dueTime) > now)
    .sort((a, b) => toDueDate(b.dueDate, b.dueTime) - toDueDate(a.dueDate, a.dueTime) || a.id.localeCompare(b.id));
  const used = new Map();
  const plan = new Map();

  for (const assignment of planned) {
    let remaining = assignment.hours;
    let day = lastWorkDay(assignment);
    let startDate = day < today ? today : day;
    while (remaining > 0 && day >= today) {
      const free = dailyHours - (used.get(day) ?? 0);
      if (free > 0) {
        const taken = Math.min(free, remaining);
        used.set(day, (used.get(day) ?? 0) + taken);
        remaining -= taken;
        startDate = day;
      }
      day = addDays(day, -1);
    }
    const status = remaining > 0 ? "behind" : startDate <= today ? "today" : "later";
    plan.set(assignment.id, { startDate: status === "later" ? startDate : today, status, shortHours: remaining });
  }
  return plan;
}

/** A daily limit from the settings box, or null if it isn't a sensible number of hours. */
export function parseDailyHours(text) {
  const hours = Number(String(text ?? "").trim());
  return String(text ?? "").trim() !== "" && hours >= MIN_DAILY_HOURS && hours <= MAX_DAILY_HOURS ? hours : null;
}
