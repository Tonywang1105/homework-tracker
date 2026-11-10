// The weekly review: how this week went (Monday to Sunday, by due date) and how next week looks.

import { sortByDue, toDueDate, totalHours } from "./assignments.js?v=a4a2142e";
import { toDateKey } from "./calendar.js?v=a4a2142e";
import { DEFAULT_DAILY_HOURS } from "./plan.js?v=a4a2142e";
import { withTimerStopped } from "./timer.js?v=a4a2142e";

/**
 * This week's and next week's summary, counting by due date (the app doesn't record when work was done).
 * `startPlan` is the start-date plan (id -> { startDate, status }), for what to start this week.
 * Returns {
 *   thisWeek: { start, end, due, done, overdue, coming, big: [{ assignment, status }], hoursDone, tracked },
 *   nextWeek: { start, end, due, hours, unestimated, busiest: { dueDate, hours } | null },
 *   startThisWeek: [assignment],
 * }, where status is "done", "overdue" or "coming", and dates are "YYYY-MM-DD". tracked is
 * { seconds, ratio }: the time tracked on this week's work (a running timer included), and time spent divided by
 * time estimated on finished work that has both (null if none has), so 1.4 means it took 40% longer than planned.
 */
export function weekReview(assignments, now = new Date(), startPlan = new Map()) {
  const monday = mondayOf(now);
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
      tracked: trackedTime(dueThisWeek, now),
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

function trackedTime(assignments, now) {
  const timed = assignments.map((a) => withTimerStopped(a, now));
  const seconds = timed.reduce((sum, a) => sum + (a.spentSeconds ?? 0), 0);
  const compared = timed.filter((a) => a.done && a.hours && a.spentSeconds);
  const estimated = compared.reduce((sum, a) => sum + a.hours * 3600, 0);
  const spent = compared.reduce((sum, a) => sum + a.spentSeconds, 0);
  return { seconds, ratio: estimated > 0 ? spent / estimated : null };
}

/** Midnight on the Monday of `now`'s week. */
/**
 * What "Copy this week" copies: unfinished work from today through next Sunday (the two weeks the review shows),
 * grouped by due day, plus unfinished work already past due. Returns { start, end, overdue, days, count }, where
 * days is [{ date, assignments }] for each day with something due, soonest first, and count is everything listed.
 */
export function weekToCopy(assignments, now = new Date()) {
  const start = toDateKey(now);
  const { end } = weekKeys(mondayOf(now), 7);
  const unfinished = sortByDue(assignments.filter((a) => !a.done));
  const overdue = unfinished.filter((a) => toDueDate(a.dueDate, a.dueTime) < now);
  const coming = unfinished.filter((a) => toDueDate(a.dueDate, a.dueTime) >= now && a.dueDate <= end);
  const days = [];
  for (const assignment of coming) {
    if (days.at(-1)?.date !== assignment.dueDate) {
      days.push({ date: assignment.dueDate, assignments: [] });
    }
    days.at(-1).assignments.push(assignment);
  }
  return { start, end, overdue, days, count: overdue.length + coming.length };
}

/** The Monday that starts this week, as "YYYY-MM-DD": the weekly banner is remembered as seen for that week. */
export function weekStartKey(now = new Date()) {
  return toDateKey(mondayOf(now));
}

/**
 * The weekly planning banner: what's left this week, from today to Sunday. Returns null when nothing unfinished is
 * due in that time and nothing is overdue, so the banner doesn't appear just to say so. Otherwise
 * { end, count, hours, overdue, busiest, shortDays }: end is Sunday's date, count and hours are the unfinished work
 * due today to Sunday (hours only where estimated), overdue counts unfinished work already past due, busiest is
 * { dueDate, hours } for the day with the most estimated hours (null with fewer than two days of estimated work),
 * and shortDays are the days left whose hours (`limit`, a function of the date) are under `usualHours`, as
 * [{ date, hours }].
 */
export function weekAhead(assignments, now = new Date(), limit = () => DEFAULT_DAILY_HOURS, usualHours = DEFAULT_DAILY_HOURS) {
  const today = toDateKey(now);
  const { end } = weekKeys(mondayOf(now), 0);
  const unfinished = assignments.filter((a) => !a.done);
  const overdue = unfinished.filter((a) => toDueDate(a.dueDate, a.dueTime) < now).length;
  const left = unfinished.filter((a) => a.dueDate >= today && a.dueDate <= end && toDueDate(a.dueDate, a.dueTime) >= now);
  if (left.length === 0 && overdue === 0) {
    return null;
  }
  const hoursByDay = new Map();
  for (const a of left.filter((a) => a.hours)) {
    hoursByDay.set(a.dueDate, (hoursByDay.get(a.dueDate) ?? 0) + a.hours);
  }
  const days = [...hoursByDay].sort(([a], [b]) => a.localeCompare(b));
  const most = days.reduce((best, day) => (best === null || day[1] > best[1] ? day : best), null);
  const shortDays = [];
  for (let date = today; date <= end; date = nextDay(date)) {
    if (limit(date) < usualHours) {
      shortDays.push({ date, hours: limit(date) });
    }
  }
  return {
    end,
    count: left.length,
    hours: totalHours(left),
    overdue,
    busiest: days.length >= 2 ? { dueDate: most[0], hours: most[1] } : null,
    shortDays,
  };
}

function nextDay(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return toDateKey(new Date(year, month - 1, day + 1));
}

function mondayOf(now) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
}

function weekKeys(monday, offset) {
  const day = (n) => toDateKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset + n));
  return { start: day(0), end: day(6) };
}

/**
 * What was actually finished this week (Monday to Sunday), by when it was marked done rather than when it was due:
 * { total, big, byDay: [{ date, count }] } with a day for each of Monday to Sunday. Work finished before finish
 * times were recorded has no doneAt, so it isn't counted.
 */
export function finishedThisWeek(assignments, now = new Date()) {
  const monday = mondayOf(now);
  const days = Array.from({ length: 7 }, (_, n) => toDateKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + n)));
  const finished = assignments.filter((a) => a.done && a.doneAt && days.includes(doneDay(a)));
  return {
    total: finished.length,
    big: finished.filter((a) => a.priority === "big").length,
    byDay: days.map((date) => ({ date, count: finished.filter((a) => doneDay(a) === date).length })),
  };
}

/**
 * Days in a row with at least one thing finished, counting back from today, or from yesterday if nothing is
 * finished yet today (so the streak doesn't look broken first thing in the morning). Small reminders count too.
 */
export function doneStreak(assignments, now = new Date()) {
  const finishedDays = new Set(assignments.filter((a) => a.done && a.doneAt).map(doneDay));
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!finishedDays.has(toDateKey(day))) {
    day.setDate(day.getDate() - 1);
  }
  let streak = 0;
  while (finishedDays.has(toDateKey(day))) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

/** The local day ("YYYY-MM-DD") an assignment was marked done. */
function doneDay(assignment) {
  return toDateKey(new Date(assignment.doneAt));
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
    streak: doneStreak(assignments, now),
  };
}
