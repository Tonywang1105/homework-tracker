// Estimates from history: when adding work, a suggested Time needed from the time actually tracked on finished work
// of the same type, in the same course if there is any, else in any course. No DOM, so it can be unit-tested with Node.

import { assignmentType } from "./assignments.js?v=ccd67723";

// The most recent this many matching assignments count, so old habits fade out.
const RECENT = 5;
const MIN_HOURS = 0.25;

/**
 * A suggestion for an assignment of `type` in `course`, from finished work with tracked time (one is enough):
 * { seconds, hours, count, lowSeconds, highSeconds, anyCourse }, where seconds is the middle (median) of the most
 * recent ones, hours is that as a Time needed (to the nearest quarter hour, at least a quarter), and anyCourse says
 * the course had none, so other courses were used. null when nothing matches or no type is known.
 */
export function suggestHours(assignments, { course = "", type = "" }) {
  if (!type) {
    return null;
  }
  const timed = assignments
    .filter((a) => a.done && a.spentSeconds > 0 && assignmentType(a) === type)
    .sort((a, b) => (b.doneAt ?? b.dueDate).localeCompare(a.doneAt ?? a.dueDate));
  const sameCourse = (a) => course.trim() !== "" && a.course.trim().toLowerCase() === course.trim().toLowerCase();
  const inCourse = timed.filter(sameCourse);
  const anyCourse = inCourse.length === 0;
  const recent = (anyCourse ? timed : inCourse).slice(0, RECENT);
  if (recent.length === 0) {
    return null;
  }
  const seconds = recent.map((a) => a.spentSeconds).sort((a, b) => a - b);
  const middle = Math.floor(seconds.length / 2);
  const median = seconds.length % 2 === 1 ? seconds[middle] : Math.round((seconds[middle - 1] + seconds[middle]) / 2);
  return {
    seconds: median,
    hours: Math.max(MIN_HOURS, Math.round((median / 3600) * 4) / 4),
    count: recent.length,
    lowSeconds: seconds[0],
    highSeconds: seconds.at(-1),
    anyCourse,
  };
}
