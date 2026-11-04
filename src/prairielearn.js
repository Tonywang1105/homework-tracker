// Paste from PrairieLearn: reading assessments and due dates out of the text of a PrairieLearn Assessments page
// (select all, copy, paste), since PrairieLearn has no calendar feed and its API is for instructors. No DOM, so it
// can be unit-tested with Node. Written from PrairieLearn's usual layout: a row per assessment with a label like
// "HW12", its title, its available credit ("100% until 23:59, Fri, Nov 7 (CST)") and a score, the cells separated
// by tabs or each on its own line. If PrairieLearn changes that layout, this is the place to update.

import { toDueDate } from "./assignments.js?v=da45906c";
import { toDateKey } from "./calendar.js?v=da45906c";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
// "100% until 23:59, Fri, Nov 7 (CST)", "80% until 11:59pm, Nov 14, 2026": the credit, the time and the date.
const CREDIT_UNTIL =
  /\b\d{1,3}%\s+until\s+(\d{1,2}):(\d{2})\s*(am|pm)?,?\s+(?:[A-Za-z]{3},?\s+)?([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/i;
const COURSE_CODE = /\b([A-Z]{2,4})\s?(\d{3})\b/;
const DAY_MS = 24 * 60 * 60 * 1000;

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

/**
 * { dueDate, dueTime } from the credit's date and time. PrairieLearn often leaves out the year, so it's the year
 * that puts the date nearest to now (Nov 7 seen in December is last month, not next November).
 */
function dueFrom(credit, now) {
  const [, hourText, minuteText, meridiem, monthText, dayText, yearText] = credit;
  const month = MONTHS.indexOf(monthText.slice(0, 3).toLowerCase());
  let hour = Number(hourText);
  if (meridiem) {
    hour = (hour % 12) + (meridiem.toLowerCase() === "pm" ? 12 : 0);
  }
  const day = Number(dayText);
  if (month === -1 || hour > 23 || Number(minuteText) > 59 || day < 1 || day > 31) {
    return null;
  }
  let year = yearText ? Number(yearText) : now.getFullYear();
  if (!yearText) {
    const candidate = new Date(year, month, day);
    if (candidate - now > 183 * DAY_MS) {
      year -= 1;
    } else if (now - candidate > 183 * DAY_MS) {
      year += 1;
    }
  }
  const date = new Date(year, month, day);
  if (date.getMonth() !== month) {
    return null;
  }
  return { dueDate: toDateKey(date), dueTime: `${String(hour).padStart(2, "0")}:${minuteText}` };
}

/** The key that recognizes the same assessment on a later paste: its course and title. */
export function prairieLearnKey(course, title) {
  return `${course.trim().toLowerCase()}\n${title.trim().toLowerCase()}`;
}

/**
 * What a paste would do: `added` are new assignments to add (marked PrairieLearn, with the course), `updated` are
 * existing ones whose due date changed (matched by course and title), and `unchanged` counts the rest. Assessments
 * in Recently deleted (`deleted`) are left out, so deleting one keeps it deleted.
 */
export function planPrairieLearn(existing, deleted, items, course) {
  const byKey = new Map(existing.filter((a) => a.prairieLearnKey).map((a) => [a.prairieLearnKey, a]));
  const deletedKeys = new Set(deleted.filter((a) => a.prairieLearnKey).map((a) => a.prairieLearnKey));
  const added = [];
  const updated = [];
  let unchanged = 0;
  for (const item of items) {
    const key = prairieLearnKey(course, item.title);
    if (deletedKeys.has(key)) {
      continue;
    }
    const current = byKey.get(key);
    if (!current) {
      added.push({ ...item, course, key });
    } else if (current.dueDate !== item.dueDate || current.dueTime !== item.dueTime) {
      updated.push({ ...current, dueDate: item.dueDate, dueTime: item.dueTime });
    } else {
      unchanged += 1;
    }
  }
  return { added, updated, unchanged };
}
