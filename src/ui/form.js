// The Add / Edit assignment form, including Repeat and folding it on phones.

import {
  assignmentPlatform,
  AUTO_TYPE,
  dayLoad,
  formatHours,
  formatHoursPlain,
  guessType,
  keepStepTicks,
  PLATFORM_LABELS,
  PLATFORMS,
  TYPE_LABELS,
  TYPES,
  validateAssignmentInput,
  withExtension,
} from "../assignments.js?v=d5a1412c";
import { suggestHours } from "../estimates.js?v=d5a1412c";
import { formatList, t } from "../i18n.js?v=d5a1412c";
import { latestLesson } from "../lessons.js?v=d5a1412c";
import { weekdayOf } from "../plan.js?v=d5a1412c";
import { render } from "../main.js?v=d5a1412c";
import { createSeries, validateRepeat } from "../repeat.js?v=d5a1412c";
import { formatSpent } from "../timer.js?v=d5a1412c";
import { countAssignments, elements, formatDay, makeOption } from "./dom.js?v=d5a1412c";
import { findAssignment, state, updateAssignments } from "./store.js?v=d5a1412c";
import { showToast } from "./toast.js?v=d5a1412c";
import { hasOwnHours, hoursLimit, weekdayName } from "./weekdayHours.js?v=d5a1412c";

const lessonHint = document.getElementById("lesson-hint");
const dayLoadLine = document.getElementById("day-load");
// The busy-day line names this many assignments, then says how many more.
const MAX_NAMED = 3;
const hoursSuggestion = {
  box: document.getElementById("hours-suggestion"),
  text: document.getElementById("hours-suggestion-text"),
  use: document.getElementById("hours-suggestion-use"),
};

const FIELD_NAMES = ["title", "dueDate", "dueTime", "priority", "type", "platform", "hours", "weight", "repeat", "untilDate", "steps", "notes"];

export function startHoursSuggestion() {
  for (const name of ["title", "course", "type", "hours"]) {
    elements.form.elements[name].addEventListener("input", updateHoursSuggestion);
  }
  hoursSuggestion.use.addEventListener("click", useHoursSuggestion);
  elements.form.elements.dueDate.addEventListener("input", updateDayLoad);
}

export function renderTypeOptions() {
  // Marked for translation, so a language change renames them too (see src/ui/language.js).
  elements.form.elements.type.append(
    ...TYPES.map((type) => {
      const option = makeOption(type, TYPE_LABELS[type]);
      option.dataset.i18n = `type.${type}`;
      return option;
    }),
  );
  // The Where choices, in the form and in the filter row.
  elements.form.elements.platform.append(...PLATFORMS.map((place) => makeOption(place, PLATFORM_LABELS[place])));
  elements.platformFilter.append(...PLATFORMS.map((place) => makeOption(place, PLATFORM_LABELS[place])));
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
  // A copy is already filled in, so the hint about what's needed would only be in the way.
  elements.formHint.hidden = true;
  elements.form.elements.dueDate.value = "";
  updateDayLoad();
  elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
  elements.form.elements.dueDate.focus({ preventScroll: true });
  showToast(t("msg.copying", { title: assignment.title }));
}

export function startAddingOn(dateKey) {
  if (state.editingId) {
    stopEditing();
  }
  setFormOpen(true);
  elements.form.elements.dueDate.value = dateKey;
  updateDayLoad();
  showErrors({});
  elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
  elements.form.elements.title.focus({ preventScroll: true });
  showToast(t("msg.new_on_day", { day: formatDay(dateKey) }));
}

function readForm() {
  const data = new FormData(elements.form);
  const names = ["title", "course", "dueDate", "dueTime", "priority", "type", "platform", "hours", "weight", "repeat", "untilDate", "steps", "notes"];
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
      showToast(t("msg.added", { title: added[0].title }));
    } else {
      const [first, last] = [added[0], added.at(-1)];
      const summary =
        first.title === last.title
          ? t("msg.added_times", { title: first.title, n: added.length, first: formatDay(first.dueDate), last: formatDay(last.dueDate) })
          : t("msg.added_series", { count: countAssignments(added.length), first: first.title, last: last.title });
      // Undo takes back the whole series, in case the dates or the end date were wrong.
      showToast(summary, () => updateAssignments(previous));
    }
  }
}

/** "Extended "MP3" to Sat, 10/31.", "Removed the extension on "MP3".", or "Saved changes to "MP3"." */
function savedMessage(before, after) {
  if (after.originalDueDate && after.dueDate !== before.dueDate) {
    return t("msg.extended", { title: after.title, day: formatDay(after.dueDate) });
  }
  if (before.originalDueDate && !after.originalDueDate) {
    return t("msg.extension_removed", { title: after.title });
  }
  return t("msg.saved", { title: after.title });
}

/** For an exam (chosen, or guessed from a title like "Midterm 2"), the steps are the topics to study. */
export function updateStepsLabel() {
  const fields = elements.form.elements;
  const type = fields.type.value === AUTO_TYPE ? guessType(fields.title.value) : fields.type.value;
  const exam = type === "exam";
  document.getElementById("steps-label-text").textContent = t(exam ? "form.topics" : "form.steps");
  fields.steps.placeholder = t(exam ? "form.topics_ph" : "form.steps_ph");
}

/**
 * Under Time needed: what similar finished work took (src/estimates.js), with a button to use it. Shown only while
 * the box is empty, so it never replaces a number that was typed. Also refreshes the form's other hints (the lesson
 * and the busy-day line), since they change at the same moments: filling, clearing and redrawing.
 */
export function updateHoursSuggestion() {
  const fields = elements.form.elements;
  const type = fields.type.value === AUTO_TYPE ? guessType(fields.title.value) : fields.type.value;
  updateLessonHint(type);
  updateDayLoad();
  const suggestion = fields.hours.value.trim() === "" ? suggestHours(state.assignments, { course: fields.course.value, type }) : null;
  hoursSuggestion.box.hidden = suggestion === null;
  if (!suggestion) {
    return;
  }
  const where = suggestion.anyCourse ? "estimate.any" : "estimate.course";
  const values = {
    n: suggestion.count,
    type: TYPE_LABELS[type],
    course: fields.course.value.trim(),
    spent: formatSpent(suggestion.seconds),
    low: formatSpent(suggestion.lowSeconds),
    high: formatSpent(suggestion.highSeconds),
  };
  hoursSuggestion.text.textContent = t(`${where}.${suggestion.count === 1 ? "one" : "other"}`, values);
  hoursSuggestion.use.textContent = t("estimate.use", { hours: formatHours(suggestion.hours) });
  hoursSuggestion.use.dataset.hours = String(suggestion.hours);
}

/** "Last time (MP8): start the tests first", from the last finished assignment of this type and course. */
function updateLessonHint(type) {
  const fields = elements.form.elements;
  const last = latestLesson(state.assignments, { course: fields.course.value, type }, state.editingId);
  lessonHint.hidden = last === null;
  if (last) {
    lessonHint.textContent = t("lesson.last", last);
  }
}

/**
 * Under the due date: the other unfinished work already due that day (see dayLoad), so a crowded day shows before
 * it's chosen. Amber once that work fills that day's hours in Settings (or the day is a day off). It only informs;
 * saving still works.
 */
function updateDayLoad() {
  const dueDate = elements.form.elements.dueDate.value;
  const load = dueDate ? dayLoad(state.assignments, dueDate, state.editingId) : null;
  dayLoadLine.hidden = load === null;
  if (!load) {
    return;
  }
  const named = load.titles.slice(0, MAX_NAMED);
  if (load.count > MAX_NAMED) {
    named.push(t("form.day_more", { n: load.count - MAX_NAMED }));
  }
  const values = { day: formatDay(dueDate), titles: formatList(named) };
  // That day's hours: its weekday's own (Settings → Different hours on some days), or the usual hours a day.
  const weekday = weekdayOf(dueDate);
  const dayHours = hoursLimit()(dueDate);
  const dayOff = dayHours === 0;
  const full = dayOff || (load.hours > 0 && load.hours >= dayHours);
  const sentence =
    load.hours > 0
      ? t("form.day_load", { ...values, hours: formatHours(load.hours) })
      : t("form.day_load_count", { ...values, count: countAssignments(load.count) });
  dayLoadLine.textContent = sentence + (full ? fullNote(weekday, dayHours) : "");
  dayLoadLine.classList.toggle("is-full", full);
}

/** Why the day is full: a day off, the weekday's own hours, or the usual hours a day. */
function fullNote(weekday, dayHours) {
  if (dayHours === 0) {
    return t("form.day_off", { weekday: weekdayName(weekday) });
  }
  if (hasOwnHours(weekday)) {
    return t("form.day_full_on", { hours: formatHoursPlain(dayHours), weekday: weekdayName(weekday) });
  }
  return t("form.day_full", { hours: formatHoursPlain(dayHours) });
}

function useHoursSuggestion() {
  elements.form.elements.hours.value = hoursSuggestion.use.dataset.hours;
  updateHoursSuggestion();
  elements.form.elements.hours.focus();
}

/** The heading and the main button for what the form is doing: adding, editing, or extending (Extend…). */
export function renderFormMode() {
  const editing = state.editingId !== null;
  const title = editing ? (findAssignment(state.editingId)?.title ?? "") : "";
  if (state.extending) {
    elements.formHeading.textContent = t("form.heading_extend", { title });
    elements.submitButton.textContent = t("form.submit_extend");
  } else {
    elements.formHeading.textContent = t(editing ? "form.heading_edit" : "form.heading_add");
    elements.submitButton.textContent = t(editing ? "form.submit_save" : "form.submit_add");
  }
  updateStepsLabel();
  updateHoursSuggestion();
}

/** The Until date only matters (and is only required) when the assignment repeats. */
export function updateRepeatFields() {
  const repeating = elements.form.elements.repeat.value !== "";
  elements.untilField.hidden = !repeating;
  elements.form.elements.untilDate.required = repeating;
}

function resetForm() {
  elements.form.reset();
  updateHoursSuggestion();
  // Back to adding (after adding, a copy, or an edit), so say again what's needed.
  elements.formHint.hidden = state.editingId !== null;
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
  fields.platform.value = assignmentPlatform(assignment);
  fields.hours.value = assignment.hours ?? "";
  fields.weight.value = assignment.weight ?? "";
  fields.steps.value = (assignment.steps ?? []).map((step) => step.text).join("\n");
  updateStepsLabel();
  updateHoursSuggestion();
  showErrors({});
}

export function startEditing(assignment) {
  state.editingId = assignment.id;
  setFormOpen(true);
  const fields = elements.form.elements;
  fillFormFrom(assignment);
  elements.repeatFields.hidden = true;
  elements.formHint.hidden = true;
  renderFormMode();
  elements.cancelEdit.hidden = false;
  render();
  elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
  fields.title.focus({ preventScroll: true });
}

/** Extend…: Edit with the due date selected, where saving a new date keeps the original (see withExtension). */
export function startExtending(assignment) {
  startEditing(assignment);
  state.extending = true;
  renderFormMode();
  elements.form.elements.dueDate.focus({ preventScroll: true });
  showToast(t("msg.pick_extend_date", { title: assignment.title }));
}

export function stopEditing() {
  state.editingId = null;
  state.extending = false;
  elements.repeatFields.hidden = false;
  renderFormMode();
  elements.cancelEdit.hidden = true;
  resetForm();
  render();
}
