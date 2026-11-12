// "How it went" notes: a one-line lesson saved when big or regular work is finished, shown on the next assignment of
// the same type in the same course ("Last time (MP8): start the tests first"). No DOM, so it can be unit-tested.

import { assignmentType } from "./assignments.js?v=29f9a5f9";

export const MAX_LESSON_LENGTH = 200;

/** Finishing big or regular work asks how it went; small reminders don't. */
export function asksForLesson(assignment) {
  return assignment.priority !== "small";
}

/** A lesson as typed: trimmed and at most 200 characters ("" means none). */
export function cleanLesson(text) {
  return String(text ?? "").trim().slice(0, MAX_LESSON_LENGTH);
}

/**
 * The most recent lesson from finished work of `type` in `course` (matched however the course is written), leaving
 * out the assignment with `exceptId`: { title, lesson }, or null if there is none.
 */
export function latestLesson(assignments, { course = "", type = "" }, exceptId = null) {
  const wantedCourse = course.trim().toLowerCase();
  if (!type || !wantedCourse) {
    return null;
  }
  const found = assignments
    .filter((a) => a.id !== exceptId && a.done && a.lesson && assignmentType(a) === type && a.course.trim().toLowerCase() === wantedCourse)
    .sort((a, b) => (b.doneAt ?? b.dueDate).localeCompare(a.doneAt ?? a.dueDate))[0];
  return found ? { title: found.title, lesson: found.lesson } : null;
}
