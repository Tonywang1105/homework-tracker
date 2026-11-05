// The end-of-semester wrap-up: what was finished this term, time tracked per course, the longest streak and how
// estimates compared, and which finished work the Archive button would clear. No DOM, so it can be unit-tested.

import { toDateKey } from "./calendar.js?v=7b6e7ff5";

/**
 * The term `now` falls in, by date: spring (January to May), summer (June and July) or fall (August to December).
 * Returns { name, year, start, end } with dates as "YYYY-MM-DD".
 */
export function termOf(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const [name, startMonth, endMonth] = month <= 4 ? ["spring", 0, 4] : month <= 6 ? ["summer", 5, 6] : ["fall", 7, 11];
  return {
    name,
    year,
    start: toDateKey(new Date(year, startMonth, 1)),
    end: toDateKey(new Date(year, endMonth + 1, 0)),
  };
}

/**
 * The term's wrap-up, from assignments due in it: { term, finished, big, trackedSeconds, perCourse, longestStreak,
 * ratio, archiveIds }. perCourse is [{ course, seconds }] for courses with tracked time, most first; longestStreak is
 * the most days in a row with something finished; ratio is time spent over time estimated on finished work that has
 * both (null if none has); archiveIds are the finished assignments the Archive button would clear.
 */
export function semesterSummary(assignments, now = new Date()) {
  const term = termOf(now);
  const inTerm = assignments.filter((a) => a.dueDate >= term.start && a.dueDate <= term.end);
  const finished = inTerm.filter((a) => a.done);

  const byCourse = new Map();
  for (const a of inTerm.filter((a) => a.spentSeconds > 0)) {
    const course = a.course || "";
    byCourse.set(course, (byCourse.get(course) ?? 0) + a.spentSeconds);
  }
  const perCourse = [...byCourse].map(([course, seconds]) => ({ course, seconds })).sort((a, b) => b.seconds - a.seconds);

  const compared = finished.filter((a) => a.hours && a.spentSeconds);
  const estimated = compared.reduce((sum, a) => sum + a.hours * 3600, 0);
  const spent = compared.reduce((sum, a) => sum + a.spentSeconds, 0);

  return {
    term,
    finished: finished.length,
    big: finished.filter((a) => a.priority === "big").length,
    trackedSeconds: perCourse.reduce((sum, entry) => sum + entry.seconds, 0),
    perCourse,
    longestStreak: longestRun(finished.filter((a) => a.doneAt).map((a) => toDateKey(new Date(a.doneAt)))),
    ratio: estimated > 0 ? spent / estimated : null,
    archiveIds: finished.map((a) => a.id),
  };
}

/** The most consecutive days among `days` ("YYYY-MM-DD", repeats allowed). */
function longestRun(days) {
  const sorted = [...new Set(days)].sort();
  let longest = 0;
  let run = 0;
  sorted.forEach((day, index) => {
    const previous = sorted[index - 1];
    const [year, month, date] = day.split("-").map(Number);
    const dayBefore = toDateKey(new Date(year, month - 1, date - 1));
    run = previous === dayBefore ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  return longest;
}
