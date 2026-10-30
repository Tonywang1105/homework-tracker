// The to-do and completed lists: drawing rows and tags, and the row actions (done, timer, tomorrow, extend, edit, delete).

import {
  assignmentType,
  canExtend,
  canSnooze,
  describeDue,
  formatHours,
  parseSavedFilters,
  PRIORITY_LABELS,
  removeAssignment,
  searchWords,
  setDone,
  snoozeDate,
  stepProgress,
  toDueDate,
  toggleStep,
  TYPE_LABELS,
  updateAssignment,
} from "../assignments.js?v=8ed150ab";
import { toDateKey } from "../calendar.js?v=8ed150ab";
import { timerTagText } from "../focus.js?v=8ed150ab";
import { render } from "../main.js?v=8ed150ab";
import { stepDays } from "../plan.js?v=8ed150ab";
import { spentText, startTimer, stopTimer } from "../timer.js?v=8ed150ab";
import { dueFormatter, elements, formatDay, makeButton, makeOption, makeTag, showNote } from "./dom.js?v=8ed150ab";
import { primeChime } from "./focus.js?v=8ed150ab";
import { startCopying, startEditing, startExtending, stopEditing } from "./form.js?v=8ed150ab";
import { toggleSelected } from "./select.js?v=8ed150ab";
import { findAssignment, loadText, saveChoice, state, updateAssignments } from "./store.js?v=8ed150ab";
import { showToast } from "./toast.js?v=8ed150ab";

const FILTERS_KEY = "homework-tracker.filters";

/** "start by Mon, 10/19", "start today", or "behind: ~2 h short". */
function startText({ startDate, status, shortHours }) {
  if (status === "behind") {
    return `behind: ${formatHours(shortHours)} short`;
  }
  return status === "today" ? "start today" : `start by ${formatDay(startDate)}`;
}

/** Typing in the search box: while searching, Completed is opened so finished matches show; clearing it restores it. */
export function handleSearchInput() {
  const searching = searchWords(elements.search.value).length > 0;
  if (searching && state.doneOpenBeforeSearch === null) {
    state.doneOpenBeforeSearch = elements.doneSection.open;
    elements.doneSection.open = true;
  } else if (!searching && state.doneOpenBeforeSearch !== null) {
    elements.doneSection.open = state.doneOpenBeforeSearch;
    state.doneOpenBeforeSearch = null;
  }
  render();
}

/** Why the to-do list is empty, naming any filter that hides work so it never looks like lost data. */
export function emptyMessageText({ course, hideSmall, search }, finishedMatches) {
  if (searchWords(search).length > 0) {
    const searched = `“${search.trim()}”`;
    return finishedMatches > 0
      ? `Nothing left to do matches ${searched}. Finished work that matches is below.`
      : `Nothing matches ${searched}.${course ? ` Only ${course} is searched.` : ""}${hideSmall ? " Small reminders are hidden." : ""}`;
  }
  if (!state.assignments.some((a) => !a.done)) {
    return "All caught up. Nothing left to do.";
  }
  const smallHidden = hideSmall ? " Small reminders are hidden." : "";
  if (course) {
    return `Nothing left to do for ${course}.${smallHidden}`;
  }
  return `Nothing left but small reminders.${smallHidden}`;
}

/** One to-do row; a series' first row also gets its "+N more in this series" link, later rows are indented. */
export function renderTodoRow({ assignment, laterInSeries, inSeries }, now, soonIds) {
  const item = renderAssignment(assignment, now, soonIds);
  item.classList.toggle("in-series", inSeries);
  if (laterInSeries === 0) {
    return [item];
  }
  const expanded = state.expandedSeries.has(assignment.seriesId);
  const toggleItem = document.createElement("li");
  toggleItem.className = "series-toggle";
  const toggle = makeButton("link-button", expanded ? `Hide the ${laterInSeries} later ones` : `+${laterInSeries} more in this series`);
  toggle.dataset.seriesToggle = assignment.seriesId;
  toggle.setAttribute("aria-expanded", String(expanded));
  toggleItem.append(toggle);
  return [item, toggleItem];
}

export function renderAssignment(assignment, now, soonIds = new Set()) {
  const item = document.createElement("li");
  item.className = `assignment priority-${assignment.priority}${assignment.done ? " is-done" : ""}`;
  item.dataset.id = assignment.id;
  if (soonIds.has(assignment.id)) {
    const overdue = toDueDate(assignment.dueDate, assignment.dueTime) < now;
    item.classList.add(overdue ? "is-overdue" : "is-due-soon");
  }
  if (assignment.id === state.editingId) {
    item.classList.add("is-editing");
  }

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  if (state.selecting) {
    // In select mode the box picks the row instead of marking it done.
    const selected = state.selectedIds.has(assignment.id);
    checkbox.className = "done-checkbox select-checkbox";
    checkbox.checked = selected;
    checkbox.dataset.action = "toggle-select";
    checkbox.setAttribute("aria-label", `Select "${assignment.title}"`);
    item.classList.toggle("is-selected", selected);
  } else {
    checkbox.className = "done-checkbox";
    checkbox.checked = assignment.done;
    checkbox.dataset.action = "toggle-done";
    checkbox.setAttribute("aria-label", `Mark "${assignment.title}" as ${assignment.done ? "not done" : "done"}`);
  }

  const body = document.createElement("div");
  body.className = "assignment-body";

  const titleLine = document.createElement("div");
  titleLine.className = "title-line";
  const title = document.createElement("span");
  title.className = "assignment-title";
  title.textContent = assignment.title;
  titleLine.append(title, ...renderTags(assignment));

  const dueLine = document.createElement("div");
  dueLine.className = "due-line";
  dueLine.append(...renderDueParts(assignment, now));

  body.append(titleLine, dueLine);
  if (stepProgress(assignment)) {
    body.append(renderSteps(assignment));
  }
  if (assignment.notes) {
    const notes = document.createElement("p");
    notes.className = "notes";
    showNote(notes, assignment.notes);
    body.append(notes);
  }

  const actions = document.createElement("div");
  actions.className = "item-actions";
  actions.append(
    ...(assignment.done ? [] : [timerButton(assignment)]),
    ...(canSnooze(assignment, now) ? [makeActionButton("Tomorrow", "snooze", assignment.title)] : []),
    ...(canExtend(assignment, now) ? [makeActionButton("Extend…", "extend", assignment.title)] : []),
    makeActionButton("Edit", "edit", assignment.title),
    makeActionButton("Copy", "copy", assignment.title),
    makeActionButton("Delete", "delete", assignment.title),
  );

  item.append(checkbox, body, actions);
  return item;
}

/** Start, or Stop while this assignment's timer is running (on list rows and in Today's plan). */
export function timerButton(assignment) {
  const running = Boolean(assignment.timerStartedAt);
  const button = makeActionButton(running ? "Stop" : "Start", running ? "timer-stop" : "timer-start", assignment.title);
  button.classList.add("action-timer");
  button.title = running ? "Stop the timer and add this time to the total" : "Time how long this takes";
  return button;
}

/** A running timer's "Working… 4:05" tag, which tickTimers keeps ticking. */
export function makeTimerClock(assignment, now = new Date()) {
  const clock = makeTag(timerTagText(assignment, state.focus, now), "timer-tag");
  clock.dataset.startedAt = assignment.timerStartedAt;
  return clock;
}

/** "Working… 4:05" (or "Focus 18:42 left") on a running timer's tag; called every second, so it ticks without redrawing the list. */
export function tickTimers(now = new Date()) {
  for (const tag of document.querySelectorAll(".timer-tag[data-started-at]")) {
    tag.textContent = timerTagText({ timerStartedAt: tag.dataset.startedAt }, state.focus, now);
  }
}

/**
 * The course tag, the type tag (if any) and the Big/Small tag, shared by the list, the details box and the Agenda.
 * The course tag is a button that opens the course's page, except where the tags sit inside a button (`courseButton: false`).
 */
export function renderTags(assignment, { courseButton = true } = {}) {
  const tags = [];
  // Unfinished work whose deadline has passed is labelled, in words as well as color, wherever its tags appear.
  if (!assignment.done && describeDue(assignment).urgency === "overdue") {
    tags.push(makeTag("Overdue", "overdue-tag"));
  }
  if (assignment.course) {
    const className = `course-tag course-color-${state.courseColors.get(assignment.course) ?? "slate"}`;
    if (courseButton) {
      const button = makeButton(className, assignment.course);
      button.dataset.coursePage = assignment.course;
      button.title = `Show ${assignment.course}'s page`;
      tags.push(button);
    } else {
      tags.push(makeTag(assignment.course, className));
    }
  }
  const type = assignmentType(assignment);
  if (type) {
    tags.push(makeTag(TYPE_LABELS[type], `type-tag type-${type}`));
  }
  if (assignment.timerStartedAt) {
    tags.push(makeTimerClock(assignment));
  }
  // Once time is tracked, its tag shows the estimate too ("spent 40 min of ~3 h"), so the estimate isn't repeated.
  const spent = spentText(assignment);
  if (spent) {
    tags.push(makeTag(spent, "spent-tag"));
  } else if (assignment.hours) {
    tags.push(makeTag(formatHours(assignment.hours), "hours-tag"));
  }
  if (assignment.originalDueDate) {
    tags.push(makeTag(`extended from ${formatDay(assignment.originalDueDate)}`, "extended-tag"));
  }
  const progress = stepProgress(assignment);
  if (progress) {
    const allDone = progress.done === progress.total;
    tags.push(makeTag(`${progress.done} of ${progress.total} steps`, `steps-tag${allDone ? " steps-tag-done" : ""}`));
  }
  const start = state.startPlan.get(assignment.id);
  if (start) {
    tags.push(makeTag(startText(start), `start-tag start-${start.status}`));
  }
  tags.push(makeTag(PRIORITY_LABELS[assignment.priority], `priority-tag priority-tag-${assignment.priority}`));
  return tags;
}

/** Which day each of an assignment's steps is planned for (see stepDays), using this render's plans. */
export function stepSchedule(assignment, now = new Date()) {
  const todayHours = state.todayPlan.find((entry) => entry.assignment.id === assignment.id)?.todayHours ?? 0;
  return stepDays(assignment, state.startPlan.get(assignment.id), todayHours, now);
}

/**
 * An assignment's steps as checkboxes, used in its list row and in the details box. Each checkbox has
 * data-step (its position), so one click handler can tell which step was ticked. Unticked steps show the day
 * they're planned for ("today", "Fri, 10/30"); without an estimate, a hint says how to get that.
 */
export function renderSteps(assignment, list = document.createElement("ul")) {
  list.className = "steps";
  const now = new Date();
  const today = toDateKey(now);
  const schedule = stepSchedule(assignment, now);
  const needsEstimate = !assignment.done && !assignment.hours && assignment.steps.some((step) => !step.done) && describeDue(assignment, now).urgency !== "overdue";
  const hint = document.createElement("li");
  hint.className = "steps-hint";
  hint.textContent = 'Add "Time needed" to spread these over days.';
  list.replaceChildren(
    ...assignment.steps.map((step, index) => {
      const item = document.createElement("li");
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = step.done;
      checkbox.dataset.action = "toggle-step";
      checkbox.dataset.step = String(index);
      const text = document.createElement("span");
      text.textContent = step.text;
      label.append(checkbox, text);
      if (schedule[index]) {
        const day = document.createElement("span");
        day.className = `step-day${schedule[index] === today ? " is-today" : ""}`;
        day.textContent = schedule[index] === today ? "today" : formatDay(schedule[index]);
        label.append(day);
      }
      item.classList.toggle("is-done", step.done);
      item.append(label);
      return item;
    }),
    ...(needsEstimate ? [hint] : []),
  );
  return list;
}

/**
 * Ticks or unticks a step. Ticking the last one asks whether the whole assignment is done, rather than
 * marking it done, since there may still be checking or submitting left.
 */
export function toggleAssignmentStep(assignment, index) {
  updateAssignments(toggleStep(state.assignments, assignment.id, index));
  const updated = findAssignment(assignment.id);
  const progress = stepProgress(updated);
  if (!updated.done && progress.done === progress.total) {
    showToast(`All steps done. Mark "${updated.title}" done?`, () => toggleDone(updated), "Mark done");
  }
}

/** The due date and time, plus "due in 3 days" style text for unfinished work. */
export function renderDueParts(assignment, now) {
  const dueAt = document.createElement("time");
  dueAt.dateTime = `${assignment.dueDate}T${assignment.dueTime}`;
  dueAt.textContent = dueFormatter.format(toDueDate(assignment.dueDate, assignment.dueTime));
  if (assignment.done) {
    return [dueAt];
  }
  const { text, urgency } = describeDue(assignment, now);
  const relative = document.createElement("span");
  relative.className = `relative-due urgency-${urgency}`;
  relative.textContent = text;
  return [dueAt, relative];
}

function makeActionButton(label, action, assignmentTitle) {
  const button = makeButton(`link-button action-${action}`, label);
  button.dataset.action = action;
  button.setAttribute("aria-label", `${label} "${assignmentTitle}"`);
  return button;
}

/** The form's Course box suggests courses already in use. */
export function renderCourseSuggestions(courses) {
  elements.courseSuggestions.replaceChildren(...courses.map((course) => makeOption(course)));
}

/** The Course filter lists every course; if the chosen one is gone (its last assignment deleted), it goes back to All. */
export function renderCourseFilter(courses) {
  if (state.courseFilter !== "" && !courses.includes(state.courseFilter) && state.assignments.length > 0) {
    // That course has no assignments any more, so go back to All courses. (An empty list may just be
    // waiting for sync, so the choice is kept until there is a list to check it against.)
    state.courseFilter = "";
    saveFilters();
  }
  elements.courseFilter.replaceChildren(makeOption("", "All courses"), ...courses.map((course) => makeOption(course, course)));
  elements.courseFilter.value = courses.includes(state.courseFilter) ? state.courseFilter : "";
}

/** Sets the filters to the ones saved in this browser, before the first render. */
export function applySavedFilters() {
  const saved = parseSavedFilters(loadText(FILTERS_KEY));
  state.courseFilter = saved.course;
  elements.showSmall.checked = saved.showSmall;
  elements.hideDone.checked = saved.hideDone;
}

/** A filter changed: remember it in this browser (not synced, so each device keeps its own) and redraw. */
export function handleFilterChange() {
  state.courseFilter = elements.courseFilter.value;
  saveFilters();
  render();
}

function saveFilters() {
  const filters = { course: state.courseFilter, showSmall: elements.showSmall.checked, hideDone: elements.hideDone.checked };
  saveChoice(FILTERS_KEY, JSON.stringify(filters));
}

/** "Show 23 older" at the end of Completed, for finished work due over two weeks ago. */
export function renderShowOlder(count) {
  const item = document.createElement("li");
  item.className = "show-older";
  const button = makeButton("link-button", `Show ${count} older`);
  button.dataset.showOlder = "";
  item.append(button);
  return item;
}

export function handleListClick(event) {
  if (event.target.closest("[data-show-older]")) {
    const shownBefore = elements.doneList.querySelectorAll("li[data-id]").length;
    state.showOlderDone = true;
    render();
    // The button is gone, so put focus on the first assignment it revealed.
    elements.doneList.querySelectorAll("li[data-id] .done-checkbox")[shownBefore]?.focus();
    return;
  }
  const seriesToggle = event.target.closest("[data-series-toggle]");
  if (seriesToggle) {
    const seriesId = seriesToggle.dataset.seriesToggle;
    if (!state.expandedSeries.delete(seriesId)) {
      state.expandedSeries.add(seriesId);
    }
    render();
    // render() replaced the link, so put keyboard focus on the new one.
    elements.todoList.querySelector(`[data-series-toggle="${CSS.escape(seriesId)}"]`)?.focus();
    return;
  }
  const control = event.target.closest("[data-action]");
  const item = event.target.closest("li[data-id]");
  if (!control || !item) {
    return;
  }
  const assignment = findAssignment(item.dataset.id);
  if (!assignment) {
    return;
  }
  const list = item.closest("ul");
  const position = [...list.querySelectorAll("li[data-id]")].indexOf(item);

  switch (control.dataset.action) {
    case "toggle-select":
      toggleSelected(assignment.id);
      // The row was redrawn, so put focus back on its new select box.
      list.querySelector(`li[data-id="${CSS.escape(assignment.id)}"] [data-action="toggle-select"]`)?.focus();
      break;
    case "toggle-step": {
      const index = Number(control.dataset.step);
      toggleAssignmentStep(assignment, index);
      // The row was redrawn, so put focus back on the same step's new checkbox.
      list.querySelector(`li[data-id="${CSS.escape(assignment.id)}"] [data-step="${index}"]`)?.focus();
      break;
    }
    case "toggle-done":
      toggleDone(assignment);
      focusRowAt(list, position, "toggle-done");
      break;
    case "snooze": {
      const previous = state.assignments;
      updateAssignments(updateAssignment(previous, assignment.id, { dueDate: snoozeDate() }));
      showToast(`Moved "${assignment.title}" to tomorrow.`, () => updateAssignments(previous));
      // The row moved further down, so keep focus on it rather than losing it.
      list.querySelector(`li[data-id="${CSS.escape(assignment.id)}"] [data-action="edit"]`)?.focus();
      break;
    }
    case "timer-start":
    case "timer-stop": {
      const starting = control.dataset.action === "timer-start";
      const stoppedOther = starting ? state.assignments.find((a) => a.timerStartedAt && a.id !== assignment.id) : null;
      updateAssignments((starting ? startTimer : stopTimer)(state.assignments, assignment.id));
      if (starting) {
        primeChime();
        showToast(stoppedOther ? `Timing "${assignment.title}". Stopped "${stoppedOther.title}".` : `Timing "${assignment.title}".`);
      } else {
        showToast(`Stopped "${assignment.title}": ${spentText(findAssignment(assignment.id))}.`);
      }
      tickTimers();
      // The button changed between Start and Stop, so put focus on the new one.
      list.querySelector(`li[data-id="${CSS.escape(assignment.id)}"] .action-timer`)?.focus();
      break;
    }
    case "extend":
      startExtending(assignment);
      break;
    case "edit":
      startEditing(assignment);
      break;
    case "copy":
      startCopying(assignment);
      break;
    case "delete": {
      const previous = state.assignments;
      if (state.editingId === assignment.id) {
        stopEditing();
      }
      updateAssignments(removeAssignment(previous, assignment.id));
      showToast(`Deleted "${assignment.title}".`, () => updateAssignments(previous));
      focusRowAt(list, position, "delete");
      break;
    }
  }
}

/**
 * After Mark done or Delete the rows are redrawn and the row is gone from this list, so keyboard focus moves to
 * the same control on the row that took its place (the next one, or the last), or to the heading if none is left.
 */
function focusRowAt(list, position, action) {
  const rows = [...list.querySelectorAll("li[data-id]")];
  const row = rows[Math.min(position, rows.length - 1)];
  (row?.querySelector(`[data-action="${action}"]`) ?? elements.listHeading).focus();
}

/** Marks an assignment done (with Undo) or, if it is already done, back to not done. */
export function toggleDone(assignment) {
  // Records when it was finished (for the streak) and stops its timer, so the time so far is kept.
  const markDone = (done) => updateAssignments(setDone(state.assignments, assignment.id, done));
  markDone(!assignment.done);
  if (!assignment.done) {
    showToast(`Done: "${assignment.title}".`, () => markDone(false));
  }
}
