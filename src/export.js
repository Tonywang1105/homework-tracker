// Exporting upcoming assignments as an .ics calendar file, to open in Apple or Google Calendar for
// real phone reminders. No DOM, so it can be unit-tested with Node.

import { assignmentType, formatHours, PRIORITY_LABELS, toDueDate, TYPE_LABELS } from "./assignments.js?v=f2a236bc";
import { toDateKey } from "./calendar.js?v=f2a236bc";

// Each event is a short block ending at the due time, so it shows at the right spot in a day view.
const EVENT_MINUTES = 15;
// Big assignments remind a day ahead; regular and small ones an hour ahead.
const ALARM_BEFORE = { big: "-P1D", regular: "-PT1H", small: "-PT1H" };
// Lines in an .ics file are folded at 75 bytes; continuation lines start with a space.
const MAX_LINE_BYTES = 75;
const encoder = new TextEncoder();

/** "20261022T045900Z": a moment in UTC, so every calendar app reads the same time. */
function utcStamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Text values escape backslashes, semicolons, commas and line breaks. */
function escapeText(text) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Splits a long line into 75-byte pieces without cutting a character in half. */
function foldLine(line) {
  const pieces = [];
  let piece = "";
  for (const character of line) {
    const limit = pieces.length === 0 ? MAX_LINE_BYTES : MAX_LINE_BYTES - 1;
    if (encoder.encode(piece + character).length > limit) {
      pieces.push(piece);
      piece = "";
    }
    piece += character;
  }
  pieces.push(piece);
  return pieces.join("\r\n ");
}

/** The upcoming assignments that go in the file: unfinished and not yet due, soonest first. */
export function upcomingForExport(assignments, now = new Date()) {
  return assignments
    .filter((a) => !a.done && toDueDate(a.dueDate, a.dueTime) >= now)
    .sort((a, b) => toDueDate(a.dueDate, a.dueTime) - toDueDate(b.dueDate, b.dueTime));
}

/** "Big · Exam · ~3 h", then the student's notes. */
function eventDescription(assignment) {
  const type = assignmentType(assignment);
  const facts = [PRIORITY_LABELS[assignment.priority], type ? TYPE_LABELS[type] : null, assignment.hours ? formatHours(assignment.hours) : null];
  const summary = facts.filter(Boolean).join(" · ");
  return assignment.notes ? `${summary}\n\n${assignment.notes}` : summary;
}

function eventLines(assignment, now) {
  const due = toDueDate(assignment.dueDate, assignment.dueTime);
  const start = new Date(due.getTime() - EVENT_MINUTES * 60 * 1000);
  const course = assignment.course ? ` (${assignment.course})` : "";
  const title = `Due: ${assignment.title}${course}`;
  return [
    "BEGIN:VEVENT",
    // The same id every export, so re-importing updates the event instead of adding a copy.
    `UID:${assignment.id}@homework-tracker`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(due)}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(eventDescription(assignment))}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(title)}`,
    `TRIGGER;RELATED=END:${ALARM_BEFORE[assignment.priority] ?? ALARM_BEFORE.regular}`,
    "END:VALARM",
    "END:VEVENT",
  ];
}

/** The whole .ics file for the given assignments' upcoming, unfinished ones. */
export function calendarFile(assignments, now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Homework Tracker//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Homework Tracker",
    ...upcomingForExport(assignments, now).flatMap((assignment) => eventLines(assignment, now)),
    "END:VCALENDAR",
  ];
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/** "homework-tracker-calendar-2026-10-20.ics" */
export function calendarFileName(now = new Date()) {
  return `homework-tracker-calendar-${toDateKey(now)}.ics`;
}
