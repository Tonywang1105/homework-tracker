// The Weekly review panel: this week (due, done, overdue, still to come) and next week (how much, busiest day).

import { formatHours } from "../assignments.js?v=d1337206";
import { weekReview } from "../review.js?v=d1337206";
import { formatDay } from "./dom.js?v=d1337206";
import { state } from "./store.js?v=d1337206";

const STATUS_TEXT = { done: "done", overdue: "overdue", coming: "still to come" };

const reviewElements = {
  panel: document.getElementById("review-panel"),
  thisDates: document.getElementById("review-this-dates"),
  thisSummary: document.getElementById("review-this-summary"),
  big: document.getElementById("review-big"),
  nextDates: document.getElementById("review-next-dates"),
  nextSummary: document.getElementById("review-next-summary"),
  start: document.getElementById("review-start"),
  startList: document.getElementById("review-start-list"),
};

/** Fills in the panel while it is open, so it stays current as assignments change. */
export function renderReview(now) {
  if (reviewElements.panel.hidden) {
    return;
  }
  const { thisWeek, nextWeek, startThisWeek } = weekReview(state.assignments, now, state.startPlan);

  reviewElements.thisDates.textContent = dateRange(thisWeek);
  reviewElements.thisSummary.textContent = thisWeekText(thisWeek);
  reviewElements.big.replaceChildren(
    ...thisWeek.big.map(({ assignment, status }) =>
      listItem(`${assignment.title}: ${STATUS_TEXT[status]}`, `review-${status}`),
    ),
  );
  reviewElements.big.hidden = thisWeek.big.length === 0;

  reviewElements.nextDates.textContent = dateRange(nextWeek);
  reviewElements.nextSummary.textContent = nextWeekText(nextWeek);
  reviewElements.startList.replaceChildren(
    ...startThisWeek.map((a) => listItem(`${a.title}: start by ${formatDay(state.startPlan.get(a.id).startDate)}`)),
  );
  reviewElements.start.hidden = startThisWeek.length === 0;
}

function dateRange({ start, end }) {
  return `${formatDay(start)} to ${formatDay(end)}`;
}

/** "6 due: 4 done, 1 overdue, 1 still to come. About 9 h of finished work." */
function thisWeekText({ due, done, overdue, coming, hoursDone }) {
  if (due === 0) {
    return "Nothing was due this week.";
  }
  const parts = [`${done} done`];
  if (overdue > 0) {
    parts.push(`${overdue} overdue`);
  }
  if (coming > 0) {
    parts.push(`${coming} still to come`);
  }
  const finished = hoursDone > 0 ? ` About ${formatHours(hoursDone).slice(1)} of finished work.` : "";
  return `${due} due: ${parts.join(", ")}.${finished}`;
}

/** "5 due, about 6 h of work (1 without an estimate). Busiest: Thu, 11/5 (~4 h)." */
function nextWeekText({ due, hours, unestimated, busiest }) {
  if (due === 0) {
    return "Nothing due yet.";
  }
  const work = hours > 0 ? `, about ${formatHours(hours).slice(1)} of work` : "";
  const missing = unestimated > 0 ? ` (${unestimated} without an estimate)` : "";
  const busy = busiest ? ` Busiest: ${formatDay(busiest.dueDate)} (${formatHours(busiest.hours)}).` : "";
  return `${due} due${work}${missing}.${busy}`;
}

function listItem(text, className = "") {
  const item = document.createElement("li");
  item.textContent = text;
  if (className) {
    item.className = className;
  }
  return item;
}
