// Pure logic for the month calendar: which days the grid shows and which assignments fall on each.
// No DOM, so it can be unit-tested with Node, like assignments.js.

import { PRIORITIES, sortByDue } from "./assignments.js?v=ee7cd01c";

const DAYS_PER_WEEK = 7;

/**
 * Order within one day: unfinished big assignments, then unfinished small reminders, then finished
 * work, each by due time. A busy day shows only its first few, so the important ones come first.
 */
function compareWithinDay(a, b) {
  return Number(a.done) - Number(b.done) || PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority);
}

/** "YYYY-MM-DD" for a Date, in local time, matching how assignments store dueDate. */
export function toDateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The { year, month } containing `now`: where the calendar opens, and where Today goes back to. */
export function currentMonth(now = new Date()) {
  return { year: now.getFullYear(), month: now.getMonth() };
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
 * ordered unfinished big, unfinished small, then finished, each by due time.
 */
export function buildMonthGrid({ year, month }, assignments, today = new Date()) {
  const byDay = new Map();
  // sortByDue first, then a stable sort by group, keeps due-time order inside each group.
  for (const assignment of sortByDue(assignments).sort(compareWithinDay)) {
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

/** The short label on the calendar: the course, or the title's first word when there is no course. */
export function calendarTagText(assignment) {
  return assignment.course || assignment.title.split(/\s+/)[0];
}

/**
 * Which of a day's assignments the calendar shows, given that a day has room for `maxLines` lines.
 * When they don't all fit, the last line becomes a "+N more" toggle; an expanded day shows everything.
 * Returns { shown, hiddenCount, hasToggle }.
 */
export function visibleOnDay(dayAssignments, { maxLines, expanded = false }) {
  const fits = dayAssignments.length <= maxLines;
  const hiddenCount = fits || expanded ? 0 : dayAssignments.length - (maxLines - 1);
  return {
    shown: dayAssignments.slice(0, dayAssignments.length - hiddenCount),
    hiddenCount,
    hasToggle: !fits,
  };
}

/** True when every day of a grid week is before today, so the calendar can show it slimmer. */
export function isPastWeek(week, today = new Date()) {
  const todayKey = toDateKey(today);
  // "YYYY-MM-DD" keys sort the same way as the dates they name.
  return week.every((day) => day.key < todayKey);
}

/**
 * The Agenda view: unfinished work from before today, then each of the next `days` days (today first)
 * with what's due that day, soonest first, and how many unfinished assignments are due after that.
 * Returns { overdue, days: [{ key, isToday, isTomorrow, assignments }], laterCount }.
 */
export function buildAgenda(assignments, now = new Date(), days = 14) {
  const keys = Array.from({ length: days }, (_, offset) =>
    toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)),
  );
  const [todayKey] = keys;
  const lastKey = keys.at(-1);
  const sorted = sortByDue(assignments);
  return {
    overdue: sorted.filter((a) => !a.done && a.dueDate < todayKey),
    days: keys.map((key, offset) => ({
      key,
      isToday: offset === 0,
      isTomorrow: offset === 1,
      assignments: sorted.filter((a) => a.dueDate === key),
    })),
    laterCount: sorted.filter((a) => !a.done && a.dueDate > lastKey).length,
  };
}
