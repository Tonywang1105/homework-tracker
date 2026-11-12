// Connects the page to the app: draws everything (render) and wires up the controls at start-up.

import { courseNames, dueSoon, filterAssignments, groupAssignments, searchWords, splitRecentDone } from "./assignments.js?v=29f9a5f9";
import { currentMonth, shiftMonth } from "./calendar.js?v=29f9a5f9";
import { hasExamples } from "./examples.js?v=29f9a5f9";
import { t } from "./i18n.js?v=29f9a5f9";
import { parseSavedWidth } from "./layout.js?v=29f9a5f9";
import { DEFAULT_DAILY_HOURS, parseDailyHours, planStarts, todayPlan } from "./plan.js?v=29f9a5f9";
import { combineSeries } from "./repeat.js?v=29f9a5f9";
import { loadAssignments } from "./storage.js?v=29f9a5f9";
import { splitDeleted } from "./trash.js?v=29f9a5f9";
import { isSyncing, startAccount } from "./ui/account.js?v=29f9a5f9";
import { renderAgenda } from "./ui/agendaView.js?v=29f9a5f9";
import { startCalendarDrag } from "./ui/calendarDrag.js?v=29f9a5f9";
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
} from "./ui/calendarView.js?v=29f9a5f9";
import { handleCourseColorChange, loadChosenColors, updateCourseColors } from "./ui/colorsPanel.js?v=29f9a5f9";
import { renderCoursePage, startCoursePages } from "./ui/coursePage.js?v=29f9a5f9";
import { renderDeleted, startDeletedPanel } from "./ui/deletedPanel.js?v=29f9a5f9";
import { elements } from "./ui/dom.js?v=29f9a5f9";
import { renderFocus, startFocus, tickFocus } from "./ui/focus.js?v=29f9a5f9";
import {
  closeForm,
  focusForm,
  handleSubmit,
  renderTypeOptions,
  setFormOpen,
  startCopying,
  startEditing,
  startHoursSuggestion,
  updateHoursSuggestion,
  updateRepeatFields,
  updateStepsLabel,
} from "./ui/form.js?v=29f9a5f9";
import { offerGuide, startGuideListeners } from "./ui/guide.js?v=29f9a5f9";
import { rememberFocus, restoreFocus } from "./ui/keepFocus.js?v=29f9a5f9";
import { startCopyWeek } from "./ui/copyWeek.js?v=29f9a5f9";
import { startLanguage } from "./ui/language.js?v=29f9a5f9";
import { renderLessonBar, startLessonBar } from "./ui/lessonBar.js?v=29f9a5f9";
import {
  applySavedFilters,
  emptyMessageText,
  handleFilterChange,
  handleListClick,
  handleSearchInput,
  renderAssignment,
  renderCourseFilter,
  renderCourseSuggestions,
  renderPlatformFilter,
  renderShowOlder,
  renderTodoRow,
  tickTimers,
  toggleDone,
} from "./ui/list.js?v=29f9a5f9";
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
} from "./ui/panels.js?v=29f9a5f9";
import { renderPastePreviews, startPastePanels } from "./ui/pastePanel.js?v=29f9a5f9";
import { startReminders } from "./ui/reminders.js?v=29f9a5f9";
import { handleQuickAddInput, handleQuickAddSubmit } from "./ui/quickAdd.js?v=29f9a5f9";
import { handleTodaySummaryClick, renderReview, renderTodaySummary } from "./ui/reviewPanel.js?v=29f9a5f9";
import { renderSelect, startSelect } from "./ui/select.js?v=29f9a5f9";
import {
  applyTheme,
  applyWeekStart,
  DAILY_HOURS_KEY,
  FORM_WIDTH_KEY,
  handleDailyHoursChange,
  handleResizerKey,
  renderWorkload,
  resetFormWidth,
  setTheme,
  setWeekStart,
  renderVersion,
  setView,
  startResizing,
  THEME_STORAGE_KEY,
  THEMES,
  WEEK_START_KEY,
  WEEK_STARTS,
  VIEW_STORAGE_KEY,
  VIEWS,
} from "./ui/settings.js?v=29f9a5f9";
import { startShortcuts } from "./ui/shortcuts.js?v=29f9a5f9";
import { renderTodayPlan, todayPlanList } from "./ui/todayPlan.js?v=29f9a5f9";
import { findAssignment, loadChoice, loadText, state, updateAssignments } from "./ui/store.js?v=29f9a5f9";
import { handleUndo, hideToast, showToast } from "./ui/toast.js?v=29f9a5f9";
import { renderWeekBanner, startWeekBanner } from "./ui/weekBanner.js?v=29f9a5f9";
import { renderWhatsNew, startWhatsNew } from "./ui/whatsNewBanner.js?v=29f9a5f9";
import { hoursLimit, renderWeekdayHours, startWeekdayHours } from "./ui/weekdayHours.js?v=29f9a5f9";

export function render() {
  // Redrawing replaces the rows, so note where keyboard focus is and put it back afterwards (see keepFocus.js).
  const focusSpot = rememberFocus();
  const courses = courseNames(state.assignments);
  updateCourseColors(courses);
  renderCourseFilter(courses);
  renderPlatformFilter();
  renderCourseSuggestions(courses);

  const filters = {
    course: elements.courseFilter.value,
    platform: elements.platformFilter.value,
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
  state.startPlan = planStarts(state.assignments, now, hoursLimit());
  // Today's plan is worked out once, so its box and the steps' days in the list agree on what's today's.
  state.todayPlan = todayPlan(state.assignments, state.startPlan, now, hoursLimit());

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
  renderWhatsNew();
  renderWeekBanner(now);
  renderCanvasReminder(now);
  renderReview(now);
  renderTodaySummary(now);
  renderTodayPlan(now);
  renderCoursePage();
  renderFocus(now);
  renderLessonBar();
  renderSelect();
  renderDeleted(now);
  renderPastePreviews();
  renderVersion();
  // Weekday names follow the language, and empty boxes show the usual hours.
  renderWeekdayHours();
  // Finishing timed work can change what Time needed suggests.
  updateHoursSuggestion();
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
  restoreFocus(focusSpot);
}

function start() {
  const loaded = loadAssignments(localStorage);
  if (loaded.ok) {
    ({ live: state.assignments, deleted: state.deleted } = splitDeleted(loaded.assignments));
  } else {
    state.storageReadable = false;
    elements.storageErrorMessage.textContent = t("msg.storage_read_failed", { error: loaded.error });
    elements.storageError.hidden = false;
  }

  elements.form.addEventListener("submit", handleSubmit);
  elements.form.elements.repeat.addEventListener("change", updateRepeatFields);
  elements.form.elements.type.addEventListener("change", updateStepsLabel);
  elements.form.elements.title.addEventListener("input", updateStepsLabel);
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
  elements.platformFilter.addEventListener("change", handleFilterChange);
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
  startFocus();
  startSelect();
  startCalendarDrag();
  startDeletedPanel();
  startPastePanels();
  startHoursSuggestion();
  startLessonBar();
  startReminders();
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
  for (const button of elements.weekStartButtons) {
    button.addEventListener("click", () => {
      setWeekStart(button.dataset.weekStart);
      renderWeekdayHeadings();
      render();
    });
  }
  elements.previousMonth.addEventListener("click", () => showMonth(shiftMonth(state.shownMonth, -1)));
  elements.nextMonth.addEventListener("click", () => showMonth(shiftMonth(state.shownMonth, 1)));
  elements.thisMonth.addEventListener("click", () => showMonth(currentMonth()));
  elements.resetStorage.addEventListener("click", () => {
    state.storageReadable = true;
    elements.storageError.hidden = true;
    if (isSyncing()) {
      // Signed in, the list on screen is the account's: keep it and save it here, rather than syncing an empty list
      // (which would move everything in the account to Recently deleted, on every device).
      updateAssignments(state.assignments);
      showToast(t("msg.started_over_synced"));
    } else {
      updateAssignments([]);
      showToast(t("msg.started_over"));
    }
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
  startWeekdayHours();
  startWhatsNew();
  startWeekBanner();
  startCopyWeek();

  state.view = loadChoice(VIEW_STORAGE_KEY, VIEWS, "list");
  // The Type and Where choices go in first, so a saved Where filter has its option to select.
  renderTypeOptions();
  // After the type options exist (they're translated too), before anything is drawn.
  startLanguage();
  applySavedFilters();
  loadChosenColors();
  applyTheme(loadChoice(THEME_STORAGE_KEY, THEMES, "system"));
  applyWeekStart(loadChoice(WEEK_START_KEY, WEEK_STARTS, "sunday"));
  renderWeekdayHeadings();
  renderTypeLegend();

  // Refresh the "due in …" text every minute so it stays accurate if the tab stays open.
  setInterval(render, 60 * 1000);
  // A running timer's clock ticks every second without redrawing the list, and focus blocks are checked.
  setInterval(() => {
    tickTimers();
    tickFocus();
  }, 1000);
  render();
  startAccount();
  // Keep a copy of the app's files so it opens offline (see sw.js). Without it the app still works online.
  navigator.serviceWorker?.register("sw.js").catch(() => {});
}

start();
