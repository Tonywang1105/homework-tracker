// Pasted imports in Import…: a box where a copied PrairieLearn Assessments page or Gradescope dashboard is pasted,
// a preview of what it would add or update, and Add (with Undo). Each source supplies its reader and the key that
// recognizes its assignments on a later paste; nothing leaves this device.

import { createAssignment, validateAssignmentInput } from "../assignments.js?v=49cec885";
import { planGradescope, readGradescope } from "../gradescope.js?v=49cec885";
import { t } from "../i18n.js?v=49cec885";
import { planPrairieLearn, readPrairieLearn } from "../prairielearn.js?v=49cec885";
import { countAssignments, formatDay } from "./dom.js?v=49cec885";
import { state, updateAssignments } from "./store.js?v=49cec885";
import { showToast } from "./toast.js?v=49cec885";

// Each source: its element id prefix, how to read and plan a paste, the field its key is saved in, its Where, and
// the phrases that differ.
const SOURCES = [
  { prefix: "pl", read: readPrairieLearn, plan: planPrairieLearn, keyField: "prairieLearnKey", platform: "prairielearn", noneFound: "pl.none_found", done: "msg.pl_done" },
  { prefix: "gs", read: readGradescope, plan: planGradescope, keyField: "gradescopeKey", platform: "gradescope", noneFound: "gs.none_found", done: "msg.gs_done" },
];

const panels = SOURCES.map((source) => ({
  ...source,
  text: document.getElementById(`${source.prefix}-text`),
  course: document.getElementById(`${source.prefix}-course`),
  preview: document.getElementById(`${source.prefix}-preview`),
  list: document.getElementById(`${source.prefix}-list`),
  add: document.getElementById(`${source.prefix}-add`),
  // Whether the course box was typed in, so a new paste doesn't overwrite it with the course it finds.
  courseTyped: false,
}));

export function startPastePanels() {
  for (const panel of panels) {
    panel.text.addEventListener("input", () => renderPanel(panel));
    panel.course.addEventListener("input", () => {
      panel.courseTyped = panel.course.value.trim() !== "";
      renderPanel(panel);
    });
    panel.add.addEventListener("click", () => handleAdd(panel));
  }
  renderPastePreviews();
}

/** Every paste box's preview, from scratch, so it's always current (also after a language change). */
export function renderPastePreviews() {
  for (const panel of panels) {
    renderPanel(panel);
  }
}

function currentPlan(panel) {
  const read = panel.read(panel.text.value);
  if (!panel.courseTyped && read.course) {
    panel.course.value = read.course;
  }
  const course = panel.course.value.trim();
  return { read, course, ...panel.plan(state.assignments, state.deleted, read.items, course) };
}

function renderPanel(panel) {
  const empty = panel.text.value.trim() === "";
  const { read, course, added, updated, unchanged } = currentPlan(panel);
  const count = added.length + updated.length;
  panel.add.disabled = count === 0;
  panel.add.textContent = count === 0 ? t("pl.add") : t("pl.add_count", { n: count });
  panel.list.replaceChildren(
    ...[...added.map((item) => [item.title, item]), ...updated.map((item) => [t("pl.updated_mark", { title: item.title }), item])].map(([title, item]) => {
      const line = document.createElement("li");
      line.textContent = `${title} · ${formatDay(item.dueDate)}`;
      return line;
    }),
  );
  if (empty) {
    panel.preview.textContent = "";
    return;
  }
  if (read.items.length === 0) {
    panel.preview.textContent = t(panel.noneFound);
    return;
  }
  const parts = [];
  if (count === 0) {
    parts.push(t("pl.nothing_new"));
  } else {
    if (added.length > 0) {
      parts.push(t("pl.will_add", { added: countAssignments(added.length) }));
    }
    if (updated.length > 0) {
      parts.push(t("pl.will_update", { n: updated.length }));
    }
    if (unchanged > 0) {
      parts.push(t("pl.already", { n: unchanged }));
    }
  }
  if (read.skippedPast + read.skippedDone > 0) {
    parts.push(t("pl.skipped", { past: read.skippedPast, done: read.skippedDone }));
  }
  if (!course) {
    parts.push(t("pl.need_course"));
  }
  panel.preview.textContent = parts.join("");
}

function handleAdd(panel) {
  const { course, added, updated } = currentPlan(panel);
  const newOnes = added.flatMap(({ title, dueDate, dueTime, key }) => {
    // Through the form's checks, as big work marked with where it's done, like a Canvas import.
    const result = validateAssignmentInput({ title, course, dueDate, dueTime, priority: "big", notes: "", platform: panel.platform });
    return result.ok ? [{ ...createAssignment(result.fields), [panel.keyField]: key }] : [];
  });
  const changed = new Map(updated.map((a) => [a.id, a]));
  const previous = state.assignments;
  updateAssignments([...previous.map((a) => changed.get(a.id) ?? a), ...newOnes]);
  showToast(t(panel.done, { added: newOnes.length, updated: updated.length }), () => updateAssignments(previous));
  // Pasting the same page again now shows there's nothing new.
  renderPanel(panel);
}
