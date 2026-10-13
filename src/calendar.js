// Pure logic for the month calendar: which days the grid shows and which assignments fall on each.
// No DOM, so it can be unit-tested with Node, like assignments.js.

import { sortByDue } from "./assignments.js";

const DAYS_PER_WEEK = 7;

/** "YYYY-MM-DD" for a Date, in local time, matching how assignments store dueDate. */
export function toDateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The { year, month } that is `offset` months away (month is 0-11, like Date). */
export function shiftMonth({ year, month }, offset) {
  const shifted = new Date(year, month + offset, 1);
  return { year: shifted.getFullYear(), month: shifted.getMonth() };
}

/**
 * Builds the weeks shown for one month, Sunday first. The grid starts on the Sunday on or before
 * the 1st and ends on the Saturday on or after the last day, so it has 4 to 6 full weeks.
 * Each day is { key, dayOfMonth, inMonth, isToday, assignments }, with that day's assignments
 * sorted by due time (big first on ties).
 */
export function buildMonthGrid({ year, month }, assignments, today = new Date()) {
  const byDay = new Map();
  for (const assignment of sortByDue(assignments)) {
    const dayAssignments = byDay.get(assignment.dueDate) ?? [];
    dayAssignments.push(assignment);
    byDay.set(assignment.dueDate, dayAssignments);
  }

  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  const gridEnd = new Date(year, month + 1, DAYS_PER_WEEK - 1 - lastOfMonth.getDay());
  const todayKey = toDateKey(today);

  const weeks = [];
  // Step by calendar day (not by 24 hours) so daylight-saving changes cannot skip or repeat a day.
  for (let day = gridStart; day <= gridEnd; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
    if (day.getDay() === 0) {
      weeks.push([]);
    }
    const key = toDateKey(day);
    weeks.at(-1).push({
      key,
      dayOfMonth: day.getDate(),
      inMonth: day.getMonth() === month,
      isToday: key === todayKey,
      assignments: byDay.get(key) ?? [],
    });
  }
  return weeks;
}
