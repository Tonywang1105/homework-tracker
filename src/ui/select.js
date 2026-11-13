// Select: picking several assignments in the list and marking them done, changing their size or deleting them at
// once (for example after a Canvas import, which brings everything in as big). Every action has Undo, and then
// select mode ends.

import { changeAssignments, markManyDone, PRIORITY_LABELS, removeAssignmentsById } from "../assignments.js?v=2a915822";
import { t } from "../i18n.js?v=2a915822";
import { render } from "../main.js?v=2a915822";
import { countAssignments, elements } from "./dom.js?v=2a915822";
import { stopEditing } from "./form.js?v=2a915822";
import { state, updateAssignments } from "./store.js?v=2a915822";
import { showToast } from "./toast.js?v=2a915822";

const select = {
  toggle: document.getElementById("select-toggle"),
  bar: document.getElementById("select-bar"),
  count: document.getElementById("select-count"),
  size: document.getElementById("select-size"),
  panel: document.querySelector(".list-panel"),
};

export function startSelect() {
  select.toggle.addEventListener("click", () => (state.selecting ? endSelect() : beginSelect()));
  select.bar.addEventListener("click", handleBarClick);
  select.size.addEventListener("change", handleSizeChange);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.selecting) {
      endSelect();
    }
  });
}

function beginSelect() {
  state.selecting = true;
  state.selectedIds.clear();
  render();
  // Put focus on the first row's select box, so keyboard users can start picking straight away.
  elements.todoList.querySelector("[data-action=toggle-select]")?.focus();
}

function endSelect() {
  state.selecting = false;
  state.selectedIds.clear();
  render();
  select.toggle.focus();
}

/** Ticking or unticking one row's select box (from the list's click handler). */
export function toggleSelected(id) {
  if (!state.selectedIds.delete(id)) {
    state.selectedIds.add(id);
  }
  render();
}

/** Shows the action bar while selecting, and keeps the selection to assignments that still exist. */
export function renderSelect() {
  if (state.selecting && state.view !== "list") {
    state.selecting = false;
  }
  const existing = new Set(state.assignments.map((a) => a.id));
  for (const id of state.selectedIds) {
    if (!existing.has(id)) {
      state.selectedIds.delete(id);
    }
  }
  const count = state.selectedIds.size;
  select.bar.hidden = !state.selecting;
  select.panel.classList.toggle("is-selecting", state.selecting);
  document.body.classList.toggle("is-selecting", state.selecting);
  select.toggle.textContent = t(state.selecting ? "filter.done_selecting" : "filter.select");
  select.toggle.setAttribute("aria-pressed", String(state.selecting));
  select.count.textContent = count === 0 ? t("select.none") : t("select.count", { n: count });
  for (const button of select.bar.querySelectorAll("[data-bulk=done], [data-bulk=delete]")) {
    button.disabled = count === 0;
  }
  select.size.disabled = count === 0;
}

function handleBarClick(event) {
  const action = event.target.closest("[data-bulk]")?.dataset.bulk;
  if (action === "all") {
    // Every row the list is showing right now, so the filters and search decide what "all" means.
    for (const row of document.querySelectorAll("#todo-list li[data-id], #done-list li[data-id]")) {
      if (row.offsetParent !== null) {
        state.selectedIds.add(row.dataset.id);
      }
    }
    render();
  } else if (action === "cancel") {
    endSelect();
  } else if (action === "done") {
    const { assignments, changed } = markManyDone(state.assignments, state.selectedIds);
    applyBulk(assignments, changed === 0 ? t("msg.already_done") : t("msg.marked_done", { count: countAssignments(changed) }));
  } else if (action === "delete") {
    if (state.selectedIds.has(state.editingId)) {
      stopEditing();
    }
    applyBulk(removeAssignmentsById(state.assignments, state.selectedIds), t("msg.deleted_many", { count: countAssignments(state.selectedIds.size) }));
  }
}

function handleSizeChange() {
  const priority = select.size.value;
  select.size.value = "";
  if (!PRIORITY_LABELS[priority]) {
    return;
  }
  const message = t("msg.changed_size", { count: countAssignments(state.selectedIds.size), size: PRIORITY_LABELS[priority] });
  applyBulk(changeAssignments(state.assignments, state.selectedIds, { priority }), message);
}

/** Saves the change, ends select mode, and offers Undo, which puts the whole list back as it was. */
function applyBulk(assignments, message) {
  const previous = state.assignments;
  state.selecting = false;
  state.selectedIds.clear();
  updateAssignments(assignments);
  showToast(message, () => updateAssignments(previous));
  select.toggle.focus();
}
