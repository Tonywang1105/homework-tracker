// Paste from PrairieLearn: the panel where a copied Assessments page is pasted, a preview of what it would add or
// update, and Add (with Undo). Reading the text is in src/prairielearn.js; nothing leaves this device.

import { createAssignment, validateAssignmentInput } from "../assignments.js?v=5f926fa5";
import { t } from "../i18n.js?v=5f926fa5";
import { planPrairieLearn, readPrairieLearn } from "../prairielearn.js?v=5f926fa5";
import { countAssignments, formatDay } from "./dom.js?v=5f926fa5";
import { state, updateAssignments } from "./store.js?v=5f926fa5";
import { showToast } from "./toast.js?v=5f926fa5";

const panel = {
  text: document.getElementById("pl-text"),
  course: document.getElementById("pl-course"),
  preview: document.getElementById("pl-preview"),
  list: document.getElementById("pl-list"),
  add: document.getElementById("pl-add"),
};
// Whether the course box was typed in, so a new paste doesn't overwrite what was typed with the course it finds.
let courseTyped = false;

export function startPrairieLearnPanel() {
  panel.text.addEventListener("input", renderPrairieLearnPreview);
  panel.course.addEventListener("input", () => {
    courseTyped = panel.course.value.trim() !== "";
    renderPrairieLearnPreview();
  });
  panel.add.addEventListener("click", handleAdd);
  renderPrairieLearnPreview();
}

/** What the pasted text would do, from scratch each time, so it's always current (also after a language change). */
function currentPlan() {
  const read = readPrairieLearn(panel.text.value);
  if (!courseTyped && read.course) {
    panel.course.value = read.course;
  }
  const course = panel.course.value.trim();
  return { read, course, ...planPrairieLearn(state.assignments, state.deleted, read.items, course) };
}

export function renderPrairieLearnPreview() {
  const empty = panel.text.value.trim() === "";
  const { read, course, added, updated, unchanged } = currentPlan();
  const count = added.length + updated.length;
  panel.add.disabled = count === 0;
  panel.add.textContent = count === 0 ? t("pl.add") : t("pl.add_count", { n: count });
  panel.list.replaceChildren(
    ...[...added.map((item) => item.title), ...updated.map((item) => t("pl.updated_mark", { title: item.title }))].map((title, index) => {
      const item = document.createElement("li");
      const due = [...added, ...updated][index];
      item.textContent = `${title} · ${formatDay(due.dueDate)}`;
      return item;
    }),
  );
  if (empty) {
    panel.preview.textContent = "";
    return;
  }
  if (read.items.length === 0) {
    panel.preview.textContent = t("pl.none_found");
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

function handleAdd() {
  const { course, added, updated } = currentPlan();
  const newOnes = added.flatMap(({ title, dueDate, dueTime, key }) => {
    // Through the form's checks, as big work marked PrairieLearn, like a Canvas import.
    const result = validateAssignmentInput({ title, course, dueDate, dueTime, priority: "big", notes: "", platform: "prairielearn" });
    return result.ok ? [{ ...createAssignment(result.fields), prairieLearnKey: key }] : [];
  });
  const changed = new Map(updated.map((a) => [a.id, a]));
  const previous = state.assignments;
  updateAssignments([...previous.map((a) => changed.get(a.id) ?? a), ...newOnes]);
  showToast(t("msg.pl_done", { added: newOnes.length, updated: updated.length }), () => updateAssignments(previous));
  // Pasting the same page again now shows there's nothing new.
  renderPrairieLearnPreview();
}
