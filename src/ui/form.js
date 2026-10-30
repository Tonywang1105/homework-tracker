// The Add / Edit assignment form, including Repeat and folding it on phones.

import { AUTO_TYPE, guessType, keepStepTicks, TYPE_LABELS, TYPES, validateAssignmentInput, withExtension } from "../assignments.js?v=03cdcd76";
import { render } from "../main.js?v=03cdcd76";
import { createSeries, validateRepeat } from "../repeat.js?v=03cdcd76";
import { countAssignments, elements, formatDay, makeOption } from "./dom.js?v=03cdcd76";
import { findAssignment, state, updateAssignments } from "./store.js?v=03cdcd76";
import { showToast } from "./toast.js?v=03cdcd76";

const FIELD_NAMES = ["title", "dueDate", "dueTime", "priority", "type", "hours", "repeat", "untilDate", "steps", "notes"];

export function renderTypeOptions() {
  elements.form.elements.type.append(...TYPES.map((type) => makeOption(type, TYPE_LABELS[type])));
}

/** Starts a new assignment due on the clicked calendar day. */
/**
 * Copy: the form, in Add mode, filled in from an assignment (steps unticked, since only their text is copied),
 * with the due date left empty and focused, because that is what is always different for a copy.
 */
export function startCopying(assignment) {
  if (state.editingId) {
    stopEditing();
  }
  setFormOpen(true);
  fillFormFrom(assignment);
  elements.form.elements.dueDate.value = "";
  elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
  elements.form.elements.dueDate.focus({ preventScroll: true });
  showToast(`Copying "${assignment.title}". Pick a due date, then Add.`);
}

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
  const names = ["title", "course", "dueDate", "dueTime", "priority", "type", "hours", "repeat", "untilDate", "steps", "notes"];
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
    const before = findAssignment(state.editingId);
    // Steps that are still there keep their ticks; the form only shows their text.
    const steps = keepStepTicks(before.steps, result.fields.steps);
    const after = withExtension(before, { ...before, ...result.fields, steps }, state.extending);
    updateAssignments(state.assignments.map((a) => (a.id === before.id ? after : a)));
    setFormOpen(false);
    stopEditing();
    showToast(savedMessage(before, after));
  } else {
    const previous = state.assignments;
    const added = createSeries(result.fields, repeat.dates);
    // Clearing the form restores each field's default, so the next assignment starts with the time just used.
    elements.form.elements.dueTime.defaultValue = result.fields.dueTime;
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

/** "Extended "MP3" to Sat, 10/31.", "Removed the extension on "MP3".", or "Saved changes to "MP3"." */
function savedMessage(before, after) {
  if (after.originalDueDate && after.dueDate !== before.dueDate) {
    return `Extended "${after.title}" to ${formatDay(after.dueDate)}.`;
  }
  if (before.originalDueDate && !after.originalDueDate) {
    return `Removed the extension on "${after.title}".`;
  }
  return `Saved changes to "${after.title}".`;
}

/** For an exam (chosen, or guessed from a title like "Midterm 2"), the steps are the topics to study. */
export function updateStepsLabel() {
  const fields = elements.form.elements;
  const type = fields.type.value === AUTO_TYPE ? guessType(fields.title.value) : fields.type.value;
  const exam = type === "exam";
  document.getElementById("steps-label-text").textContent = exam ? "Topics to study" : "Steps";
  fields.steps.placeholder = exam ? "e.g. Eigenvalues (then the next topic on the next line)" : "e.g. Checkpoint 1 (then Checkpoint 2 on the next line)";
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
  updateStepsLabel();
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

/** Puts an assignment's details into the form, for Edit and for Copy. */
function fillFormFrom(assignment) {
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
  fields.steps.value = (assignment.steps ?? []).map((step) => step.text).join("\n");
  updateStepsLabel();
  showErrors({});
}

export function startEditing(assignment) {
  state.editingId = assignment.id;
  setFormOpen(true);
  const fields = elements.form.elements;
  fillFormFrom(assignment);
  elements.repeatFields.hidden = true;
  elements.formHeading.textContent = "Edit assignment";
  elements.submitButton.textContent = "Save changes";
  elements.cancelEdit.hidden = false;
  render();
  elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
  fields.title.focus({ preventScroll: true });
}

/** Extend…: Edit with the due date selected, where saving a new date keeps the original (see withExtension). */
export function startExtending(assignment) {
  startEditing(assignment);
  state.extending = true;
  elements.formHeading.textContent = `Extend "${assignment.title}"`;
  elements.submitButton.textContent = "Save new date";
  elements.form.elements.dueDate.focus({ preventScroll: true });
  showToast(`Pick the new due date for "${assignment.title}", then Save new date.`);
}

export function stopEditing() {
  state.editingId = null;
  state.extending = false;
  elements.repeatFields.hidden = false;
  elements.formHeading.textContent = "Add an assignment";
  elements.submitButton.textContent = "Add assignment";
  elements.cancelEdit.hidden = true;
  resetForm();
  render();
}
