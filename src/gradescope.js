// Paste from Gradescope: reading assignments and due dates out of the text of a Gradescope course dashboard (select
// all, copy, paste). No DOM, so it can be unit-tested with Node. Written from Gradescope's usual layout: a row per
// assignment with its name, its status ("No Submission", "Submitted", a score like "9.0 / 10.0"), when it was released
// and when it's due ("Nov 06 at 11:59PM"), the cells separated by tabs or each on its own line, and sometimes a
// "Late Due Date" line under it. If Gradescope changes that layout, this is the place to update.

import { toDueDate } from "./assignments.js?v=c11df76a";
import { dateNearNow, pasteKey, planPasted } from "./paste.js?v=c11df76a";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
// "Nov 06 at 11:59PM", "Nov 6, 2026 at 5:00 pm".
const DATE_AT = /\b([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?\s+at\s+(\d{1,2}):(\d{2})\s*(am|pm)\b/gi;
const COURSE_CODE = /\b([A-Z]{2,4})\s?(\d{3})\b/;
const DONE_STATUS = /^(submitted|graded)$/i;
const SCORE = /^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/;
const OTHER_STATUS = /^(no submission|ungraded|late|missing)$/i;
const HEADER = /^(name|status|released|due\b.*|late due.*)$/i;

/**
 * Reads a pasted course dashboard. Returns { course, items, skippedPast, skippedDone }: course is the first course
 * code in the text, and items are [{ title, dueDate, dueTime }] for work still to submit. Submitted or graded work,
 * and work past due, are counted and left out.
 */
export function readGradescope(text, now = new Date()) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !/^late due date/i.test(line));
  const courseMatch = lines.map((line) => line.match(COURSE_CODE)).find(Boolean);
  const course = courseMatch ? `${courseMatch[1]} ${courseMatch[2]}` : "";
  const items = [];
  const seen = new Set();
  let skippedPast = 0;
  let skippedDone = 0;

  for (const row of rowsOf(lines)) {
    const title = row[0];
    const dates = row.flatMap((cell) => [...cell.matchAll(DATE_AT)]);
    if (!title || dates.length === 0 || seen.has(title)) {
      continue;
    }
    seen.add(title);
    // The due date is the last one in the row (the first is when it was released).
    const due = dueFrom(dates.at(-1), now);
    if (!due) {
      continue;
    }
    if (row.some((cell) => DONE_STATUS.test(cell) || SCORE.test(cell))) {
      skippedDone += 1;
    } else if (toDueDate(due.dueDate, due.dueTime) < now) {
      skippedPast += 1;
    } else {
      items.push({ title: title.slice(0, 200), ...due });
    }
  }
  return { course, items, skippedPast, skippedDone };
}

/**
 * The rows of the dashboard as lists of cells: a line with tabs is a row; otherwise a row starts at a line that is
 * neither a status nor a date (the assignment's name), and the status and date lines after it belong to it.
 */
function rowsOf(lines) {
  const rows = [];
  for (const line of lines) {
    const cells = line.split("\t").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length > 1) {
      rows.push(cells);
      continue;
    }
    const isDetail = new RegExp(DATE_AT.source, "i").test(line) || DONE_STATUS.test(line) || SCORE.test(line) || OTHER_STATUS.test(line);
    if (isDetail && rows.length > 0) {
      rows.at(-1).push(line);
    } else if (!isDetail && !HEADER.test(line)) {
      rows.push([line]);
    }
  }
  return rows;
}

function dueFrom(match, now) {
  const [, monthText, dayText, yearText, hourText, minuteText, meridiem] = match;
  const month = MONTHS.indexOf(monthText.slice(0, 3).toLowerCase());
  const hour = (Number(hourText) % 12) + (meridiem.toLowerCase() === "pm" ? 12 : 0);
  if (month === -1 || Number(hourText) > 12 || Number(minuteText) > 59) {
    return null;
  }
  const dueDate = dateNearNow(month, Number(dayText), yearText ? Number(yearText) : null, now);
  return dueDate ? { dueDate, dueTime: `${String(hour).padStart(2, "0")}:${minuteText}` } : null;
}

/** The key that recognizes the same assignment on a later paste: its course and title. */
export const gradescopeKey = pasteKey;

/** What a paste would add or update, matching earlier Gradescope pastes by their saved key (see planPasted). */
export function planGradescope(existing, deleted, items, course) {
  return planPasted(existing, deleted, items, course, "gradescopeKey");
}
