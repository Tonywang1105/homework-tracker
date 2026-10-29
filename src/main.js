// Connects the page to the app: draws everything (render) and wires up the controls at start-up.

import { courseNames, dueSoon, filterAssignments, groupAssignments, searchWords, splitRecentDone } from "./assignments.js?v=941ad035";
import { currentMonth, shiftMonth } from "./calendar.js?v=941ad035";
import { hasExamples } from "./examples.js?v=941ad035";
import { parseSavedWidth } from "./layout.js?v=941ad035";
import { DEFAULT_DAILY_HOURS, parseDailyHours, planStarts } from "./plan.js?v=941ad035";
import { combineSeries } from "./repeat.js?v=941ad035";
import { loadAssignments } from "./storage.js?v=941ad035";
import { startAccount } from "./ui/account.js?v=941ad035";
import { renderAgenda } from "./ui/agendaView.js?v=941ad035";
import {
  handleCalendarClick,
  handleDetailsStepClick,
  handleDueSoonClick,
  handleOutsideClick,
  renderCalendar,
  renderDetails,
  renderDueSoon,
  renderTypeLegend,
  renderWeekdayHeadings,
  showMonth,
  toggleDetails,
} from "./ui/calendarView.js?v=941ad035";
import { handleCourseColorChange, loadChosenColors, updateCourseColors } from "./ui/colorsPanel.js?v=941ad035";
import { renderCoursePage, startCoursePages } from "./ui/coursePage.js?v=941ad035";
import { elements } from "./ui/dom.js?v=941ad035";
import {
  closeForm,
  focusForm,
  handleSubmit,
  renderTypeOptions,
  setFormOpen,
  startCopying,
  startEditing,
  updateRepeatFields,
} from "./ui/form.js?v=941ad035";
import { offerGuide, startGuideListeners } from "./ui/guide.js?v=941ad035";
import {
  applySavedFilters,
  emptyMessageText,
  handleFilterChange,
  handleListClick,
  handleSearchInput,
  renderAssignment,
  renderCourseFilter,
  renderCourseSuggestions,
  renderShowOlder,
  renderTodoRow,
  tickTimers,
  toggleDone,
} from "./ui/list.js?v=941ad035";
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
} from "./ui/panels.js?v=941ad035";
import { handleQuickAddInput, handleQuickAddSubmit } from "./ui/quickAdd.js?v=941ad035";
import { handleTodaySummaryClick, renderReview, renderTodaySummary } from "./ui/reviewPanel.js?v=941ad035";
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
} from "./ui/settings.js?v=941ad035";
import { startShortcuts } from "./ui/shortcuts.js?v=941ad035";
import { renderTodayPlan, todayPlanList } from "./ui/todayPlan.js?v=941ad035";
import { findAssignment, loadChoice, loadText, state, updateAssignments } from "./ui/store.js?v=941ad035";
import { handleUndo, hideToast, showToast } from "./ui/toast.js?v=941ad035";

export function render() {
  const courses = courseNames(state.assignments);
  updateCourseColors(courses);
  renderCourseFilter(courses);
  renderCourseSuggestions(courses);

  const filters = {
    course: elements.courseFilter.value,
    hideSmall: !elements.showSmall.checked,
    hideDone: elements.hideDone.checked,
  };
  // The calendar draws from this; the list uses the same filters plus the search box.
  const visible = filterAssignments(state.assignments, filters);
  const search = elements.search.value;
  const { todo, done } = groupAssignments(filterAssignments(state.assignments, { ...filters, search }));
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
  renderReview(now);
  renderTodaySummary(now);
  renderTodayPlan(now);
  renderCoursePage();
  offerGuide(state.assignments.length);
  elements.emptyMessage.textContent = emptyMessageText({ ...filters, search }, done.length);

  // Finished work due over two weeks ago stays folded away, so Completed doesn't grow all semester, unless
  // asked for or while searching (finding old work is what search is for).
  const { recent, older } = splitRecentDone(done, now);
  const showAllDone = state.showOlderDone || searchWords(search).length > 0;
  elements.doneList.replaceChildren(
    // Older work goes below the recent work, where the "Show older" button was.
    ...(showAllDone ? [...recent, ...older] : recent).map((assignment) => renderAssignment(assignment, now)),
    ...(showAllDone || older.length === 0 ? [] : [renderShowOlder(older.length)]),
  );
  elements.doneCount.textContent = `(${done.length})`;
  elements.doneSection.hidden = done.length === 0;

  elements.listView.hidden = state.view !== "list";
  elements.searchField.hidden = state.view !== "list";
  elements.calendarView.hidden = state.view !== "calendar";
  elements.agendaView.hidden = state.view !== "agenda";
  for (const button of elements.viewButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.view === state.view));
  }
  // Unless "Hide completed" is ticked, the calendar and the agenda also show finished work, greyed out.
  if (state.view === "calendar") {
    renderCalendar(visible, filters.course, now);
    renderDetails(now);
  } else if (state.view === "agenda") {
    renderAgenda(visible, now);
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
    panel.toggle.addEventListener("click", () => {
      setPanelOpen(panel, panel.panel.hidden);
      // The review and course colors are only filled in while open, so draw them now, not at the next redraw.
      render();
    });
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
  elements.showSmall.addEventListener("change", handleFilterChange);
  elements.hideDone.addEventListener("change", handleFilterChange);
  elements.courseFilter.addEventListener("change", handleFilterChange);
  elements.search.addEventListener("input", handleSearchInput);
  elements.todoList.addEventListener("click", handleListClick);
  elements.doneList.addEventListener("click", handleListClick);
  todayPlanList.addEventListener("click", handleListClick);
  elements.dueSoonList.addEventListener("click", handleDueSoonClick);
  elements.toastUndo.addEventListener("click", handleUndo);
  elements.toastClose.addEventListener("click", hideToast);
  elements.calendarBody.addEventListener("click", handleCalendarClick);
  elements.agendaList.addEventListener("click", handleCalendarClick);
  elements.detailsSteps.addEventListener("click", handleDetailsStepClick);
  elements.quickAdd.addEventListener("submit", handleQuickAddSubmit);
  document.getElementById("course-color-list").addEventListener("change", handleCourseColorChange);
  document.getElementById("today-summary").addEventListener("click", handleTodaySummaryClick);
  elements.quickAddText.addEventListener("input", handleQuickAddInput);
  handleQuickAddInput();
  startGuideListeners();
  startShortcuts();
  startCoursePages();
  elements.detailsClose.addEventListener("click", () => toggleDetails(null));
  // Edit and Copy in the details box close it, then open the form for that assignment.
  for (const [button, openForm] of [
    [elements.detailsEdit, startEditing],
    [elements.detailsCopy, startCopying],
  ]) {
    button.addEventListener("click", () => {
      const assignment = findAssignment(state.detailsId);
      toggleDetails(null);
      if (assignment) {
        openForm(assignment);
      }
    });
  }
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
  applySavedFilters();
  loadChosenColors();
  applyTheme(loadChoice(THEME_STORAGE_KEY, THEMES, "system"));
  renderWeekdayHeadings();
  renderTypeLegend();
  renderTypeOptions();

  // Refresh the "due in …" text every minute so it stays accurate if the tab stays open.
  setInterval(render, 60 * 1000);
  // A running timer's clock ticks every second without redrawing the list.
  setInterval(tickTimers, 1000);
  render();
  startAccount();
  // Keep a copy of the app's files so it opens offline (see sw.js). Without it the app still works online.
  navigator.serviceWorker?.register("sw.js").catch(() => {});
}

start();
