// Focus blocks: the timer in blocks of work with breaks in between (25 and 5 minutes unless changed).
// No DOM, so it can be unit-tested with Node; src/ui/focus.js chimes and shows the focus bar.

import { formatClock, sessionSeconds, stopTimer } from "./timer.js?v=baf0f7be";

export const DEFAULT_FOCUS = { on: false, workMinutes: 25, breakMinutes: 5 };
const WORK_LIMITS = [1, 120];
const BREAK_LIMITS = [1, 60];

/** Focus settings saved on this device, with anything missing or out of range back to the default. */
export function parseFocusSettings(text) {
  let saved;
  try {
    saved = JSON.parse(text ?? "{}");
  } catch {
    saved = {};
  }
  return {
    on: saved?.on === true,
    workMinutes: wholeMinutes(saved?.workMinutes, WORK_LIMITS) ?? DEFAULT_FOCUS.workMinutes,
    breakMinutes: wholeMinutes(saved?.breakMinutes, BREAK_LIMITS) ?? DEFAULT_FOCUS.breakMinutes,
  };
}

/** A block length typed in a box: whole minutes from 1 to 120, or null. */
export function parseWorkMinutes(text) {
  return wholeMinutes(Number(String(text).trim()), WORK_LIMITS);
}

/** A break length typed in a box: whole minutes from 1 to 60, or null. */
export function parseBreakMinutes(text) {
  return wholeMinutes(Number(String(text).trim()), BREAK_LIMITS);
}

function wholeMinutes(value, [min, max]) {
  return Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/** When the running timer's block ends. */
export function blockEnd(assignment, focus) {
  return new Date(new Date(assignment.timerStartedAt).getTime() + focus.workMinutes * 60 * 1000);
}

/** Seconds left in the running timer's block (0 or less once it's over). */
export function blockSecondsLeft(assignment, focus, now = new Date()) {
  return focus.workMinutes * 60 - sessionSeconds(assignment, now);
}

/** The running timer's tag: "Focus 18:42 left" in focus blocks, "Working… 4:05" otherwise. */
export function timerTagText(assignment, focus, now = new Date()) {
  if (focus.on) {
    return `Focus ${formatClock(Math.max(blockSecondsLeft(assignment, focus, now), 0))} left`;
  }
  return `Working… ${formatClock(sessionSeconds(assignment, now))}`;
}

/**
 * Ends a finished block: the timer stops at the block's end, so exactly one block is counted even if the app was
 * closed for longer, and the break runs from then. Returns { assignments, focusBreak }, where focusBreak is
 * { assignmentId, title, endedAt, endsAt } (ISO times) for the focus bar.
 */
export function endBlock(assignments, assignment, focus) {
  const end = blockEnd(assignment, focus);
  return {
    assignments: stopTimer(assignments, assignment.id, end),
    focusBreak: {
      assignmentId: assignment.id,
      title: assignment.title,
      endedAt: end.toISOString(),
      endsAt: new Date(end.getTime() + focus.breakMinutes * 60 * 1000).toISOString(),
    },
  };
}

/** A saved break, if it looks right (it's kept on this device, so it survives a reload). */
export function parseFocusBreak(text) {
  try {
    const saved = JSON.parse(text ?? "null");
    const valid =
      typeof saved?.assignmentId === "string" &&
      typeof saved.title === "string" &&
      !Number.isNaN(Date.parse(saved.endedAt)) &&
      !Number.isNaN(Date.parse(saved.endsAt));
    return valid ? saved : null;
  } catch {
    return null;
  }
}
