// Reads a Canvas calendar feed (.ics file) and merges its assignments into the list.
// No DOM, so it can be unit-tested with Node, like assignments.js.

import { createAssignment, DEFAULT_DUE_TIME, toDueDate, validateAssignmentInput } from "./assignments.js?v=2d376c3b";
import { toDateKey } from "./calendar.js?v=2d376c3b";

// Canvas gives each assignment a UID like "event-assignment-12345"; other calendar events use other prefixes.
const ASSIGNMENT_UID_PREFIX = "event-assignment-";
const MAX_TITLE_LENGTH = 200;

/**
 * Splits .ics text into events: [{ uid, summary, dtstart: { value, params } }].
 * Handles folded lines (a long line continues on lines that start with a space or tab) and escaped text.
 */
export function parseIcsEvents(text) {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const events = [];
  let current = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
    } else if (line === "END:VEVENT") {
      if (current) {
        events.push(current);
      }
      current = null;
    } else if (current) {
      const property = parseProperty(line);
      if (property?.name === "UID") {
        current.uid = property.value;
      } else if (property?.name === "SUMMARY") {
        current.summary = unescapeText(property.value);
      } else if (property?.name === "DTSTART") {
        current.dtstart = { value: property.value, params: property.params };
      }
    }
  }
  return events;
}

/** "DTSTART;VALUE=DATE:20261016" becomes { name: "DTSTART", params: { VALUE: "DATE" }, value: "20261016" }. */
function parseProperty(line) {
  const colon = line.indexOf(":");
  if (colon === -1) {
    return null;
  }
  const [name, ...paramParts] = line.slice(0, colon).split(";");
  const params = Object.fromEntries(paramParts.map((part) => part.split("=")));
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

function unescapeText(value) {
  return value.replace(/\\([\\;,nN])/g, (_, character) => (character === "n" || character === "N" ? " " : character));
}

/**
 * Turns an event's DTSTART into the app's local { dueDate, dueTime }, or null if it can't be read.
 * Canvas writes due times in UTC ("20261017T045900Z"); all-day items ("20261016") are due at 11:59 PM.
 * A time with a TZID or no zone at all is read as local time.
 */
export function toLocalDue(dtstart) {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/.exec(dtstart?.value ?? "");
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute, second, utc] = match;
  if (hour === undefined) {
    return { dueDate: `${year}-${month}-${day}`, dueTime: DEFAULT_DUE_TIME };
  }
  const parts = [year, month - 1, day, hour, minute, second].map(Number);
  const due = utc ? new Date(Date.UTC(...parts)) : new Date(...parts);
  if (Number.isNaN(due.getTime())) {
    return null;
  }
  const dueTime = `${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}`;
  return { dueDate: toDateKey(due), dueTime };
}

/** "MP1: Checkpoint [CS 124 AL1 Fall 2026]" becomes { title: "MP1: Checkpoint", course: "CS 124 AL1 Fall 2026" }. */
export function splitCourse(summary) {
  const match = /^(.*?)\s*\[([^\]]+)\]\s*$/.exec(summary);
  if (!match || match[1] === "") {
    return { title: summary.trim(), course: "" };
  }
  return { title: match[1], course: match[2].trim() };
}

/** The Canvas assignments in an .ics file, as [{ canvasUid, title, course, dueDate, dueTime }]. */
export function readCanvasAssignments(icsText) {
  const assignments = [];
  for (const event of parseIcsEvents(icsText)) {
    if (!event.uid?.startsWith(ASSIGNMENT_UID_PREFIX) || !event.summary) {
      continue;
    }
    const due = toLocalDue(event.dtstart);
    if (!due) {
      continue;
    }
    const { title, course } = splitCourse(event.summary);
    assignments.push({ canvasUid: event.uid, title: title.slice(0, MAX_TITLE_LENGTH), course, ...due });
  }
  return assignments;
}

/** True if the text looks like a calendar file at all, so the page can say "wrong file" instead of "nothing found". */
export function isIcsCalendar(text) {
  return /^BEGIN:VCALENDAR/m.test(text);
}

/**
 * Merges Canvas assignments into the list. Canvas decides the title and due date; the student's
 * course name, notes, big/small and done stay as they set them. New assignments that are already
 * past due are skipped, so a first import doesn't fill the list with old overdue work.
 * Returns { assignments, added, updated, skippedPast }.
 */
export function mergeCanvasAssignments(existing, imported, now = new Date()) {
  const byUid = new Map(existing.filter((a) => a.canvasUid).map((a) => [a.canvasUid, a]));
  const updates = new Map();
  const additions = [];
  let skippedPast = 0;

  for (const item of imported) {
    const current = byUid.get(item.canvasUid);
    if (current) {
      const changed = current.title !== item.title || current.dueDate !== item.dueDate || current.dueTime !== item.dueTime;
      if (changed) {
        updates.set(current.id, { ...current, title: item.title, dueDate: item.dueDate, dueTime: item.dueTime });
      }
      continue;
    }
    const result = validateAssignmentInput({ ...item, priority: "big", notes: "" });
    if (!result.ok) {
      continue;
    }
    const assignment = { ...createAssignment(result.fields, { now }), canvasUid: item.canvasUid };
    if (toDueDate(assignment.dueDate, assignment.dueTime) < now) {
      skippedPast += 1;
      continue;
    }
    byUid.set(item.canvasUid, assignment);
    additions.push(assignment);
  }

  return {
    assignments: [...existing.map((a) => updates.get(a.id) ?? a), ...additions],
    added: additions.length,
    updated: updates.size,
    skippedPast,
  };
}
