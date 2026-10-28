// The weekly review: how this week went (Monday to Sunday, by due date) and how next week looks.

import { sortByDue, toDueDate, totalHours } from "./assignments.js?v=a21bf339";
import { toDateKey } from "./calendar.js?v=a21bf339";

/**
 * This week's and next week's summary, counting by due date (the app doesn't record when work was done).
 * `startPlan` is the start-date plan (id -> { startDate, status }), for what to start this week.
 * Returns {
 *   thisWeek: { start, end, due, done, overdue, coming, big: [{ assignment, status }], hoursDone },
 *   nextWeek: { start, end, due, hours, unestimated, busiest: { dueDate, hours } | null },
 *   startThisWeek: [assignment],
 * }, where status is "done", "overdue" or "coming", and dates are "YYYY-MM-DD".
 */
export function weekReview(assignments, now = new Date(), startPlan = new Map()) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const thisWeek = weekKeys(monday, 0);
  const nextWeek = weekKeys(monday, 7);
  const inWeek = (week) => (a) => a.dueDate >= week.start && a.dueDate <= week.end;

  const dueThisWeek = sortByDue(assignments.filter(inWeek(thisWeek)));
  const status = (a) => (a.done ? "done" : toDueDate(a.dueDate, a.dueTime) < now ? "overdue" : "coming");
  const count = (wanted) => dueThisWeek.filter((a) => status(a) === wanted).length;

  const dueNextWeek = assignments.filter(inWeek(nextWeek));
  const unfinishedNextWeek = dueNextWeek.filter((a) => !a.done);

  return {
    thisWeek: {
      ...thisWeek,
      due: dueThisWeek.length,
      done: count("done"),
      overdue: count("overdue"),
      coming: count("coming"),
      big: dueThisWeek.filter((a) => a.priority === "big").map((assignment) => ({ assignment, status: status(assignment) })),
      // Estimates of finished work; totalHours only counts unfinished work, so these are added up here.
      hoursDone: dueThisWeek.filter((a) => a.done).reduce((sum, a) => sum + (a.hours ?? 0), 0),
    },
    nextWeek: {
      ...nextWeek,
      due: dueNextWeek.length,
      hours: totalHours(unfinishedNextWeek),
      unestimated: unfinishedNextWeek.filter((a) => !a.hours).length,
      busiest: busiestDay(unfinishedNextWeek),
    },
    // Work due after this week that the plan says to start by Sunday, so it isn't left too late.
    startThisWeek: sortByDue(
      assignments.filter((a) => {
        const start = startPlan.get(a.id);
        return !a.done && a.dueDate > thisWeek.end && start && start.startDate <= thisWeek.end;
      }),
    ),
  };
}

function weekKeys(monday, offset) {
  const day = (n) => toDateKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset + n));
  return { start: day(0), end: day(6) };
}

/** The day with the most estimated hours, or null if nothing has an estimate. */
function busiestDay(assignments) {
  const byDay = new Map();
  for (const a of assignments) {
    if (a.hours) {
      byDay.set(a.dueDate, (byDay.get(a.dueDate) ?? 0) + a.hours);
    }
  }
  let busiest = null;
  for (const [dueDate, hours] of byDay) {
    if (!busiest || hours > busiest.hours) {
      busiest = { dueDate, hours };
    }
  }
  return busiest;
}

/**
 * The summary line above the list: unfinished work still due later today, how much unfinished work is
 * past its deadline, and this week's done-out-of-due (the same numbers as the weekly review).
 * Returns { dueToday: [assignment], overdue, weekDone, weekDue }.
 */
export function todaySummary(assignments, now = new Date()) {
  const todayKey = toDateKey(now);
  const unfinished = assignments.filter((a) => !a.done);
  const { thisWeek } = weekReview(assignments, now);
  return {
    dueToday: sortByDue(unfinished.filter((a) => a.dueDate === todayKey && toDueDate(a.dueDate, a.dueTime) >= now)),
    overdue: unfinished.filter((a) => toDueDate(a.dueDate, a.dueTime) < now).length,
    weekDone: thisWeek.done,
    weekDue: thisWeek.due,
  };
}
