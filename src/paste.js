// What the pasted imports (PrairieLearn, Gradescope) share: recognizing the same assignment on a later paste,
// working out what a paste would add or update, and the year of a date shown without one. No DOM; unit-tested.

import { toDateKey } from "./calendar.js?v=ab392af8";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The key that recognizes the same assignment on a later paste: its course and title, however they're capitalized. */
export function pasteKey(course, title) {
  return `${course.trim().toLowerCase()}\n${title.trim().toLowerCase()}`;
}

/**
 * What a paste would do: `added` are new items (with their key), `updated` are existing assignments (matched by the
 * key saved in `keyField`) whose due date changed, and `unchanged` counts the rest. Items in Recently deleted
 * (`deleted`) are left out, so deleting one keeps it deleted.
 */
export function planPasted(existing, deleted, items, course, keyField) {
  const byKey = new Map(existing.filter((a) => a[keyField]).map((a) => [a[keyField], a]));
  const deletedKeys = new Set(deleted.filter((a) => a[keyField]).map((a) => a[keyField]));
  const added = [];
  const updated = [];
  let unchanged = 0;
  for (const item of items) {
    const key = pasteKey(course, item.title);
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

/**
 * "YYYY-MM-DD" for a month (0-11) and day, in `year` if given, else in the year that puts it nearest to now (Nov 7
 * seen in December is last month, not next November). null if there's no such day.
 */
export function dateNearNow(month, day, year, now = new Date()) {
  let chosen = year ?? now.getFullYear();
  if (!year) {
    const candidate = new Date(chosen, month, day);
    if (candidate - now > 183 * DAY_MS) {
      chosen -= 1;
    } else if (now - candidate > 183 * DAY_MS) {
      chosen += 1;
    }
  }
  const date = new Date(chosen, month, day);
  return date.getMonth() === month && date.getDate() === day ? toDateKey(date) : null;
}
