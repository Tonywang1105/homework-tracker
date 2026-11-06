// The Quick add box above the list: one typed line becomes an assignment, with a preview of what was understood.

import {
  courseNames,
  createAssignment,
  DEFAULT_DUE_TIME,
  formatHours,
  PRIORITY_LABELS,
  toDueDate,
  validateAssignmentInput,
} from "../assignments.js?v=339917fb";
import { t } from "../i18n.js?v=339917fb";
import { parseQuickAdd } from "../quickadd.js?v=339917fb";
import { elements, formatDay, timeFormatter } from "./dom.js?v=339917fb";
import { state, updateAssignments } from "./store.js?v=339917fb";
import { showToast } from "./toast.js?v=339917fb";


/** What the line would add, as a short line under the box, updated as you type. */
export function handleQuickAddInput() {
  const text = elements.quickAddText.value;
  if (text.trim() === "") {
    showPreview(t("quick.help"));
    return;
  }
  const parsed = readLine(text);
  if (!parsed.title) {
    showPreview(t("msg.quick_need_title"), true);
  } else if (!parsed.dueDate) {
    showPreview(t("msg.quick_need_day", { title: parsed.title }), true);
  } else {
    showPreview(describe(parsed));
  }
}

export function handleQuickAddSubmit(event) {
  event.preventDefault();
  const parsed = readLine(elements.quickAddText.value);
  if (!parsed.title || !parsed.dueDate) {
    handleQuickAddInput();
    elements.quickAddText.focus();
    return;
  }
  // The same checks as the full form, so a quick-added assignment follows the same rules.
  const result = validateAssignmentInput({ ...parsed, priority: parsed.priority ?? "big", hours: parsed.hours ?? "" });
  if (!result.ok) {
    showPreview(Object.values(result.errors)[0], true);
    return;
  }
  const added = createAssignment(result.fields);
  updateAssignments([...state.assignments, added]);
  showToast(t("msg.quick_added", { title: added.title, day: formatDay(added.dueDate) }));
  // Ready for the next one, since several are often added together.
  elements.quickAddText.value = "";
  showPreview(t("quick.help"));
}

function readLine(text) {
  return parseQuickAdd(text, { courses: courseNames(state.assignments) });
}

/** "MP4 · CS 124 · Fri, 10/30, 11:59 PM · Big · ~2 h" */
function describe({ title, course, dueDate, dueTime, priority, hours }) {
  const due = `${formatDay(dueDate)}, ${timeFormatter.format(toDueDate(dueDate, dueTime ?? DEFAULT_DUE_TIME))}`;
  const parts = [title, course, due, PRIORITY_LABELS[priority ?? "big"]];
  if (hours) {
    parts.push(formatHours(hours));
  }
  return t("msg.quick_adds", { parts: parts.filter(Boolean).join(" · ") });
}

function showPreview(text, isProblem = false) {
  elements.quickAddPreview.textContent = text;
  elements.quickAddPreview.classList.toggle("is-problem", isProblem);
}
