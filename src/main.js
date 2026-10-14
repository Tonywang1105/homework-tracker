// Connects the page to the assignment logic and storage: reads the form, renders the lists, handles clicks.

import {
  assignmentType,
  AUTO_TYPE,
  courseNames,
  createAssignment,
  describeDue,
  dueSoon,
  filterAssignments,
  groupAssignments,
  PRIORITY_LABELS,
  removeAssignment,
  toDueDate,
  TYPE_LABELS,
  TYPES,
  updateAssignment,
  validateAssignmentInput,
} from "./assignments.js?v=c86de48e";
import { backupFileName, createBackup, readBackup } from "./backup.js?v=c86de48e";
import { buildMonthGrid, calendarTagText, currentMonth, shiftMonth, visibleOnDay } from "./calendar.js?v=c86de48e";
import { isIcsCalendar, mergeCanvasAssignments, readCanvasAssignments } from "./canvas.js?v=c86de48e";
import { exampleAssignments, hasExamples, removeExamples } from "./examples.js?v=c86de48e";
import { loadAssignments, saveAssignments } from "./storage.js?v=c86de48e";

const FIELD_NAMES = ["title", "dueDate", "dueTime", "priority", "type", "notes"];
const TOAST_DURATION_MS = 6000;
const VIEW_STORAGE_KEY = "homework-tracker.view";
const VIEWS = ["list", "calendar"];
// Also read by the small script at the top of index.html, which applies the theme before the page is drawn.
const THEME_STORAGE_KEY = "homework-tracker.theme";
const THEMES = ["system", "light", "dark"];
// A day shows at most this many lines (tags, or tags plus a "+N more" link), so one busy day can't stretch its week.
const MAX_LINES_PER_DAY = 3;
// A semester's Canvas feed or a backup is well under 1 MB; anything far bigger is the wrong file.
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
// How screen readers hear each size on the calendar.
const SIZE_NAMES = { big: "Big assignment", regular: "Regular assignment", small: "Small reminder" };

const elements = {
  form: document.getElementById("assignment-form"),
  formHeading: document.getElementById("form-heading"),
  submitButton: document.getElementById("submit-button"),
  cancelEdit: document.getElementById("cancel-edit"),
  courseSuggestions: document.getElementById("course-suggestions"),
  showSmall: document.getElementById("show-small"),
  hideDone: document.getElementById("hide-done"),
  courseFilter: document.getElementById("course-filter"),
  todoList: document.getElementById("todo-list"),
  todoCount: document.getElementById("todo-count"),
  emptyMessage: document.getElementById("empty-message"),
  dueSoon: document.getElementById("due-soon"),
  dueSoonCount: document.getElementById("due-soon-count"),
  dueSoonList: document.getElementById("due-soon-list"),
  gettingStarted: document.getElementById("getting-started"),
  tryExamples: document.getElementById("try-examples"),
  exampleBar: document.getElementById("example-bar"),
  removeExamples: document.getElementById("remove-examples"),
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
  themeButtons: document.querySelectorAll(".theme-button"),
  listView: document.getElementById("list-view"),
  calendarView: document.getElementById("calendar-view"),
  calendarMonth: document.getElementById("calendar-month"),
  calendarWeekdays: document.getElementById("calendar-weekdays"),
  typeLegend: document.getElementById("type-legend"),
  calendarBody: document.getElementById("calendar-body"),
  calendarEmpty: document.getElementById("calendar-empty"),
  previousMonth: document.getElementById("previous-month"),
  nextMonth: document.getElementById("next-month"),
  thisMonth: document.getElementById("this-month"),
  canvasImportButton: document.getElementById("canvas-import-button"),
  canvasFile: document.getElementById("canvas-file"),
  backupDownloadButton: document.getElementById("backup-download-button"),
  backupRestoreButton: document.getElementById("backup-restore-button"),
  backupFile: document.getElementById("backup-file"),
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
  // Calendar days ("YYYY-MM-DD") whose "+N more" link was clicked, so they show every tag.
  expandedDays: new Set(),
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

// ----- Saving -----

function persist() {
  if (!state.storageReadable) {
    return;
  }
  if (!saveAssignments(localStorage, state.assignments)) {
    showToast("Couldn't save. Your browser blocked storage, so changes will be lost on reload.");
  }
}

function findAssignment(id) {
  return state.assignments.find((a) => a.id === id);
}

function updateAssignments(newAssignments) {
  state.assignments = newAssignments;
  persist();
  render();
}

// ----- Rendering -----

function render() {
  const courses = courseNames(state.assignments);
  renderCourseFilter(courses);
  renderCourseSuggestions(courses);

  const filters = {
    course: elements.courseFilter.value,
    hideSmall: !elements.showSmall.checked,
    hideDone: elements.hideDone.checked,
  };
  // The list and the calendar both draw from this, so they always agree.
  const visible = filterAssignments(state.assignments, filters);
  const { todo, done } = groupAssignments(visible);
  const now = new Date();
  // Shared by the Due soon box (calendar) and the tinted rows (list), so both views agree on what is urgent.
  const soon = dueSoon(state.assignments, now);
  const soonIds = new Set(soon.map((a) => a.id));

  elements.todoList.replaceChildren(...todo.map((assignment) => renderAssignment(assignment, now, soonIds)));
  elements.todoCount.textContent = todo.length > 0 ? `(${todo.length})` : "";
  // With no assignments at all, the getting-started box (with the examples button) takes the place of the empty messages.
  const noAssignments = state.assignments.length === 0;
  elements.gettingStarted.hidden = !noAssignments;
  elements.exampleBar.hidden = !hasExamples(state.assignments);
  elements.emptyMessage.hidden = todo.length > 0 || noAssignments;
  renderDueSoon(soon, now);
  elements.emptyMessage.textContent = emptyMessageText(filters);

  elements.doneList.replaceChildren(...done.map((assignment) => renderAssignment(assignment, now)));
  elements.doneCount.textContent = `(${done.length})`;
  elements.doneSection.hidden = done.length === 0;

  elements.listView.hidden = state.view !== "list";
  elements.calendarView.hidden = state.view !== "calendar";
  for (const button of elements.viewButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.view === state.view));
  }
  if (state.view === "calendar") {
    // Unless "Hide completed" is ticked, the calendar also shows finished work, greyed out.
    renderCalendar(visible, filters.course, now);
    renderDetails(now);
  } else {
    state.detailsId = null;
    elements.details.hidden = true;
  }
}

// ----- Calendar -----

function renderCalendar(assignments, course, now) {
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
  elements.calendarEmpty.hidden = leftThisMonth || state.assignments.length === 0;
  const forCourse = course ? ` for ${course}` : "";
  elements.calendarEmpty.textContent = `Nothing left to do${forCourse} in ${monthName}.`;
}

function renderCalendarDay(day) {
  const cell = document.createElement("td");
  cell.className = "calendar-day";
  cell.classList.toggle("outside-month", !day.inMonth);
  cell.classList.toggle("is-today", day.isToday);
  cell.dataset.date = day.key;

  // The day number is a button so the keyboard can add an assignment too; a click anywhere else in the day does the same.
  const dayName = formatDay(day.key);
  const number = makeButton("day-number", day.dayOfMonth);
  number.setAttribute("aria-label", `Add an assignment due ${dayName}${day.isToday ? " (today)" : ""}`);
  cell.title = `Add an assignment due ${dayName}`;
  cell.append(number);

  if (day.assignments.length > 0) {
    const { shown, hiddenCount, hasToggle } = visibleOnDay(day.assignments, {
      maxLines: MAX_LINES_PER_DAY,
      expanded: state.expandedDays.has(day.key),
    });
    const list = document.createElement("ul");
    list.className = "calendar-items";
    list.append(...shown.map(renderCalendarItem));
    if (hasToggle) {
      list.append(renderMoreToggle(hiddenCount, dayName));
    }
    cell.append(list);
  }
  return cell;
}

/** "+2 more" on a busy day, or "Show less" once it is expanded. */
function renderMoreToggle(hiddenCount, dayName) {
  const item = document.createElement("li");
  const button = makeButton("calendar-more");
  if (hiddenCount > 0) {
    // On a phone the day is too narrow for "+3 more", so CSS hides the word "more" there.
    const moreWord = document.createElement("span");
    moreWord.className = "more-word";
    moreWord.textContent = " more";
    button.append(`+${hiddenCount}`, moreWord);
  } else {
    button.textContent = "Show less";
  }
  button.setAttribute(
    "aria-label",
    hiddenCount > 0 ? `Show ${hiddenCount} more assignments due ${dayName}` : `Show fewer assignments for ${dayName}`,
  );
  item.append(button);
  return item;
}

function renderCalendarItem(assignment) {
  const item = document.createElement("li");
  const button = makeButton(`calendar-item priority-${assignment.priority}`, calendarTagText(assignment));
  button.classList.toggle("is-done", assignment.done);
  button.classList.toggle("is-selected", assignment.id === state.detailsId);
  button.dataset.id = assignment.id;
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", String(assignment.id === state.detailsId));

  const dueTime = timeFormatter.format(toDueDate(assignment.dueDate, assignment.dueTime));
  const size = SIZE_NAMES[assignment.priority];
  const course = assignment.course ? ` (${assignment.course})` : "";
  const type = assignmentType(assignment);
  const typeName = type ? `${TYPE_LABELS[type]}, ` : "";
  if (type) {
    const dot = document.createElement("span");
    dot.className = `type-dot type-${type}`;
    button.prepend(dot);
  }
  // The tag is only a short label, so the tooltip and screen-reader label carry the full title.
  button.title = `${assignment.title}${course}, ${typeName}due ${dueTime}`;
  const status = assignment.done ? ", done" : "";
  button.setAttribute("aria-label", `Show details: "${assignment.title}"${course}, ${typeName}${size}, due ${dueTime}${status}`);

  item.append(button);
  return item;
}

/** The color key under the calendar, built from the same list of types the app uses everywhere. */
function renderTypeLegend() {
  elements.typeLegend.replaceChildren(
    ...TYPES.map((type) => {
      const item = document.createElement("li");
      item.className = `type-${type}`;
      item.textContent = TYPE_LABELS[type];
      return item;
    }),
  );
}

function renderTypeOptions() {
  elements.form.elements.type.append(...TYPES.map((type) => makeOption(type, TYPE_LABELS[type])));
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
  const moreToggle = event.target.closest(".calendar-more");
  if (moreToggle) {
    const dateKey = moreToggle.closest(".calendar-day").dataset.date;
    if (!state.expandedDays.delete(dateKey)) {
      state.expandedDays.add(dateKey);
    }
    render();
    // render() replaced the button, so put keyboard focus on the new one.
    elements.calendarBody.querySelector(`.calendar-day[data-date="${dateKey}"] .calendar-more`)?.focus();
    return;
  }
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
  const assignment = findAssignment(state.detailsId);
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
  state.expandedDays.clear();
  render();
}

// ----- Switching between list and calendar -----

function setView(view) {
  state.view = view;
  saveChoice(VIEW_STORAGE_KEY, view);
  render();
}

// ----- Remembered choices (view and theme) -----

/** Remembering a choice is only a convenience, so if the browser blocks storage the app just carries on. */
function saveChoice(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nothing to do: the choice still applies until the page is reloaded.
  }
}

/** The saved choice if it is one of `allowed`, otherwise `fallback`. */
function loadChoice(key, allowed, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return allowed.includes(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

// ----- Color theme -----

/** "system" follows the computer's light or dark setting; "light" and "dark" override it. */
function applyTheme(theme) {
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
  for (const button of elements.themeButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme));
  }
}

function setTheme(theme) {
  applyTheme(theme);
  saveChoice(THEME_STORAGE_KEY, theme);
}

// ----- Due soon -----

/** The reminder box on the calendar: everything unfinished that is overdue or due within a day, whatever the filters. */
function renderDueSoon(soon, now) {
  // Only in Calendar view: in List view the same items already sit at the top, tinted (see renderAssignment).
  elements.dueSoon.hidden = soon.length === 0 || state.view !== "calendar";
  elements.dueSoonCount.textContent = `(${soon.length})`;
  elements.dueSoonList.replaceChildren(...soon.map((assignment) => renderDueSoonItem(assignment, now)));
}

function renderDueSoonItem(assignment, now) {
  const item = document.createElement("li");
  item.className = "due-soon-item";
  item.dataset.id = assignment.id;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "done-checkbox";
  checkbox.dataset.action = "toggle-done";
  checkbox.setAttribute("aria-label", `Mark "${assignment.title}" as done`);

  const title = makeButton("link-button", assignment.title);
  title.dataset.action = "edit";
  title.setAttribute("aria-label", `Edit "${assignment.title}"`);

  const type = assignmentType(assignment);
  if (type) {
    const dot = document.createElement("span");
    dot.className = `type-dot type-${type}`;
    title.prepend(dot);
  }

  const { text, urgency } = describeDue(assignment, now);
  const relative = makeTag(text, `relative-due urgency-${urgency}`);
  item.append(checkbox, title);
  if (assignment.course) {
    item.append(makeTag(assignment.course, "course-tag"));
  }
  item.append(relative);
  return item;
}

/** Why the to-do list is empty, naming any filter that hides work so it never looks like lost data. */
function emptyMessageText({ course, hideSmall }) {
  if (!state.assignments.some((a) => !a.done)) {
    return "All caught up. Nothing left to do.";
  }
  const smallHidden = hideSmall ? " Small reminders are hidden." : "";
  if (course) {
    return `Nothing left to do for ${course}.${smallHidden}`;
  }
  return `Nothing left but small reminders.${smallHidden}`;
}

function renderAssignment(assignment, now, soonIds = new Set()) {
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

/** The course tag, the type tag (if any) and the Big/Small tag, shared by the list and the calendar details box. */
function renderTags(assignment) {
  const tags = [];
  if (assignment.course) {
    tags.push(makeTag(assignment.course, "course-tag"));
  }
  const type = assignmentType(assignment);
  if (type) {
    tags.push(makeTag(TYPE_LABELS[type], `type-tag type-${type}`));
  }
  tags.push(makeTag(PRIORITY_LABELS[assignment.priority], `priority-tag priority-tag-${assignment.priority}`));
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
  const button = makeButton(`link-button action-${action}`, label);
  button.dataset.action = action;
  button.setAttribute("aria-label", `${label} "${assignmentTitle}"`);
  return button;
}

/** A plain button (type="button", so it never submits a form) with a class and optional text. */
function makeButton(className, text = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  return button;
}

/** The form's Course box suggests courses already in use. */
function renderCourseSuggestions(courses) {
  elements.courseSuggestions.replaceChildren(...courses.map((course) => makeOption(course)));
}

/** The Course filter lists every course; if the chosen one is gone (its last assignment deleted), it goes back to All. */
function renderCourseFilter(courses) {
  const chosen = courses.includes(elements.courseFilter.value) ? elements.courseFilter.value : "";
  elements.courseFilter.replaceChildren(makeOption("", "All courses"), ...courses.map((course) => makeOption(course, course)));
  elements.courseFilter.value = chosen;
}

function makeOption(value, text) {
  const option = document.createElement("option");
  option.value = value;
  if (text !== undefined) {
    option.textContent = text;
  }
  return option;
}

// ----- The form -----

function readForm() {
  const data = new FormData(elements.form);
  return Object.fromEntries(["title", "course", "dueDate", "dueTime", "priority", "type", "notes"].map((name) => [name, data.get(name) ?? ""]));
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
    updateAssignments(updateAssignment(state.assignments, state.editingId, result.fields));
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
  // Assignments saved before types existed have none stored, so the form offers the guess again.
  fields.type.value = assignment.type ?? AUTO_TYPE;
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
  // Rows in the list and in the Due soon box both carry the assignment's id.
  const item = event.target.closest("li[data-id]");
  if (!control || !item) {
    return;
  }
  const assignment = findAssignment(item.dataset.id);
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
      updateAssignments(removeAssignment(previous, assignment.id));
      showToast(`Deleted "${assignment.title}".`, () => updateAssignments(previous));
      break;
    }
  }
}

/** Marks an assignment done (with Undo) or, if it is already done, back to not done. */
function toggleDone(assignment) {
  const setDone = (done) => updateAssignments(updateAssignment(state.assignments, assignment.id, { done }));
  setDone(!assignment.done);
  if (!assignment.done) {
    showToast(`Done: "${assignment.title}".`, () => setDone(false));
  }
}

// ----- Canvas import -----

// The two panels under the To do list ("Import from Canvas…" and "Backup & restore…"). Only one is open at a time.
const panels = [
  { toggleId: "canvas-panel-toggle", panelId: "import-panel", firstButtonId: "canvas-import-button", closeId: "canvas-panel-close" },
  { toggleId: "backup-panel-toggle", panelId: "backup-panel", firstButtonId: "backup-download-button", closeId: "backup-panel-close" },
].map(({ toggleId, panelId, firstButtonId, closeId }) => ({
  toggle: document.getElementById(toggleId),
  panel: document.getElementById(panelId),
  firstButton: document.getElementById(firstButtonId),
  close: document.getElementById(closeId),
}));

function setPanelOpen(chosen, open) {
  for (const panel of panels) {
    const isOpen = open && panel === chosen;
    panel.panel.hidden = !isOpen;
    panel.toggle.setAttribute("aria-expanded", String(isOpen));
  }
  // Focus first: moving focus after starting a smooth scroll cancels the scroll in Chrome.
  (open ? chosen.firstButton : chosen.toggle).focus({ preventScroll: true });
  if (open) {
    // Scroll far enough to show the buttons, which sit below the how-to text.
    chosen.close.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

/**
 * Reads the file just chosen in a hidden file input. Returns its { file, text }, or null after
 * telling the student what went wrong. `kind` names the file in messages, e.g. "Canvas calendar file".
 */
async function readChosenFile(input, kind) {
  const file = input.files[0];
  // Clear the choice so picking the same file again still fires "change".
  input.value = "";
  if (!file) {
    return null;
  }
  if (file.size > MAX_IMPORT_BYTES) {
    showToast(`"${file.name}" is too big to be a ${kind}.`);
    return null;
  }
  try {
    return { file, text: await file.text() };
  } catch {
    showToast(`Couldn't read "${file.name}". Try choosing it again.`);
    return null;
  }
}

async function handleCanvasFile() {
  const chosen = await readChosenFile(elements.canvasFile, "Canvas calendar file");
  if (!chosen) {
    return;
  }
  const { file, text } = chosen;
  if (!isIcsCalendar(text)) {
    showToast(`"${file.name}" isn't a calendar (.ics) file. Use the Calendar Feed link in Canvas Calendar.`);
    return;
  }
  const imported = readCanvasAssignments(text);
  if (imported.length === 0) {
    showToast("No Canvas assignments found in that file.");
    return;
  }

  const previous = state.assignments;
  const result = mergeCanvasAssignments(previous, imported);
  if (result.added === 0 && result.updated === 0) {
    showToast(importSummary(result));
    return;
  }
  updateAssignments(result.assignments);
  showToast(importSummary(result), () => updateAssignments(previous));
}

/** "Imported 3 new, updated 1. Skipped 2 already past due." */
function importSummary({ added, updated, skippedPast }) {
  const changes = [];
  if (added > 0) {
    changes.push(`imported ${added} new`);
  }
  if (updated > 0) {
    changes.push(`updated ${updated}`);
  }
  let summary = changes.length > 0 ? `Canvas: ${changes.join(", ")}.` : "Canvas: already up to date.";
  if (skippedPast > 0) {
    summary += ` Skipped ${skippedPast} already past due.`;
  }
  return summary;
}

// ----- Backup and restore -----

/** "1 assignment", "12 assignments" */
function countAssignments(count) {
  return `${count} assignment${count === 1 ? "" : "s"}`;
}

function handleBackupDownload() {
  if (state.assignments.length === 0) {
    showToast("Nothing to back up yet.");
    return;
  }
  const fileName = backupFileName();
  const contents = JSON.stringify(createBackup(state.assignments), null, 2);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  link.download = fileName;
  link.click();
  // Give the browser a moment to start the download before freeing the file's memory.
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showToast(`Backed up ${countAssignments(state.assignments.length)} to ${fileName}.`);
}

async function handleBackupFile() {
  const chosen = await readChosenFile(elements.backupFile, "Homework Tracker backup");
  if (!chosen) {
    return;
  }
  const result = readBackup(chosen.text);
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  const previous = state.assignments;
  const replacing = `Replace your ${countAssignments(previous.length)} with the ${countAssignments(result.assignments.length)} in this backup?`;
  if (previous.length > 0 && !window.confirm(replacing)) {
    return;
  }

  // A restore is also the way back from unreadable saved data, so saving is allowed again.
  state.storageReadable = true;
  elements.storageError.hidden = true;
  updateAssignments(result.assignments);
  const skipped = result.skipped > 0 ? ` Skipped ${result.skipped} that couldn't be read.` : "";
  showToast(`Restored ${countAssignments(result.assignments.length)}.${skipped}`, () => updateAssignments(previous));
}

// ----- Example assignments -----

function addExamples() {
  const examples = exampleAssignments();
  updateAssignments([...state.assignments, ...examples]);
  showToast(`Added ${countAssignments(examples.length)} as examples. Try the calendar, filters and details.`);
}

function handleRemoveExamples() {
  const previous = state.assignments;
  updateAssignments(removeExamples(previous));
  showToast("Removed the example assignments.", () => updateAssignments(previous));
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
  for (const panel of panels) {
    panel.toggle.addEventListener("click", () => setPanelOpen(panel, panel.panel.hidden));
    panel.close.addEventListener("click", () => setPanelOpen(panel, false));
  }
  elements.canvasImportButton.addEventListener("click", () => elements.canvasFile.click());
  elements.canvasFile.addEventListener("change", handleCanvasFile);
  elements.backupDownloadButton.addEventListener("click", handleBackupDownload);
  elements.backupRestoreButton.addEventListener("click", () => elements.backupFile.click());
  elements.backupFile.addEventListener("change", handleBackupFile);
  elements.tryExamples.addEventListener("click", addExamples);
  elements.removeExamples.addEventListener("click", handleRemoveExamples);
  elements.cancelEdit.addEventListener("click", stopEditing);
  elements.showSmall.addEventListener("change", render);
  elements.hideDone.addEventListener("change", render);
  elements.courseFilter.addEventListener("change", render);
  elements.todoList.addEventListener("click", handleListClick);
  elements.doneList.addEventListener("click", handleListClick);
  elements.dueSoonList.addEventListener("click", handleListClick);
  elements.toastUndo.addEventListener("click", handleUndo);
  elements.calendarBody.addEventListener("click", handleCalendarClick);
  elements.detailsClose.addEventListener("click", () => toggleDetails(null));
  elements.detailsEdit.addEventListener("click", () => {
    const assignment = findAssignment(state.detailsId);
    toggleDetails(null);
    if (assignment) {
      startEditing(assignment);
    }
  });
  elements.detailsDone.addEventListener("click", () => {
    const assignment = findAssignment(state.detailsId);
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
  for (const button of elements.themeButtons) {
    button.addEventListener("click", () => setTheme(button.dataset.themeChoice));
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

  state.view = loadChoice(VIEW_STORAGE_KEY, VIEWS, "list");
  applyTheme(loadChoice(THEME_STORAGE_KEY, THEMES, "system"));
  renderWeekdayHeadings();
  renderTypeLegend();
  renderTypeOptions();

  // Refresh the "due in …" text every minute so it stays accurate if the tab stays open.
  setInterval(render, 60 * 1000);
  render();
}

start();
