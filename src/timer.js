// Time spent: a Start/Stop timer on each assignment. No DOM, so it can be unit-tested with Node.
// An assignment keeps its total in spentSeconds, and while its timer runs, timerStartedAt (an ISO time).
// Saving the start time rather than a ticking count is what lets a timer survive a reload or show on another device.

// A timer left running overnight shouldn't add a whole night, so one session counts for at most 12 hours.
export const MAX_SESSION_SECONDS = 12 * 60 * 60;

/** Seconds since this assignment's timer started (0 if it isn't running), at most MAX_SESSION_SECONDS. */
export function sessionSeconds(assignment, now = new Date()) {
  if (!assignment.timerStartedAt) {
    return 0;
  }
  // Another device's clock can be a little ahead, so a start "in the future" counts as just now.
  const seconds = Math.floor((now - new Date(assignment.timerStartedAt)) / 1000);
  return Number.isFinite(seconds) ? Math.min(Math.max(seconds, 0), MAX_SESSION_SECONDS) : 0;
}

/** The assignment with its timer stopped and the session added to its total (unchanged if it wasn't running). */
export function withTimerStopped(assignment, now = new Date()) {
  if (!assignment.timerStartedAt) {
    return assignment;
  }
  const { timerStartedAt, ...rest } = assignment;
  return { ...rest, spentSeconds: (assignment.spentSeconds ?? 0) + sessionSeconds(assignment, now) };
}

/** Starts this assignment's timer. Only one runs at a time, so any other running timer is stopped first. */
export function startTimer(assignments, id, now = new Date()) {
  return assignments.map((a) => (a.id === id ? { ...a, timerStartedAt: now.toISOString() } : withTimerStopped(a, now)));
}

/** Stops this assignment's timer, adding the session to its total. */
export function stopTimer(assignments, id, now = new Date()) {
  return assignments.map((a) => (a.id === id ? withTimerStopped(a, now) : a));
}

/** "4:05" or "1:02:09": a running timer's clock. */
export function formatClock(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = String(seconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}` : `${minutes}:${secs}`;
}

/** "under 1 min", "25 min" or "1.5 h": a total of time spent. */
export function formatSpent(seconds) {
  if (seconds < 60) {
    return "under 1 min";
  }
  if (seconds < 60 * 60) {
    return `${Math.round(seconds / 60)} min`;
  }
  return `${Math.round(seconds / 360) / 10} h`;
}

/**
 * The time-spent tag, or null if no time has been tracked: "spent 40 min of ~3 h" while unfinished,
 * "took 4.5 h of ~3 h" once done, without "of ..." when there's no estimate.
 */
export function spentText(assignment) {
  const seconds = assignment.spentSeconds ?? 0;
  if (seconds <= 0) {
    return null;
  }
  const estimate = assignment.hours ? ` of ~${formatSpent(assignment.hours * 3600)}` : "";
  return `${assignment.done ? "took" : "spent"} ${formatSpent(seconds)}${estimate}`;
}

/** A saved spentSeconds, or undefined if it isn't a sensible number (used when restoring a backup). */
export function readSpentSeconds(value) {
  return Number.isInteger(value) && value > 0 ? value : undefined;
}
