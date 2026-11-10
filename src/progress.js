// Course progress by grade weight: how much of a course's grade (the Worth entered on its assignments) is done,
// overdue, due soon and due later, for the line and bar on a course page. No DOM, so it can be unit-tested with Node.

import { toDueDate } from "./assignments.js?v=a4a2142e";
import { toDateKey } from "./calendar.js?v=a4a2142e";

// "Due soon" on the course page: due on or before the day this many days from today.
export const SOON_DAYS = 14;

/**
 * A course's grade weight, split up: { entered, done, overdue, soon, later } in percent of the grade, each rounded
 * to one decimal. Only assignments with a Worth count; entered is their total, which is often under 100 because not
 * every weight has been entered. Returns null when no assignment in the course has a Worth.
 */
export function courseProgress(assignments, course, now = new Date()) {
  const weighted = assignments.filter((a) => a.course === course && a.weight > 0);
  if (weighted.length === 0) {
    return null;
  }
  const soonEnd = toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + SOON_DAYS));
  const parts = { done: 0, overdue: 0, soon: 0, later: 0 };
  for (const a of weighted) {
    const overdue = toDueDate(a.dueDate, a.dueTime) < now;
    const part = a.done ? "done" : overdue ? "overdue" : a.dueDate <= soonEnd ? "soon" : "later";
    parts[part] += a.weight;
  }
  const round = (n) => Math.round(n * 10) / 10;
  return {
    entered: round(weighted.reduce((sum, a) => sum + a.weight, 0)),
    done: round(parts.done),
    overdue: round(parts.overdue),
    soon: round(parts.soon),
    later: round(parts.later),
  };
}
