// The Add / Edit assignment form, including Repeat and folding it on phones.

import { AUTO_TYPE, TYPE_LABELS, TYPES, updateAssignment, validateAssignmentInput } from "../assignments.js?v=b626d73a";
import { render } from "../main.js?v=b626d73a";
import { createSeries, validateRepeat } from "../repeat.js?v=b626d73a";
import { countAssignments, elements, formatDay, makeOption } from "./dom.js?v=b626d73a";
import { state, updateAssignments } from "./store.js?v=b626d73a";
import { showToast } from "./toast.js?v=b626d73a";

const FIELD_NAMES = ["title", "dueDate", "dueTime", "priority", "type", "hours", "repeat", "untilDate", "notes"];

export function renderTypeOptions() {
  elements.form.elements.type.append(...TYPES.map((type) => makeOption(type, TYPE_LABELS[type])));
}

/** Starts a new assignment due on the clicked calendar day. */
export function startAddingOn(dateKey) {
  if (state.editingId) {
    stopEditing();
  }
  setFormOpen(true);
  elements.form.elements.dueDate.value = dateKey;
  showErrors({});
  elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
  elements.form.elements.title.focus({ preventScroll: true });
  showToast(`New assignment due ${formatDay(dateKey)}. Type a name.`);
}

function readForm() {
  const data = new FormData(elements.form);
  const names = ["title", "course", "dueDate", "dueTime", "priority", "type", "hours", "repeat", "untilDate", "notes"];
  return Object.fromEntries(names.map((name) => [name, data.get(name) ?? ""]));
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

export function handleSubmit(event) {
  event.preventDefault();
  const input = readForm();
  const result = validateAssignmentInput(input);
  // Repeating only applies when adding; the Repeat fields are hidden while editing.
  const repeat = state.editingId ? { ok: true } : validateRepeat(input, result.ok ? result.fields.dueDate : input.dueDate);
  if (!result.ok || !repeat.ok) {
    showErrors({ ...(result.errors ?? {}), ...(repeat.errors ?? {}) });
    return;
  }
  showErrors({});

  if (state.editingId) {
    const editedTitle = result.fields.title;
    updateAssignments(updateAssignment(state.assignments, state.editingId, result.fields));
    setFormOpen(false);
    stopEditing();
    showToast(`Saved changes to "${editedTitle}".`);
  } else {
    const previous = state.assignments;
    const added = createSeries(result.fields, repeat.dates);
    updateAssignments([...previous, ...added]);
    // On a phone the form folds back, so the new assignment is visible in the list.
    setFormOpen(false);
    resetForm();
    if (added.length === 1) {
      showToast(`Added "${added[0].title}".`);
    } else {
      const [first, last] = [added[0], added.at(-1)];
      const summary =
        first.title === last.title
          ? `Added "${first.title}" ${added.length} times, ${formatDay(first.dueDate)} to ${formatDay(last.dueDate)}.`
          : `Added ${countAssignments(added.length)}, "${first.title}" to "${last.title}".`;
      // Undo takes back the whole series, in case the dates or the end date were wrong.
      showToast(summary, () => updateAssignments(previous));
    }
  }
}

/** The Until date only matters (and is only required) when the assignment repeats. */
export function updateRepeatFields() {
  const repeating = elements.form.elements.repeat.value !== "";
  elements.untilField.hidden = !repeating;
  elements.form.elements.untilDate.required = repeating;
}

function resetForm() {
  elements.form.reset();
  updateRepeatFields();
  showErrors({});
  focusForm();
}

/**
 * Opens or folds the form. This only changes anything on phones, where CSS shows just the
 * "+ Add assignment" button until the form is open; on wider screens the form is always shown.
 */
export function setFormOpen(open) {
  elements.formPanel.classList.toggle("is-open", open);
  elements.addToggle.setAttribute("aria-expanded", String(open));
}

/** Puts the cursor in the Assignment box, or on "+ Add assignment" when the form is folded on a phone. */
export function focusForm() {
  const formShown = elements.form.offsetParent !== null;
  (formShown ? elements.form.elements.title : elements.addToggle).focus({ preventScroll: true });
}

export function closeForm() {
  stopEditing();
  setFormOpen(false);
  focusForm();
}

export function startEditing(assignment) {
  state.editingId = assignment.id;
  setFormOpen(true);
  const fields = elements.form.elements;
  fields.title.value = assignment.title;
  fields.course.value = assignment.course;
  fields.dueDate.value = assignment.dueDate;
  fields.dueTime.value = assignment.dueTime;
  fields.priority.value = assignment.priority;
  // Assignments saved before types existed have none stored, so the form offers the guess again.
  fields.type.value = assignment.type ?? AUTO_TYPE;
  fields.notes.value = assignment.notes;
  fields.hours.value = assignment.hours ?? "";
  showErrors({});
  elements.repeatFields.hidden = true;
  elements.formHeading.textContent = "Edit assignment";
  elements.submitButton.textContent = "Save changes";
  elements.cancelEdit.hidden = false;
  render();
  elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
  fields.title.focus({ preventScroll: true });
}

export function stopEditing() {
  state.editingId = null;
  elements.repeatFields.hidden = false;
  elements.formHeading.textContent = "Add an assignment";
  elements.submitButton.textContent = "Add assignment";
  elements.cancelEdit.hidden = true;
  resetForm();
  render();
}
