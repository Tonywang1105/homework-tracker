// Copy this week, in the Weekly review: unfinished work from today through next Sunday as plain text, grouped by
// day, to paste into notes or a chat. Notes aren't included, since they often hold personal hints and links.

import { formatHours, toDueDate } from "../assignments.js?v=1db4c2d8";
import { t } from "../i18n.js?v=1db4c2d8";
import { weekToCopy } from "../review.js?v=1db4c2d8";
import { countAssignments, formatDay, timeFormatter } from "./dom.js?v=1db4c2d8";
import { state } from "./store.js?v=1db4c2d8";
import { showToast } from "./toast.js?v=1db4c2d8";

const copy = {
  button: document.getElementById("copy-week"),
  fallback: document.getElementById("copy-week-fallback"),
  text: document.getElementById("copy-week-text"),
};

export function startCopyWeek() {
  copy.button.addEventListener("click", handleCopy);
}

async function handleCopy() {
  const week = weekToCopy(state.assignments, new Date());
  const range = { start: formatDay(week.start), end: formatDay(week.end) };
  copy.fallback.hidden = true;
  if (week.count === 0) {
    showToast(t("msg.copy_nothing", range));
    return;
  }
  const text = weekText(week, range);
  try {
    await navigator.clipboard.writeText(text);
    showToast(t("msg.copied", { ...range, count: countAssignments(week.count) }));
  } catch {
    // Some browsers (and pages not opened over https) don't allow it, so show the text to copy by hand.
    copy.text.value = text;
    copy.fallback.hidden = false;
    copy.text.focus();
    copy.text.select();
    showToast(t("msg.copy_blocked"));
  }
}

/** The copied text: a heading, then Overdue, then each day with what's due, one assignment per line. */
export function weekText({ overdue, days }, range) {
  const lines = [t("copy.heading", range)];
  if (overdue.length > 0) {
    lines.push(t("copy.overdue"), ...overdue.map((a) => line(a, t("copy.was_due", { day: formatDay(a.dueDate) }))));
  }
  for (const { date, assignments } of days) {
    lines.push(formatDay(date), ...assignments.map((a) => line(a, timeFormatter.format(toDueDate(a.dueDate, a.dueTime)))));
  }
  return lines.join("\n");
}

/** "- MP3: Checkpoint 2 (CS 124), 11:59 PM, ~4 h" */
function line(assignment, when) {
  const name = assignment.course ? `${assignment.title} (${assignment.course})` : assignment.title;
  const parts = [name, when, ...(assignment.hours ? [formatHours(assignment.hours)] : [])];
  return `- ${parts.join(t("copy.sep"))}`;
}
