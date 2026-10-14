// Connects the page to the assignment logic and storage: reads the form, renders the lists, handles clicks.

import { createAssignment, describeDue, groupAssignments, toDueDate, validateAssignmentInput } from "./assignments.js";
import { buildMonthGrid, shiftMonth } from "./calendar.js";
import { loadAssignments, saveAssignments } from "./storage.js";

const FIELD_NAMES = ["title", "dueDate", "dueTime", "priority", "notes"];
const TOAST_DURATION_MS = 6000;
const VIEW_STORAGE_KEY = "homework-tracker.view";
const VIEWS = ["list", "calendar"];

const elements = {
  form: document.getElementById("assignment-form"),
  formHeading: document.getElementById("form-heading"),
  submitButton: document.getElementById("submit-button"),
  cancelEdit: document.getElementById("cancel-edit"),
  courseSuggestions: document.getElementById("course-suggestions"),
  showSmall: document.getElementById("show-small"),
  todoList: document.getElementById("todo-list"),
  todoCount: document.getElementById("todo-count"),
  emptyMessage: document.getElementById("empty-message"),
  doneSection: document.getElementById("done-section"),
  doneList: document.getElementById("done-list"),
  doneCount: document.getElementById("done-count"),
  storageError: document.getElementById("storage-error"),
  storageErrorMessage: document.getElementById("storage-error-message"),
  resetStorage: document.getElementById("reset-storage"),
  toast: document.getElementById("toast"),
  toastMessage: document.getElementById("toast-message"),
  toastUndo: document.getElementById("toast-undo"),
  viewButtons: document.querySelectorAll(".view-button"),
  listView: document.getElementById("list-view"),
  calendarView: document.getElementById("calendar-view"),
  calendarMonth: document.getElementById("calendar-month"),
  calendarWeekdays: document.getElementById("calendar-weekdays"),
  calendarBody: document.getElementById("calendar-body"),
  calendarEmpty: document.getElementById("calendar-empty"),
  previousMonth: document.getElementById("previous-month"),
  nextMonth: document.getElementById("next-month"),
  thisMonth: document.getElementById("this-month"),
  details: document.getElementById("calendar-details"),
  detailsTitle: document.getElementById("details-title"),
  detailsTags: document.getElementById("details-tags"),
  detailsDue: document.getElementById("details-due"),
  detailsNotes: document.getElementById("details-notes"),
  detailsClose: document.getElementById("details-close"),
  detailsEdit: document.getElementById("details-edit"),
  detailsDone: document.getElementById("details-done"),
};

const state = {
  assignments: [],
  editingId: null,
  // While saved data is unreadable we never write, so a mistake can't overwrite what is there.
  storageReadable: true,
  toastTimer: null,
  undoAction: null,
  // The assignment whose details box is open on the calendar, or null.
  detailsId: null,
  view: "list",
  // The month the calendar shows, as { year, month } with month 0-11.
  shownMonth: currentMonth(),
};

// Dates always read like "Fri, 10/16, 11:59 PM" and the calendar in English, whatever language the browser uses.
const DATE_LOCALE = "en-US";
const dueFormatter = new Intl.DateTimeFormat(DATE_LOCALE, {
  weekday: "short",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const monthFormatter = new Intl.DateTimeFormat(DATE_LOCALE, { month: "long", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat(DATE_LOCALE, { hour: "numeric", minute: "2-digit" });
const dayFormatter = new Intl.DateTimeFormat(DATE_LOCALE, { weekday: "short", month: "numeric", day: "numeric" });

function currentMonth(now = new Date()) {
  return { year: now.getFullYear(), month: now.getMonth() };
}

// ----- Saving -----

function persist() {
  if (!state.storageReadable) {
    return;
  }
  if (!saveAssignments(localStorage, state.assignments)) {
    showToast("Couldn't save. Your browser blocked storage, so changes will be lost on reload.");
  }
}

function updateAssignments(newAssignments) {
  state.assignments = newAssignments;
  persist();
  render();
}

// ----- Rendering -----

function render() {
  const bigOnly = !elements.showSmall.checked;
  const { todo, done } = groupAssignments(state.assignments, { bigOnly });
  const now = new Date();

  elements.todoList.replaceChildren(...todo.map((assignment) => renderAssignment(assignment, now)));
  elements.todoCount.textContent = todo.length > 0 ? `(${todo.length})` : "";
  elements.emptyMessage.hidden = todo.length > 0;
  elements.emptyMessage.textContent = emptyMessageText(done.length);

  elements.doneList.replaceChildren(...done.map((assignment) => renderAssignment(assignment, now)));
  elements.doneCount.textContent = `(${done.length})`;
  elements.doneSection.hidden = done.length === 0;

  elements.listView.hidden = state.view !== "list";
  elements.calendarView.hidden = state.view !== "calendar";
  for (const button of elements.viewButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.view === state.view));
  }
  if (state.view === "calendar") {
    // The calendar also shows finished work (greyed out), with the same big/small filter as the list.
    renderCalendar([...todo, ...done.filter((a) => !bigOnly || a.priority === "big")], now);
    renderDetails(now);
  } else {
    state.detailsId = null;
    elements.details.hidden = true;
  }

  renderCourseSuggestions();
}

// ----- Calendar -----

function renderCalendar(assignments, now) {
  const weeks = buildMonthGrid(state.shownMonth, assignments, now);
  const monthName = monthFormatter.format(new Date(state.shownMonth.year, state.shownMonth.month, 1));
  elements.calendarMonth.textContent = monthName;

  elements.calendarBody.replaceChildren(
    ...weeks.map((week) => {
      const row = document.createElement("tr");
      row.append(...week.map(renderCalendarDay));
      return row;
    }),
  );

  const leftThisMonth = weeks.flat().some((day) => day.inMonth && day.assignments.some((a) => !a.done));
  elements.calendarEmpty.hidden = leftThisMonth;
  elements.calendarEmpty.textContent =
    state.assignments.length === 0 ? "No assignments yet. Add your first one with the form." : `Nothing left to do in ${monthName}.`;
}

function renderCalendarDay(day) {
  const cell = document.createElement("td");
  cell.className = "calendar-day";
  cell.classList.toggle("outside-month", !day.inMonth);
  cell.classList.toggle("is-today", day.isToday);
  cell.dataset.date = day.key;

  // The day number is a button so the keyboard can add an assignment too; a click anywhere else in the day does the same.
  const dayName = formatDay(day.key);
  const number = document.createElement("button");
  number.type = "button";
  number.className = "day-number";
  number.textContent = day.dayOfMonth;
  number.setAttribute("aria-label", `Add an assignment due ${dayName}${day.isToday ? " (today)" : ""}`);
  cell.title = `Add an assignment due ${dayName}`;
  cell.append(number);

  if (day.assignments.length > 0) {
    const list = document.createElement("ul");
    list.className = "calendar-items";
    list.append(...day.assignments.map(renderCalendarItem));
    cell.append(list);
  }
  return cell;
}

function renderCalendarItem(assignment) {
  const item = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.className = `calendar-item priority-${assignment.priority}`;
  button.classList.toggle("is-done", assignment.done);
  button.classList.toggle("is-selected", assignment.id === state.detailsId);
  button.dataset.id = assignment.id;
  button.textContent = calendarTagText(assignment);
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", String(assignment.id === state.detailsId));

  const dueTime = timeFormatter.format(toDueDate(assignment.dueDate, assignment.dueTime));
  const size = assignment.priority === "big" ? "Big assignment" : "Small reminder";
  const course = assignment.course ? ` (${assignment.course})` : "";
  // The tag is only a short label, so the tooltip and screen-reader label carry the full title.
  button.title = `${assignment.title}${course}, due ${dueTime}`;
  const status = assignment.done ? ", done" : "";
  button.setAttribute("aria-label", `Show details: "${assignment.title}"${course}, ${size}, due ${dueTime}${status}`);

  item.append(button);
  return item;
}

/** The short label on the calendar: the course, or the title's first word when there is no course. */
function calendarTagText(assignment) {
  return assignment.course || assignment.title.split(/\s+/)[0];
}

function renderWeekdayHeadings() {
  const shortName = new Intl.DateTimeFormat(DATE_LOCALE, { weekday: "short" });
  const longName = new Intl.DateTimeFormat(DATE_LOCALE, { weekday: "long" });
  // 2026-10-04 is a Sunday, so the next seven days give the weekday names in grid order.
  const week = Array.from({ length: 7 }, (_, index) => new Date(2026, 9, 4 + index));
  elements.calendarWeekdays.replaceChildren(
    ...week.map((date) => {
      const heading = document.createElement("th");
      heading.scope = "col";
      const abbreviation = document.createElement("abbr");
      abbreviation.title = longName.format(date);
      abbreviation.textContent = shortName.format(date);
      heading.append(abbreviation);
      return heading;
    }),
  );
}

function handleCalendarClick(event) {
  const button = event.target.closest(".calendar-item");
  if (button) {
    // Clicking the open tag again closes its box.
    toggleDetails(button.dataset.id === state.detailsId ? null : button.dataset.id);
    return;
  }
  const cell = event.target.closest(".calendar-day");
  // While a details box is open, a click elsewhere only closes it (see handleOutsideClick).
  if (cell && !state.detailsId) {
    startAddingOn(cell.dataset.date);
  }
}

/** Starts a new assignment due on the clicked calendar day. */
function startAddingOn(dateKey) {
  if (state.editingId) {
    stopEditing();
  }
  elements.form.elements.dueDate.value = dateKey;
  showErrors({});
  elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
  elements.form.elements.title.focus({ preventScroll: true });
  showToast(`New assignment due ${formatDay(dateKey)}. Type a name.`);
}

/** "Wed, 10/21" for a "YYYY-MM-DD" date. */
function formatDay(dateKey) {
  return dayFormatter.format(toDueDate(dateKey, "12:00"));
}

// ----- Calendar details box -----

function toggleDetails(assignmentId) {
  const closingId = state.detailsId;
  state.detailsId = assignmentId;
  render();
  if (assignmentId) {
    elements.details.focus();
  } else if (closingId) {
    // Put keyboard focus back on the tag that opened the box.
    calendarItemButton(closingId)?.focus();
  }
}

function calendarItemButton(assignmentId) {
  return elements.calendarBody.querySelector(`.calendar-item[data-id="${CSS.escape(assignmentId)}"]`);
}

function renderDetails(now) {
  const assignment = state.assignments.find((a) => a.id === state.detailsId);
  const button = assignment && calendarItemButton(assignment.id);
  if (!button) {
    // The assignment was deleted, hidden by the small-reminders filter, or is in another month: close the box.
    state.detailsId = null;
    elements.details.hidden = true;
    return;
  }

  elements.detailsTitle.textContent = assignment.title;
  elements.detailsTags.replaceChildren(...renderTags(assignment));
  elements.detailsDue.replaceChildren(...renderDueParts(assignment, now));
  // textContent (not innerHTML) so anything typed in a note is shown as text, never run as HTML.
  elements.detailsNotes.textContent = assignment.notes || "No notes.";
  elements.detailsNotes.classList.toggle("is-empty", !assignment.notes);
  elements.detailsDone.textContent = assignment.done ? "Mark not done" : "Mark done";
  elements.details.hidden = false;
  positionDetails(button);
}

/** Places the box just below the tag, kept inside the calendar's width. */
function positionDetails(button) {
  const container = elements.calendarView.getBoundingClientRect();
  const tag = button.getBoundingClientRect();
  const boxWidth = elements.details.offsetWidth;
  const left = Math.min(Math.max(0, tag.left - container.left), container.width - boxWidth);
  elements.details.style.left = `${Math.max(0, left)}px`;
  elements.details.style.top = `${tag.bottom - container.top + 4}px`;
}

function handleOutsideClick(event) {
  if (state.detailsId && !elements.details.contains(event.target) && !event.target.closest(".calendar-item")) {
    toggleDetails(null);
  }
}

function showMonth(month) {
  state.shownMonth = month;
  render();
}

// ----- Switching between list and calendar -----

function setView(view) {
  state.view = view;
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Remembering the view is only a convenience; the app works the same without it.
  }
  render();
}

function loadSavedView() {
  try {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    return VIEWS.includes(saved) ? saved : "list";
  } catch {
    return "list";
  }
}

function emptyMessageText(doneCount) {
  const hiddenSmall = !elements.showSmall.checked && state.assignments.some((a) => !a.done && a.priority === "small");
  if (hiddenSmall) {
    return "No big assignments left. Small reminders are hidden.";
  }
  if (doneCount > 0) {
    return "All caught up. Nothing left to do.";
  }
  return "No assignments yet. Add your first one with the form.";
}

function renderAssignment(assignment, now) {
  const item = document.createElement("li");
  item.className = `assignment priority-${assignment.priority}${assignment.done ? " is-done" : ""}`;
  item.dataset.id = assignment.id;
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
    // textContent (not innerHTML) so anything typed in a note is shown as text, never run as HTML.
    notes.textContent = assignment.notes;
    body.append(notes);
  }

  const actions = document.createElement("div");
  actions.className = "item-actions";
  actions.append(makeActionButton("Edit", "edit", assignment.title), makeActionButton("Delete", "delete", assignment.title));

  item.append(checkbox, body, actions);
  return item;
}

/** The course tag (if any) and the Big/Small tag, shared by the list and the calendar details box. */
function renderTags(assignment) {
  const tags = [];
  if (assignment.course) {
    tags.push(makeTag(assignment.course, "course-tag"));
  }
  tags.push(makeTag(assignment.priority === "big" ? "Big" : "Small", `priority-tag priority-tag-${assignment.priority}`));
  return tags;
}

/** The due date and time, plus "due in 3 days" style text for unfinished work. */
function renderDueParts(assignment, now) {
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

function makeTag(text, className) {
  const tag = document.createElement("span");
  tag.className = className;
  tag.textContent = text;
  return tag;
}

function makeActionButton(label, action, assignmentTitle) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `link-button action-${action}`;
  button.dataset.action = action;
  button.textContent = label;
  button.setAttribute("aria-label", `${label} "${assignmentTitle}"`);
  return button;
}

function renderCourseSuggestions() {
  const courses = [...new Set(state.assignments.map((a) => a.course).filter(Boolean))].sort();
  elements.courseSuggestions.replaceChildren(
    ...courses.map((course) => {
      const option = document.createElement("option");
      option.value = course;
      return option;
    }),
  );
}

// ----- The form -----

function readForm() {
  const data = new FormData(elements.form);
  return Object.fromEntries(["title", "course", "dueDate", "dueTime", "priority", "notes"].map((name) => [name, data.get(name) ?? ""]));
}

function showErrors(errors) {
  for (const name of FIELD_NAMES) {
    const message = errors[name] ?? "";
    document.getElementById(`${name}-error`).textContent = message;
    const input = elements.form.elements[name];
    if (input instanceof HTMLElement) {
      input.toggleAttribute("aria-invalid", message !== "");
    }
  }
  const firstInvalid = FIELD_NAMES.find((name) => errors[name]);
  if (firstInvalid && elements.form.elements[firstInvalid] instanceof HTMLElement) {
    elements.form.elements[firstInvalid].focus();
  }
}

function handleSubmit(event) {
  event.preventDefault();
  const result = validateAssignmentInput(readForm());
  if (!result.ok) {
    showErrors(result.errors);
    return;
  }
  showErrors({});

  if (state.editingId) {
    const editedTitle = result.fields.title;
    updateAssignments(state.assignments.map((a) => (a.id === state.editingId ? { ...a, ...result.fields } : a)));
    stopEditing();
    showToast(`Saved changes to "${editedTitle}".`);
  } else {
    updateAssignments([...state.assignments, createAssignment(result.fields)]);
    resetForm();
    showToast(`Added "${result.fields.title}".`);
  }
}

function resetForm() {
  elements.form.reset();
  showErrors({});
  elements.form.elements.title.focus();
}

function startEditing(assignment) {
  state.editingId = assignment.id;
  const fields = elements.form.elements;
  fields.title.value = assignment.title;
  fields.course.value = assignment.course;
  fields.dueDate.value = assignment.dueDate;
  fields.dueTime.value = assignment.dueTime;
  fields.priority.value = assignment.priority;
  fields.notes.value = assignment.notes;
  showErrors({});
  elements.formHeading.textContent = "Edit assignment";
  elements.submitButton.textContent = "Save changes";
  elements.cancelEdit.hidden = false;
  render();
  elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
  fields.title.focus({ preventScroll: true });
}

function stopEditing() {
  state.editingId = null;
  elements.formHeading.textContent = "Add an assignment";
  elements.submitButton.textContent = "Add assignment";
  elements.cancelEdit.hidden = true;
  resetForm();
  render();
}

// ----- List actions -----

function handleListClick(event) {
  const control = event.target.closest("[data-action]");
  const item = event.target.closest(".assignment");
  if (!control || !item) {
    return;
  }
  const assignment = state.assignments.find((a) => a.id === item.dataset.id);
  if (!assignment) {
    return;
  }

  switch (control.dataset.action) {
    case "toggle-done":
      toggleDone(assignment);
      break;
    case "edit":
      startEditing(assignment);
      break;
    case "delete": {
      const previous = state.assignments;
      if (state.editingId === assignment.id) {
        stopEditing();
      }
      updateAssignments(previous.filter((a) => a.id !== assignment.id));
      showToast(`Deleted "${assignment.title}".`, () => updateAssignments(previous));
      break;
    }
  }
}

/** Marks an assignment done (with Undo) or, if it is already done, back to not done. */
function toggleDone(assignment) {
  const setDone = (done) => updateAssignments(state.assignments.map((a) => (a.id === assignment.id ? { ...a, done } : a)));
  setDone(!assignment.done);
  if (!assignment.done) {
    showToast(`Done: "${assignment.title}".`, () => setDone(false));
  }
}

// ----- Toast (short confirmation message, optionally with Undo) -----

function showToast(message, undoAction = null) {
  clearTimeout(state.toastTimer);
  state.undoAction = undoAction;
  elements.toastMessage.textContent = message;
  elements.toastUndo.hidden = undoAction === null;
  elements.toast.hidden = false;
  state.toastTimer = setTimeout(hideToast, TOAST_DURATION_MS);
}

function hideToast() {
  elements.toast.hidden = true;
  state.undoAction = null;
}

function handleUndo() {
  const undo = state.undoAction;
  hideToast();
  if (undo) {
    undo();
  }
}

// ----- Start up -----

function start() {
  const loaded = loadAssignments(localStorage);
  if (loaded.ok) {
    state.assignments = loaded.assignments;
  } else {
    state.storageReadable = false;
    elements.storageErrorMessage.textContent = `${loaded.error} Nothing new will be saved until you start over.`;
    elements.storageError.hidden = false;
  }

  elements.form.addEventListener("submit", handleSubmit);
  elements.cancelEdit.addEventListener("click", stopEditing);
  elements.showSmall.addEventListener("change", render);
  elements.todoList.addEventListener("click", handleListClick);
  elements.doneList.addEventListener("click", handleListClick);
  elements.toastUndo.addEventListener("click", handleUndo);
  elements.calendarBody.addEventListener("click", handleCalendarClick);
  elements.detailsClose.addEventListener("click", () => toggleDetails(null));
  elements.detailsEdit.addEventListener("click", () => {
    const assignment = state.assignments.find((a) => a.id === state.detailsId);
    toggleDetails(null);
    if (assignment) {
      startEditing(assignment);
    }
  });
  elements.detailsDone.addEventListener("click", () => {
    const assignment = state.assignments.find((a) => a.id === state.detailsId);
    if (assignment) {
      toggleDone(assignment);
    }
  });
  document.addEventListener("click", handleOutsideClick);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.detailsId) {
      toggleDetails(null);
    }
  });
  for (const button of elements.viewButtons) {
    button.addEventListener("click", () => setView(button.dataset.view));
  }
  elements.previousMonth.addEventListener("click", () => showMonth(shiftMonth(state.shownMonth, -1)));
  elements.nextMonth.addEventListener("click", () => showMonth(shiftMonth(state.shownMonth, 1)));
  elements.thisMonth.addEventListener("click", () => showMonth(currentMonth()));
  elements.resetStorage.addEventListener("click", () => {
    state.storageReadable = true;
    elements.storageError.hidden = true;
    updateAssignments([]);
    showToast("Started over with an empty list.");
  });

  state.view = loadSavedView();
  renderWeekdayHeadings();

  // Refresh the "due in …" text every minute so it stays accurate if the tab stays open.
  setInterval(render, 60 * 1000);
  render();
}

start();
