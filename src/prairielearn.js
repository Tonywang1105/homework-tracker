// Paste from PrairieLearn: reading assessments and due dates out of the text of a PrairieLearn Assessments page
// (select all, copy, paste), since PrairieLearn has no calendar feed and its API is for instructors. No DOM, so it
// can be unit-tested with Node. Written from PrairieLearn's usual layout: a row per assessment with a label like
// "HW12", its title, its available credit ("100% until 23:59, Fri, Nov 7 (CST)") and a score, the cells separated
// by tabs or each on its own line. If PrairieLearn changes that layout, this is the place to update.

import { toDueDate } from "./assignments.js?v=51ea54e1";
import { dateNearNow, pasteKey, planPasted } from "./paste.js?v=51ea54e1";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
// "100% until 23:59, Fri, Nov 7 (CST)", "80% until 11:59pm, Nov 14, 2026": the credit, the time and the date.
const CREDIT_UNTIL =
  /\b\d{1,3}%\s+until\s+(\d{1,2}):(\d{2})\s*(am|pm)?,?\s+(?:[A-Za-z]{3},?\s+)?([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/i;
const COURSE_CODE = /\b([A-Z]{2,4})\s?(\d{3})\b/;

/**
 * Reads a pasted Assessments page. Returns { course, items, skippedPast, skippedDone }: course is the first course
 * code in the text ("CS 124", or "" if there's none), and items are [{ title, dueDate, dueTime }] for assessments
 * still to do. Assessments already past due, or with a 100% score, are counted and left out.
 */
export function readPrairieLearn(text, now = new Date()) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const courseMatch = lines.map((line) => line.match(COURSE_CODE)).find(Boolean);
  const course = courseMatch ? `${courseMatch[1]} ${courseMatch[2]}` : "";
  const items = [];
  const seen = new Set();
  let skippedPast = 0;
  let skippedDone = 0;

  lines.forEach((line, index) => {
    const credit = line.match(CREDIT_UNTIL);
    if (!credit) {
      return;
    }
    const title = titleFor(line, credit.index, lines, index);
    const due = dueFrom(credit, now);
    if (!title || !due || seen.has(title)) {
      return;
    }
    seen.add(title);
    if (scoreAfter(line, credit, lines, index) >= 100) {
      skippedDone += 1;
      return;
    }
    if (toDueDate(due.dueDate, due.dueTime) < now) {
      skippedPast += 1;
      return;
    }
    items.push({ title, ...due });
  });
  return { course, items, skippedPast, skippedDone };
}

/**
 * The assessment's name: the cells before the credit on the same line ("HW12 <tab> Recursion" becomes
 * "HW12: Recursion"), or, when each cell is on its own line, the lines just above it.
 */
function titleFor(line, creditStart, lines, index) {
  let cells = line.slice(0, creditStart).split("\t").map((cell) => cell.trim()).filter(Boolean);
  if (cells.length === 0) {
    cells = lines.slice(Math.max(0, index - 2), index).filter((cell) => !CREDIT_UNTIL.test(cell) && !/^(score|available credit|assessment)$/i.test(cell));
  }
  if (cells.length === 0) {
    return "";
  }
  const name = cells.at(-1);
  const label = cells.length > 1 ? cells.at(-2) : "";
  // A short label like "HW12" goes in front, unless the name already starts with it.
  const title = label && label.length <= 8 && !name.toLowerCase().startsWith(label.toLowerCase()) ? `${label}: ${name}` : name;
  return title.slice(0, 200);
}

/** The score after the credit, on the same line or the next, as a number (100 for "100%"), or -1 if there isn't one. */
function scoreAfter(line, credit, lines, index) {
  const rest = line.slice(credit.index + credit[0].length);
  const sameLine = rest.match(/(\d{1,3})%\s*$/);
  if (sameLine) {
    return Number(sameLine[1]);
  }
  const next = lines[index + 1] ?? "";
  const nextLine = next.match(/^(\d{1,3})%$/);
  return nextLine ? Number(nextLine[1]) : -1;
}

/** { dueDate, dueTime } from the credit's date and time (a missing year is the one nearest to now). */
function dueFrom(credit, now) {
  const [, hourText, minuteText, meridiem, monthText, dayText, yearText] = credit;
  const month = MONTHS.indexOf(monthText.slice(0, 3).toLowerCase());
  let hour = Number(hourText);
  if (meridiem) {
    hour = (hour % 12) + (meridiem.toLowerCase() === "pm" ? 12 : 0);
  }
  if (month === -1 || hour > 23 || Number(minuteText) > 59) {
    return null;
  }
  const dueDate = dateNearNow(month, Number(dayText), yearText ? Number(yearText) : null, now);
  return dueDate ? { dueDate, dueTime: `${String(hour).padStart(2, "0")}:${minuteText}` } : null;
}

/** The key that recognizes the same assessment on a later paste: its course and title. */
export const prairieLearnKey = pasteKey;

/** What a paste would add or update, matching earlier PrairieLearn pastes by their saved key (see planPasted). */
export function planPrairieLearn(existing, deleted, items, course) {
  return planPasted(existing, deleted, items, course, "prairieLearnKey");
}
