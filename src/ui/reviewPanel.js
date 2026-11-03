// The Weekly review panel: this week (due, done, overdue, still to come) and next week (how much, busiest day),
// and the one-line summary above the list that leads to it.

import { formatHours, formatHoursPlain } from "../assignments.js?v=76f0b296";
import { toDateKey } from "../calendar.js?v=76f0b296";
import { t } from "../i18n.js?v=76f0b296";
import { doneStreak, finishedThisWeek, todaySummary, weekReview } from "../review.js?v=76f0b296";
import { formatSpent } from "../timer.js?v=76f0b296";
import { DATE_LOCALE, formatDay, makeButton } from "./dom.js?v=76f0b296";
import { panels, setPanelOpen } from "./panels.js?v=76f0b296";
import { setView } from "./settings.js?v=76f0b296";
import { state } from "./store.js?v=76f0b296";

// Today's assignments named in the summary line before it says "+N more".
const MAX_NAMED_TODAY = 3;
const summaryLine = document.getElementById("today-summary");
const reviewPanel = panels.find((panel) => panel.panel.id === "review-panel");

const reviewElements = {
  panel: document.getElementById("review-panel"),
  thisDates: document.getElementById("review-this-dates"),
  thisSummary: document.getElementById("review-this-summary"),
  finished: document.getElementById("review-finished"),
  days: document.getElementById("review-days"),
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
  renderFinished(now);
  reviewElements.big.replaceChildren(
    ...thisWeek.big.map(({ assignment, status }) =>
      listItem(t(`review.status_${status}`, { title: assignment.title }), `review-${status}`),
    ),
  );
  reviewElements.big.hidden = thisWeek.big.length === 0;

  reviewElements.nextDates.textContent = dateRange(nextWeek);
  reviewElements.nextSummary.textContent = nextWeekText(nextWeek);
  reviewElements.startList.replaceChildren(
    ...startThisWeek.map((a) => listItem(t("review.start_by", { title: a.title, day: formatDay(state.startPlan.get(a.id).startDate) }))),
  );
  reviewElements.start.hidden = startThisWeek.length === 0;
}

/** "Finished 9 this week (3 big) · 4-day streak", and a Mon–Sun row with how many were finished each day. */
function renderFinished(now) {
  const { total, big, byDay } = finishedThisWeek(state.assignments, now);
  const streak = doneStreak(state.assignments, now);
  const bigText = big > 0 ? t("review.finished_big", { n: big }) : "";
  const streakText = streak > 0 ? t("review.finished_streak", { n: streak }) : "";
  reviewElements.finished.textContent = t("review.finished", { n: total, big: bigText, streak: streakText });
  const today = byDay.find(({ date }) => date === toDateKey(now));
  reviewElements.days.replaceChildren(
    ...byDay.map((day) => {
      const item = document.createElement("li");
      item.className = `review-day${day.count > 0 ? " has-done" : ""}${day === today ? " is-today" : ""}`;
      const name = document.createElement("span");
      name.className = "review-day-name";
      name.textContent = new Intl.DateTimeFormat(DATE_LOCALE, { weekday: "short" }).format(new Date(`${day.date}T12:00`));
      const count = document.createElement("span");
      count.className = "review-day-count";
      count.textContent = String(day.count);
      item.append(name, count);
      item.setAttribute("aria-label", `${name.textContent}: ${day.count} finished`);
      return item;
    }),
  );
}

function dateRange({ start, end }) {
  return t("review.range", { start: formatDay(start), end: formatDay(end) });
}

/** "6 due: 4 done, 1 overdue, 1 still to come. About 9 h of finished work. Tracked 6 h: ..." */
function thisWeekText({ due, done, overdue, coming, hoursDone, tracked }) {
  if (due === 0) {
    return t("review.nothing_was_due");
  }
  const parts = [t("review.done", { n: done })];
  if (overdue > 0) {
    parts.push(t("review.overdue", { n: overdue }));
  }
  if (coming > 0) {
    parts.push(t("review.coming", { n: coming }));
  }
  const finished = hoursDone > 0 ? t("review.finished_hours", { hours: formatHoursPlain(hoursDone) }) : "";
  return `${t("review.this_week_summary", { due, parts: parts.join(", ") })}${finished}${trackedText(tracked)}`;
}

/** " Tracked 6 h; finished work took about 40% longer than you estimated." (empty if nothing was timed) */
function trackedText({ seconds, ratio }) {
  if (seconds === 0) {
    return "";
  }
  const tracked = t("review.tracked", { spent: formatSpent(seconds) });
  if (ratio === null) {
    return `${tracked}${t("review.tracked_end")}`;
  }
  const percent = Math.round(Math.abs(ratio - 1) * 100);
  if (percent < 10) {
    return `${tracked}${t("review.as_estimated")}`;
  }
  return `${tracked}${t(ratio > 1 ? "review.longer" : "review.shorter", { percent })}`;
}

/** "5 due, about 6 h of work (1 without an estimate). Busiest: Thu, 11/5 (~4 h)." */
function nextWeekText({ due, hours, unestimated, busiest }) {
  if (due === 0) {
    return t("review.nothing_due_yet");
  }
  const work = hours > 0 ? t("review.next_work", { hours: formatHoursPlain(hours) }) : "";
  const missing = unestimated > 0 ? t("review.next_missing", { n: unestimated }) : "";
  const busy = busiest ? t("review.next_busiest", { day: formatDay(busiest.dueDate), hours: formatHours(busiest.hours) }) : "";
  return t("review.next_summary", { due, work, missing, busy });
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
  const { dueToday, overdue, weekDone, weekDue, streak } = todaySummary(state.assignments, now);
  const parts = [label(t("summary.today")), ` ${todayText(dueToday)}`];
  if (overdue > 0) {
    const late = document.createElement("span");
    late.className = "today-summary-overdue";
    late.textContent = t("summary.overdue", { n: overdue });
    parts.push(" · ", late);
  }
  const week = weekDue === 0 ? t("summary.nothing_due") : t("summary.week_done", { done: weekDone, due: weekDue });
  parts.push(" · ", label(t("summary.week")), ` ${week}`);
  // A single day isn't a streak yet, so it only shows from two days in a row.
  if (streak >= 2) {
    parts.push(` · ${t("summary.streak", { n: streak })}`);
  }
  parts.push(" · ", summaryLink(t("view.agenda"), "agenda"), " · ", summaryLink(t("summary.review"), "review"));
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
    return t("summary.nothing_due");
  }
  const names = dueToday.slice(0, MAX_NAMED_TODAY).map((a) => a.title);
  const more = dueToday.length > MAX_NAMED_TODAY ? t("summary.more", { n: dueToday.length - MAX_NAMED_TODAY }) : "";
  return t("summary.due", { n: dueToday.length, names: names.join(", "), more });
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
