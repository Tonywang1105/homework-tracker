// Page elements and small helpers for building the page: buttons, tags, notes, dates, downloads.

import { dueSoon, toDueDate, workload } from "../assignments.js?v=f2a236bc";
import { removeExamples } from "../examples.js?v=f2a236bc";
import { splitLinks } from "../links.js?v=f2a236bc";

export const elements = {
  form: document.getElementById("assignment-form"),
  formHeading: document.getElementById("form-heading"),
  formPanel: document.getElementById("form-panel"),
  layout: document.querySelector(".layout"),
  columnResizer: document.getElementById("column-resizer"),
  repeatFields: document.getElementById("repeat-fields"),
  untilField: document.getElementById("until-field"),
  addToggle: document.getElementById("add-toggle"),
  listHeading: document.getElementById("list-heading"),
  quickAdd: document.getElementById("quick-add"),
  quickAddText: document.getElementById("quick-add-text"),
  quickAddPreview: document.getElementById("quick-add-preview"),
  submitButton: document.getElementById("submit-button"),
  cancelEdit: document.getElementById("cancel-edit"),
  courseSuggestions: document.getElementById("course-suggestions"),
  filters: document.getElementById("filters"),
  showSmall: document.getElementById("show-small"),
  hideDone: document.getElementById("hide-done"),
  courseFilter: document.getElementById("course-filter"),
  search: document.getElementById("search"),
  searchField: document.getElementById("search-field"),
  todoList: document.getElementById("todo-list"),
  todoCount: document.getElementById("todo-count"),
  emptyMessage: document.getElementById("empty-message"),
  workload: document.getElementById("workload"),
  workloadText: document.getElementById("workload-text"),
  dailyLimit: document.getElementById("daily-limit"),
  dailyHours: document.getElementById("daily-hours"),
  dueSoon: document.getElementById("due-soon"),
  dueSoonCount: document.getElementById("due-soon-count"),
  dueSoonList: document.getElementById("due-soon-list"),
  gettingStarted: document.getElementById("getting-started"),
  tryExamples: document.getElementById("try-examples"),
  exampleBar: document.getElementById("example-bar"),
  canvasReminder: document.getElementById("canvas-reminder"),
  canvasReminderText: document.getElementById("canvas-reminder-text"),
  canvasReminderImport: document.getElementById("canvas-reminder-import"),
  canvasReminderSnooze: document.getElementById("canvas-reminder-snooze"),
  removeExamples: document.getElementById("remove-examples"),
  doneSection: document.getElementById("done-section"),
  doneList: document.getElementById("done-list"),
  doneCount: document.getElementById("done-count"),
  storageError: document.getElementById("storage-error"),
  storageErrorMessage: document.getElementById("storage-error-message"),
  resetStorage: document.getElementById("reset-storage"),
  toast: document.getElementById("toast"),
  toastMessage: document.getElementById("toast-message"),
  toastUndo: document.getElementById("toast-undo"),
  toastClose: document.getElementById("toast-close"),
  viewButtons: document.querySelectorAll(".view-button"),
  themeButtons: document.querySelectorAll(".theme-button"),
  signIn: document.getElementById("sign-in"),
  signOut: document.getElementById("sign-out"),
  accountStatus: document.getElementById("account-status"),
  listView: document.getElementById("list-view"),
  calendarView: document.getElementById("calendar-view"),
  agendaView: document.getElementById("agenda-view"),
  agendaList: document.getElementById("agenda-list"),
  agendaLater: document.getElementById("agenda-later"),
  views: document.getElementById("views"),
  calendarMonth: document.getElementById("calendar-month"),
  calendarWeekdays: document.getElementById("calendar-weekdays"),
  typeLegend: document.getElementById("type-legend"),
  calendarBody: document.getElementById("calendar-body"),
  calendarEmpty: document.getElementById("calendar-empty"),
  previousMonth: document.getElementById("previous-month"),
  nextMonth: document.getElementById("next-month"),
  thisMonth: document.getElementById("this-month"),
  canvasImportButton: document.getElementById("canvas-import-button"),
  canvasFile: document.getElementById("canvas-file"),
  backupDownloadButton: document.getElementById("backup-download-button"),
  backupRestoreButton: document.getElementById("backup-restore-button"),
  backupFile: document.getElementById("backup-file"),
  exportDownloadButton: document.getElementById("export-download-button"),
  details: document.getElementById("calendar-details"),
  detailsTitle: document.getElementById("details-title"),
  detailsTags: document.getElementById("details-tags"),
  detailsDue: document.getElementById("details-due"),
  detailsNotes: document.getElementById("details-notes"),
  detailsSteps: document.getElementById("details-steps"),
  detailsClose: document.getElementById("details-close"),
  detailsEdit: document.getElementById("details-edit"),
  detailsDone: document.getElementById("details-done"),
};

// Dates always read like "Fri, 10/16, 11:59 PM" and the calendar in English, whatever language the browser uses.
export const DATE_LOCALE = "en-US";

export const dueFormatter = new Intl.DateTimeFormat(DATE_LOCALE, {
  weekday: "short",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const monthFormatter = new Intl.DateTimeFormat(DATE_LOCALE, { month: "long", year: "numeric" });

export const timeFormatter = new Intl.DateTimeFormat(DATE_LOCALE, { hour: "numeric", minute: "2-digit" });

const dayFormatter = new Intl.DateTimeFormat(DATE_LOCALE, { weekday: "short", month: "numeric", day: "numeric" });

/** "Wed, 10/21" for a "YYYY-MM-DD" date. */
export function formatDay(dateKey) {
  return dayFormatter.format(toDueDate(dateKey, "12:00"));
}

/**
 * Puts a note into `element`, with its web links clickable. Text is added as text and each link as a real link
 * element (never as HTML), so nothing typed in a note can run as code. Links open in a new tab, keeping the app open.
 */
export function showNote(element, note) {
  element.replaceChildren(
    ...splitLinks(note).map((part) => {
      if (!part.url) {
        return part.text;
      }
      const link = document.createElement("a");
      link.href = part.url;
      link.textContent = part.label;
      link.title = part.url;
      link.target = "_blank";
      // The opened page can't reach back into the app, and isn't told which page linked to it.
      link.rel = "noopener noreferrer";
      return link;
    }),
  );
}

export function makeTag(text, className) {
  const tag = document.createElement("span");
  tag.className = className;
  tag.textContent = text;
  return tag;
}

/** A plain button (type="button", so it never submits a form) with a class and optional text. */
export function makeButton(className, text = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  return button;
}

export function makeOption(value, text) {
  const option = document.createElement("option");
  option.value = value;
  if (text !== undefined) {
    option.textContent = text;
  }
  return option;
}

/** "1 assignment", "12 assignments" */
export function countAssignments(count) {
  return `${count} assignment${count === 1 ? "" : "s"}`;
}

/** Hands the browser a file to download, made from text in memory. */
export function downloadFile(fileName, contents, type) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([contents], { type }));
  link.download = fileName;
  link.click();
  // Give the browser a moment to start the download before freeing the file's memory.
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
