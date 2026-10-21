// Connects the page to the app: draws everything (render) and wires up the controls at start-up.

import { courseNames, dueSoon, filterAssignments, groupAssignments } from "./assignments.js?v=32c9527b";
import { currentMonth, shiftMonth } from "./calendar.js?v=32c9527b";
import { hasExamples } from "./examples.js?v=32c9527b";
import { parseSavedWidth } from "./layout.js?v=32c9527b";
import { DEFAULT_DAILY_HOURS, parseDailyHours, planStarts } from "./plan.js?v=32c9527b";
import { combineSeries } from "./repeat.js?v=32c9527b";
import { loadAssignments } from "./storage.js?v=32c9527b";
import {
  handleCalendarClick,
  handleDueSoonClick,
  handleOutsideClick,
  renderCalendar,
  renderDetails,
  renderDueSoon,
  renderTypeLegend,
  renderWeekdayHeadings,
  showMonth,
  toggleDetails,
} from "./ui/calendarView.js?v=32c9527b";
import { elements } from "./ui/dom.js?v=32c9527b";
import {
  closeForm,
  focusForm,
  handleSubmit,
  renderTypeOptions,
  setFormOpen,
  startEditing,
  updateRepeatFields,
} from "./ui/form.js?v=32c9527b";
import {
  emptyMessageText,
  handleListClick,
  renderAssignment,
  renderCourseFilter,
  renderCourseSuggestions,
  renderTodoRow,
  toggleDone,
} from "./ui/list.js?v=32c9527b";
import {
  addExamples,
  canvasPanel,
  handleBackupDownload,
  handleBackupFile,
  handleCalendarExport,
  handleCanvasFile,
  handleRemoveExamples,
  panels,
  renderCanvasReminder,
  setPanelOpen,
  snoozeCanvasReminder,
} from "./ui/panels.js?v=32c9527b";
import {
  applyTheme,
  DAILY_HOURS_KEY,
  FORM_WIDTH_KEY,
  handleDailyHoursChange,
  handleResizerKey,
  renderWorkload,
  resetFormWidth,
  setTheme,
  setView,
  startResizing,
  THEME_STORAGE_KEY,
  THEMES,
  VIEW_STORAGE_KEY,
  VIEWS,
} from "./ui/settings.js?v=32c9527b";
import { findAssignment, loadChoice, loadText, state, updateAssignments } from "./ui/store.js?v=32c9527b";
import { handleUndo, showToast } from "./ui/toast.js?v=32c9527b";

export function render() {
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
  // Planned before anything is drawn, so the list and the details box show the same start dates.
  state.startPlan = planStarts(state.assignments, now, state.dailyHours);

  elements.todoList.replaceChildren(...combineSeries(todo, state.expandedSeries).flatMap((row) => renderTodoRow(row, now, soonIds)));
  elements.todoCount.textContent = todo.length > 0 ? `(${todo.length})` : "";
  // With no assignments at all, the getting-started box (with the examples button) takes the place of the empty messages.
  const noAssignments = state.assignments.length === 0;
  elements.gettingStarted.hidden = !noAssignments;
  // Nothing to filter yet, so the filter row would only be clutter next to the getting-started box.
  elements.filters.hidden = noAssignments;
  elements.exampleBar.hidden = !hasExamples(state.assignments);
  elements.emptyMessage.hidden = todo.length > 0 || noAssignments;
  renderDueSoon(soon, now);
  renderWorkload(now);
  renderCanvasReminder(now);
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
  elements.form.elements.repeat.addEventListener("change", updateRepeatFields);
  for (const panel of panels) {
    panel.toggle.addEventListener("click", () => setPanelOpen(panel, panel.panel.hidden));
    panel.close.addEventListener("click", () => setPanelOpen(panel, false));
  }
  elements.canvasImportButton.addEventListener("click", () => elements.canvasFile.click());
  elements.canvasFile.addEventListener("change", handleCanvasFile);
  elements.backupDownloadButton.addEventListener("click", handleBackupDownload);
  elements.exportDownloadButton.addEventListener("click", handleCalendarExport);
  elements.backupRestoreButton.addEventListener("click", () => elements.backupFile.click());
  elements.backupFile.addEventListener("change", handleBackupFile);
  elements.tryExamples.addEventListener("click", addExamples);
  elements.canvasReminderImport.addEventListener("click", () => setPanelOpen(canvasPanel, true));
  elements.canvasReminderSnooze.addEventListener("click", snoozeCanvasReminder);
  elements.removeExamples.addEventListener("click", handleRemoveExamples);
  elements.cancelEdit.addEventListener("click", closeForm);
  elements.addToggle.addEventListener("click", () => {
    setFormOpen(true);
    focusForm();
  });
  elements.showSmall.addEventListener("change", render);
  elements.hideDone.addEventListener("change", render);
  elements.courseFilter.addEventListener("change", render);
  elements.todoList.addEventListener("click", handleListClick);
  elements.doneList.addEventListener("click", handleListClick);
  elements.dueSoonList.addEventListener("click", handleDueSoonClick);
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

  elements.columnResizer.addEventListener("pointerdown", startResizing);
  elements.columnResizer.addEventListener("dblclick", resetFormWidth);
  elements.columnResizer.addEventListener("keydown", handleResizerKey);
  const savedWidth = parseSavedWidth(loadText(FORM_WIDTH_KEY));
  if (savedWidth !== null) {
    // CSS keeps it within the limits even if the window is now smaller than when it was saved.
    elements.layout.style.setProperty("--form-width", `${savedWidth}px`);
    elements.columnResizer.setAttribute("aria-valuenow", String(savedWidth));
  }

  state.dailyHours = parseDailyHours(loadText(DAILY_HOURS_KEY)) ?? DEFAULT_DAILY_HOURS;
  elements.dailyHours.value = state.dailyHours;
  elements.dailyHours.addEventListener("change", handleDailyHoursChange);

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
