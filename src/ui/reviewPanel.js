// The Weekly review panel: this week (due, done, overdue, still to come) and next week (how much, busiest day),
// and the one-line summary above the list that leads to it.

import { formatHours } from "../assignments.js?v=8fe9dbad";
import { todaySummary, weekReview } from "../review.js?v=8fe9dbad";
import { formatDay, makeButton } from "./dom.js?v=8fe9dbad";
import { panels, setPanelOpen } from "./panels.js?v=8fe9dbad";
import { setView } from "./settings.js?v=8fe9dbad";
import { state } from "./store.js?v=8fe9dbad";

const STATUS_TEXT = { done: "done", overdue: "overdue", coming: "still to come" };
// Today's assignments named in the summary line before it says "+N more".
const MAX_NAMED_TODAY = 3;
const summaryLine = document.getElementById("today-summary");
const reviewPanel = panels.find((panel) => panel.panel.id === "review-panel");

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

/**
 * "Today: 2 due (Quiz 5, Email TA) · 1 overdue · This week: 3 of 8 done · Agenda · Weekly review",
 * for everything (not just what the filters show), so a first-time user sees today and their progress at once.
 */
export function renderTodaySummary(now) {
  summaryLine.hidden = state.assignments.length === 0;
  if (summaryLine.hidden) {
    return;
  }
  const { dueToday, overdue, weekDone, weekDue } = todaySummary(state.assignments, now);
  const parts = [label("Today:"), ` ${todayText(dueToday)}`];
  if (overdue > 0) {
    const late = document.createElement("span");
    late.className = "today-summary-overdue";
    late.textContent = `${overdue} overdue`;
    parts.push(" · ", late);
  }
  parts.push(" · ", label("This week:"), weekDue === 0 ? " nothing due" : ` ${weekDone} of ${weekDue} done`);
  parts.push(" · ", summaryLink("Agenda", "agenda"), " · ", summaryLink("Weekly review", "review"));
  summaryLine.replaceChildren(...parts);
}

/** The summary line's links: Agenda switches view; Weekly review opens that panel (which scrolls to it). */
export function handleTodaySummaryClick(event) {
  const link = event.target.closest("[data-summary-link]")?.dataset.summaryLink;
  if (link === "agenda") {
    setView("agenda");
  } else if (link === "review") {
    setPanelOpen(reviewPanel, true);
    renderReview(new Date());
  }
}

function todayText(dueToday) {
  if (dueToday.length === 0) {
    return "nothing due";
  }
  const names = dueToday.slice(0, MAX_NAMED_TODAY).map((a) => a.title);
  const more = dueToday.length > MAX_NAMED_TODAY ? `, +${dueToday.length - MAX_NAMED_TODAY} more` : "";
  return `${dueToday.length} due (${names.join(", ")}${more})`;
}

function summaryLink(text, target) {
  const link = makeButton("link-button", text);
  link.dataset.summaryLink = target;
  return link;
}

function label(text) {
  const strong = document.createElement("strong");
  strong.textContent = text;
  return strong;
}
