// "When to start": using time estimates, the latest day to start each assignment so that no day needs
// more than a daily limit of homework. No DOM, so it can be unit-tested with Node.

import { toDueDate } from "./assignments.js?v=7a4e1cba";
import { toDateKey } from "./calendar.js?v=7a4e1cba";
import { sessionSeconds } from "./timer.js?v=7a4e1cba";

export const DEFAULT_DAILY_HOURS = 3;
const MIN_DAILY_HOURS = 0.5;
const MAX_DAILY_HOURS = 16;
// Something due at or after this time can still be worked on that day; earlier, it has to be done the day before.
const EVENING = "17:00";

function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return toDateKey(new Date(year, month - 1, day + days));
}

/** The day of the week of a "YYYY-MM-DD" date, 0 for Sunday to 6 for Saturday (like Date.getDay). */
export function weekdayOf(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

/**
 * The hours of homework planned for each day: `weekdayHours[weekday]` where one is set (0 is a day off), else
 * `dailyHours`. Returns a function from a "YYYY-MM-DD" date to its hours, which planStarts and todayPlan accept
 * in place of a single number.
 */
export function dailyLimit(dailyHours, weekdayHours = []) {
  return (dateKey) => weekdayHours[weekdayOf(dateKey)] ?? dailyHours;
}

/** A daily limit as a function of the date, whether it was given as one number or by dailyLimit. */
function asLimit(dailyHours) {
  return typeof dailyHours === "function" ? dailyHours : () => dailyHours;
}

/** The last day there's time to work on an assignment: its due day if due in the evening, else the day before. */
export function lastWorkDay(assignment) {
  return assignment.dueTime >= EVENING ? assignment.dueDate : addDays(assignment.dueDate, -1);
}

/**
 * The hours of an assignment's estimate still to do: the estimate minus the time tracked on it (a running
 * timer included), to the nearest quarter hour. 0 once the tracked time reaches the estimate.
 */
export function hoursLeft(assignment, now = new Date()) {
  const spent = ((assignment.spentSeconds ?? 0) + sessionSeconds(assignment, now)) / 3600;
  return Math.max(Math.round(((assignment.hours ?? 0) - spent) * 4) / 4, 0);
}

/**
 * Plans backwards from the latest due date: each assignment takes the latest free hours before it is due,
 * at most `dailyHours` per day (one number, or a function of the date from dailyLimit), so busy weeks push start
 * dates earlier. Only unfinished assignments with
 * hours left (the estimate minus time tracked) that aren't due yet are planned.
 * Returns a Map from assignment id to { startDate, status, shortHours, todayHours, hoursLeft, days }, where status is
 * "later" (start on startDate), "today" (startDate is today or earlier), or "behind" (even starting
 * today, shortHours won't fit at the daily limit), todayHours is how much of it is planned for today, and days
 * is every planned day, earliest first, as [{ date, hours }].
 */
export function planStarts(assignments, now = new Date(), dailyHours = DEFAULT_DAILY_HOURS) {
  const today = toDateKey(now);
  const limit = asLimit(dailyHours);
  const planned = assignments
    .filter((a) => !a.done && hoursLeft(a, now) > 0 && toDueDate(a.dueDate, a.dueTime) > now)
    .sort((a, b) => toDueDate(b.dueDate, b.dueTime) - toDueDate(a.dueDate, a.dueTime) || a.id.localeCompare(b.id));
  const used = new Map();
  const plan = new Map();

  for (const assignment of planned) {
    let remaining = hoursLeft(assignment, now);
    let todayHours = 0;
    const days = [];
    let day = lastWorkDay(assignment);
    let startDate = day < today ? today : day;
    while (remaining > 0 && day >= today) {
      const free = limit(day) - (used.get(day) ?? 0);
      if (free > 0) {
        const taken = Math.min(free, remaining);
        used.set(day, (used.get(day) ?? 0) + taken);
        remaining -= taken;
        startDate = day;
        days.unshift({ date: day, hours: taken });
        if (day === today) {
          todayHours = taken;
        }
      }
      day = addDays(day, -1);
    }
    const status = remaining > 0 ? "behind" : startDate <= today ? "today" : "later";
    plan.set(assignment.id, {
      startDate: status === "later" ? startDate : today,
      status,
      shortHours: remaining,
      todayHours,
      hoursLeft: hoursLeft(assignment, now),
      days,
    });
  }
  return plan;
}

/**
 * Today's plan, in order: overdue work, work due today, what the plan needs started today ("planned"), and
 * then, if that leaves room under today's `dailyHours` (a number, or a function of the date), the next work in line ("ahead"), so the day is filled rather than
 * only the bare minimum. Grade weights decide what comes first among planned work and among work to get ahead on,
 * and which gets the spare time: heavier first (see weightOf); deadlines still come first, so overdue and due-today
 * work lead. Each entry is { assignment, reason, todayHours, hoursLeft }, the hours being 0 for work the plan
 * doesn't cover (no estimate, or overdue). Finished work is left out.
 */
export function todayPlan(assignments, plan, now = new Date(), dailyHours = DEFAULT_DAILY_HOURS) {
  const today = toDateKey(now);
  const todayHours = new Map([...plan].map(([id, entry]) => [id, entry.todayHours]));
  let free = asLimit(dailyHours)(today) - [...todayHours.values()].reduce((sum, hours) => sum + hours, 0);
  const weight = weightOf(assignments);
  const byStart = assignments
    .filter((a) => plan.has(a.id))
    .sort(
      (a, b) =>
        weight(b) - weight(a) ||
        plan.get(a.id).startDate.localeCompare(plan.get(b.id).startDate) ||
        toDueDate(a.dueDate, a.dueTime) - toDueDate(b.dueDate, b.dueTime),
    );
  for (const assignment of byStart) {
    const { hoursLeft } = plan.get(assignment.id);
    const extra = Math.min(free, hoursLeft - todayHours.get(assignment.id));
    if (extra > 0) {
      todayHours.set(assignment.id, todayHours.get(assignment.id) + extra);
      free -= extra;
    }
  }

  const reasonFor = (a) => {
    if (toDueDate(a.dueDate, a.dueTime) < now) {
      return "overdue";
    }
    if (a.dueDate === today) {
      return "due today";
    }
    if (plan.get(a.id)?.todayHours > 0) {
      return "planned";
    }
    return todayHours.get(a.id) > 0 ? "ahead" : null;
  };
  const order = ["overdue", "due today", "planned", "ahead"];
  return assignments
    .filter((a) => !a.done && reasonFor(a))
    .map((assignment) => ({
      assignment,
      reason: reasonFor(assignment),
      todayHours: todayHours.get(assignment.id) ?? 0,
      hoursLeft: plan.get(assignment.id)?.hoursLeft ?? 0,
    }))
    .sort(
      (a, b) =>
        order.indexOf(a.reason) - order.indexOf(b.reason) ||
        (a.reason === "planned" || a.reason === "ahead" ? weight(b.assignment) - weight(a.assignment) : 0) ||
        toDueDate(a.assignment.dueDate, a.assignment.dueTime) - toDueDate(b.assignment.dueDate, b.assignment.dueTime),
    );
}

/**
 * A function giving each assignment's grade weight for ordering. Work without one counts as the average weight of
 * the unfinished work that has one (Yihao's choice: an empty box shouldn't push work down), so with no weights at
 * all, every assignment counts the same and nothing changes.
 */
function weightOf(assignments) {
  const weights = assignments.filter((a) => !a.done && a.weight > 0).map((a) => a.weight);
  const average = weights.length > 0 ? weights.reduce((sum, w) => sum + w, 0) / weights.length : 0;
  return (assignment) => (assignment.weight > 0 ? assignment.weight : average);
}

/**
 * Which day each step is for, so an exam's topics (or any assignment's steps) are spread over the days the plan
 * gives it. Returns an array the length of assignment.steps: a "YYYY-MM-DD" date for each unticked step, null for
 * ticked ones, or all null if the assignment isn't planned (no estimate, finished, or past due).
 * Today gets a share of the unticked steps in proportion to `todayHours` (the hours Today's plan gives it, which
 * can be more than the plan's own share when getting ahead), and the rest are spread over the plan's later days in
 * proportion to their hours, in order. Worked out afresh each time, so ticking a step re-spreads the others.
 */
export function stepDays(assignment, planEntry, todayHours, now = new Date()) {
  const steps = assignment.steps ?? [];
  const result = steps.map(() => null);
  const open = steps.flatMap((step, index) => (step.done ? [] : [index]));
  if (!planEntry || open.length === 0 || planEntry.hoursLeft <= 0) {
    return result;
  }
  const today = toDateKey(now);
  const todayCount = todayHours > 0 ? Math.min(Math.max(Math.round((open.length * todayHours) / planEntry.hoursLeft), 1), open.length) : 0;
  const later = planEntry.days.filter((day) => day.date > today);
  const laterHours = later.reduce((sum, day) => sum + day.hours, 0);
  open.forEach((stepIndex, k) => {
    if (k < todayCount) {
      result[stepIndex] = today;
      return;
    }
    if (laterHours === 0) {
      // Nothing planned after today (due tomorrow morning, or behind): the rest is today's too.
      result[stepIndex] = today;
      return;
    }
    // The middle of this step's share of the later hours falls on one of the later days.
    const rest = open.length - todayCount;
    const position = ((k - todayCount + 0.5) / rest) * laterHours;
    let covered = 0;
    result[stepIndex] = later.find((day) => (covered += day.hours) >= position)?.date ?? later.at(-1).date;
  });
  return result;
}

/**
 * The hours for each day of the week, saved as a list of 7 (Sunday first), each a number of hours or null for "the
 * usual hours a day". Anything unreadable or out of range counts as null, so a damaged setting falls back safely.
 */
export function parseWeekdayHours(text) {
  let saved = null;
  try {
    saved = JSON.parse(text ?? "null");
  } catch {
    saved = null;
  }
  return Array.from({ length: 7 }, (_, weekday) => {
    const hours = Array.isArray(saved) ? saved[weekday] : null;
    return typeof hours === "number" && hours >= 0 && hours <= MAX_DAILY_HOURS ? hours : null;
  });
}

/** One weekday's box: null when empty (use the usual hours), the hours if 0 to 16, or undefined if it isn't valid. */
export function parseWeekdayBox(text) {
  const trimmed = String(text ?? "").trim();
  if (trimmed === "") {
    return null;
  }
  const hours = Number(trimmed);
  return Number.isFinite(hours) && hours >= 0 && hours <= MAX_DAILY_HOURS ? hours : undefined;
}

/** A daily limit from the settings box, or null if it isn't a sensible number of hours. */
export function parseDailyHours(text) {
  const hours = Number(String(text ?? "").trim());
  return String(text ?? "").trim() !== "" && hours >= MIN_DAILY_HOURS && hours <= MAX_DAILY_HOURS ? hours : null;
}
