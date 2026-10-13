// Connects the page to the assignment logic and storage: reads the form, renders the lists, handles clicks.

import { createAssignment, describeDue, groupAssignments, toDueDate, validateAssignmentInput } from "./assignments.js";
import { loadAssignments, saveAssignments } from "./storage.js";

const FIELD_NAMES = ["title", "dueDate", "dueTime", "priority", "notes"];
const TOAST_DURATION_MS = 6000;

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
};

const state = {
  assignments: [],
  editingId: null,
  // While saved data is unreadable we never write, so a mistake can't overwrite what is there.
  storageReadable: true,
  toastTimer: null,
  undoAction: null,
};

const dueFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

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
  const { todo, done } = groupAssignments(state.assignments, { bigOnly: !elements.showSmall.checked });
  const now = new Date();

  elements.todoList.replaceChildren(...todo.map((assignment) => renderAssignment(assignment, now)));
  elements.todoCount.textContent = todo.length > 0 ? `(${todo.length})` : "";
  elements.emptyMessage.hidden = todo.length > 0;
  elements.emptyMessage.textContent = emptyMessageText(done.length);

  elements.doneList.replaceChildren(...done.map((assignment) => renderAssignment(assignment, now)));
  elements.doneCount.textContent = `(${done.length})`;
  elements.doneSection.hidden = done.length === 0;

  renderCourseSuggestions();
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
  titleLine.append(title);
  if (assignment.course) {
    titleLine.append(makeTag(assignment.course, "course-tag"));
  }
  titleLine.append(makeTag(assignment.priority === "big" ? "Big" : "Small", `priority-tag priority-tag-${assignment.priority}`));

  const dueLine = document.createElement("div");
  dueLine.className = "due-line";
  const dueAt = document.createElement("time");
  dueAt.dateTime = `${assignment.dueDate}T${assignment.dueTime}`;
  dueAt.textContent = dueFormatter.format(toDueDate(assignment.dueDate, assignment.dueTime));
  dueLine.append(dueAt);
  if (!assignment.done) {
    const { text, urgency } = describeDue(assignment, now);
    const relative = document.createElement("span");
    relative.className = `relative-due urgency-${urgency}`;
    relative.textContent = text;
    dueLine.append(relative);
  }

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
      updateAssignments(state.assignments.map((a) => (a.id === assignment.id ? { ...a, done: !a.done } : a)));
      if (!assignment.done) {
        showToast(`Done: "${assignment.title}".`, () =>
          updateAssignments(state.assignments.map((a) => (a.id === assignment.id ? { ...a, done: false } : a))),
        );
      }
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
  elements.resetStorage.addEventListener("click", () => {
    state.storageReadable = true;
    elements.storageError.hidden = true;
    updateAssignments([]);
    showToast("Started over with an empty list.");
  });

  // Refresh the "due in …" text every minute so it stays accurate if the tab stays open.
  setInterval(render, 60 * 1000);
  render();
}

start();
