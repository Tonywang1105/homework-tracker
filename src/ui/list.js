// The to-do and completed lists: drawing rows and tags, and the row actions (done, edit, delete).

import {
  assignmentType,
  describeDue,
  formatHours,
  parseSavedFilters,
  PRIORITY_LABELS,
  removeAssignment,
  searchWords,
  toDueDate,
  TYPE_LABELS,
  updateAssignment,
} from "../assignments.js?v=d1468b95";
import { render } from "../main.js?v=d1468b95";
import { dueFormatter, elements, formatDay, makeButton, makeOption, makeTag, showNote } from "./dom.js?v=d1468b95";
import { startEditing, stopEditing } from "./form.js?v=d1468b95";
import { findAssignment, loadText, saveChoice, state, updateAssignments } from "./store.js?v=d1468b95";
import { showToast } from "./toast.js?v=d1468b95";

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
  checkbox.className = "done-checkbox";
  checkbox.checked = assignment.done;
  checkbox.dataset.action = "toggle-done";
  checkbox.setAttribute("aria-label", `Mark "${assignment.title}" as ${assignment.done ? "not done" : "done"}`);

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
  if (assignment.notes) {
    const notes = document.createElement("p");
    notes.className = "notes";
    showNote(notes, assignment.notes);
    body.append(notes);
  }

  const actions = document.createElement("div");
  actions.className = "item-actions";
  actions.append(makeActionButton("Edit", "edit", assignment.title), makeActionButton("Delete", "delete", assignment.title));

  item.append(checkbox, body, actions);
  return item;
}

/** The course tag, the type tag (if any) and the Big/Small tag, shared by the list and the calendar details box. */
export function renderTags(assignment) {
  const tags = [];
  if (assignment.course) {
    tags.push(makeTag(assignment.course, "course-tag"));
  }
  const type = assignmentType(assignment);
  if (type) {
    tags.push(makeTag(TYPE_LABELS[type], `type-tag type-${type}`));
  }
  if (assignment.hours) {
    tags.push(makeTag(formatHours(assignment.hours), "hours-tag"));
  }
  const start = state.startPlan.get(assignment.id);
  if (start) {
    tags.push(makeTag(startText(start), `start-tag start-${start.status}`));
  }
  tags.push(makeTag(PRIORITY_LABELS[assignment.priority], `priority-tag priority-tag-${assignment.priority}`));
  return tags;
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

export function handleListClick(event) {
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
    case "toggle-done":
      toggleDone(assignment);
      focusRowAt(list, position, "toggle-done");
      break;
    case "edit":
      startEditing(assignment);
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
  const setDone = (done) => updateAssignments(updateAssignment(state.assignments, assignment.id, { done }));
  setDone(!assignment.done);
  if (!assignment.done) {
    showToast(`Done: "${assignment.title}".`, () => setDone(false));
  }
}
