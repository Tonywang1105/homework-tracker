// The panels under the To do list: Canvas import (and its reminder), backup and restore, calendar export, and example assignments.

import { backupFileName, createBackup, readBackup } from "../backup.js?v=ccd67723";
import {
  importReminder,
  isIcsCalendar,
  lastImportTime,
  mergeCanvasAssignments,
  readCanvasAssignments,
  snoozeUntil,
} from "../canvas.js?v=ccd67723";
import { exampleAssignments, removeExamples } from "../examples.js?v=ccd67723";
import { calendarFile, calendarFileName, upcomingForExport } from "../export.js?v=ccd67723";
import { t } from "../i18n.js?v=ccd67723";
import { deletedCanvasUids } from "../trash.js?v=ccd67723";
import { render } from "../main.js?v=ccd67723";
import { countAssignments, downloadFile, elements } from "./dom.js?v=ccd67723";
import { loadText, removeChoice, saveChoice, state, updateAssignments } from "./store.js?v=ccd67723";
import { showToast } from "./toast.js?v=ccd67723";

const CANVAS_IMPORTED_KEY = "homework-tracker.canvasImportedAt";

const CANVAS_SNOOZE_KEY = "homework-tracker.canvasReminderSnoozedUntil";

// A semester's Canvas feed or a backup is well under 1 MB; anything far bigger is the wrong file.
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

// The panels under the To do list (Weekly review, Canvas import, calendar export, backup, Settings). Only one is open at a time.
export const panels = [
  { toggleId: "canvas-panel-toggle", panelId: "import-panel", firstButtonId: "canvas-import-button", closeId: "canvas-panel-close" },
  { toggleId: "backup-panel-toggle", panelId: "backup-panel", firstButtonId: "backup-download-button", closeId: "backup-panel-close" },
  { toggleId: "export-panel-toggle", panelId: "export-panel", firstButtonId: "export-download-button", closeId: "export-panel-close" },
  { toggleId: "review-panel-toggle", panelId: "review-panel", firstButtonId: "review-panel-close", closeId: "review-panel-close" },
  { toggleId: "settings-panel-toggle", panelId: "settings-panel", firstButtonId: "daily-hours", closeId: "settings-panel-close" },
].map(({ toggleId, panelId, firstButtonId, closeId }) => ({
  toggle: document.getElementById(toggleId),
  panel: document.getElementById(panelId),
  firstButton: document.getElementById(firstButtonId),
  close: document.getElementById(closeId),
}));

export const canvasPanel = panels.find((panel) => panel.panel.id === "import-panel");

export function setPanelOpen(chosen, open) {
  for (const panel of panels) {
    const isOpen = open && panel === chosen;
    panel.panel.hidden = !isOpen;
    panel.toggle.setAttribute("aria-expanded", String(isOpen));
  }
  // Focus first: moving focus after starting a smooth scroll cancels the scroll in Chrome.
  (open ? chosen.firstButton : chosen.toggle).focus({ preventScroll: true });
  if (open) {
    // Scroll far enough to show the buttons, which sit below the how-to text.
    chosen.close.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

/**
 * Reads the file just chosen in a hidden file input. Returns its { file, text }, or null after
 * telling the student what went wrong. `kind` is the phrase key naming the file in messages, e.g. "kind.canvas".
 */
async function readChosenFile(input, kind) {
  const file = input.files[0];
  // Clear the choice so picking the same file again still fires "change".
  input.value = "";
  if (!file) {
    return null;
  }
  if (file.size > MAX_IMPORT_BYTES) {
    showToast(t("msg.file_too_big", { name: file.name, kind: t(kind) }));
    return null;
  }
  try {
    return { file, text: await file.text() };
  } catch {
    showToast(t("msg.file_unreadable", { name: file.name }));
    return null;
  }
}

export async function handleCanvasFile() {
  const chosen = await readChosenFile(elements.canvasFile, "kind.canvas");
  if (!chosen) {
    return;
  }
  const { file, text } = chosen;
  if (!isIcsCalendar(text)) {
    showToast(t("msg.not_ics", { name: file.name }));
    return;
  }
  const inFile = readCanvasAssignments(text);
  if (inFile.length === 0) {
    showToast(t("msg.no_canvas"));
    return;
  }
  // Assignments deleted here stay deleted, while they're in Recently deleted. (If that's all of them, the merge
  // below has nothing to add and says the list is already up to date.)
  const skipped = deletedCanvasUids(state.deleted);
  const imported = inFile.filter((item) => !skipped.has(item.canvasUid));

  const previous = state.assignments;
  const result = mergeCanvasAssignments(previous, imported);
  // Even "already up to date" counts as a fresh import: the deadlines were checked.
  saveChoice(CANVAS_IMPORTED_KEY, new Date().toISOString());
  removeChoice(CANVAS_SNOOZE_KEY);
  if (result.added === 0 && result.updated === 0) {
    render();
    showToast(importSummary(result));
    return;
  }
  updateAssignments(result.assignments);
  showToast(importSummary(result), () => updateAssignments(previous));
}

export function renderCanvasReminder(now) {
  const lastImport = lastImportTime(state.assignments, loadText(CANVAS_IMPORTED_KEY));
  const reminder = importReminder(lastImport, loadText(CANVAS_SNOOZE_KEY), now);
  elements.canvasReminder.hidden = reminder === null;
  if (reminder) {
    elements.canvasReminderText.textContent = t("canvas.reminder", { n: reminder.daysAgo });
  }
}

export function snoozeCanvasReminder() {
  saveChoice(CANVAS_SNOOZE_KEY, snoozeUntil());
  render();
  showToast(t("msg.reminder_snoozed"));
}

/** "Imported 3 new, updated 1. Skipped 2 already past due." */
function importSummary({ added, updated, skippedPast }) {
  const changes = [];
  if (added > 0) {
    changes.push(t("msg.canvas_new", { n: added }));
  }
  if (updated > 0) {
    changes.push(t("msg.canvas_updated", { n: updated }));
  }
  let summary = changes.length > 0 ? t("msg.canvas_changes", { changes: changes.join(", ") }) : t("msg.canvas_up_to_date");
  if (skippedPast > 0) {
    summary += t("msg.canvas_skipped", { n: skippedPast });
  }
  return summary;
}

export function handleBackupDownload() {
  if (state.assignments.length === 0) {
    showToast(t("msg.nothing_backup"));
    return;
  }
  const fileName = backupFileName();
  downloadFile(fileName, JSON.stringify(createBackup(state.assignments), null, 2), "application/json");
  showToast(t("msg.backed_up", { count: countAssignments(state.assignments.length), file: fileName }));
}

export function handleCalendarExport() {
  const upcoming = upcomingForExport(state.assignments);
  if (upcoming.length === 0) {
    showToast(t("msg.nothing_export"));
    return;
  }
  const fileName = calendarFileName();
  downloadFile(fileName, calendarFile(state.assignments), "text/calendar");
  showToast(t("msg.exported", { count: countAssignments(upcoming.length), file: fileName }));
}

export async function handleBackupFile() {
  const chosen = await readChosenFile(elements.backupFile, "kind.backup");
  if (!chosen) {
    return;
  }
  const result = readBackup(chosen.text);
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  const previous = state.assignments;
  const replacing = t("msg.confirm_replace", { current: countAssignments(previous.length), backup: countAssignments(result.assignments.length) });
  if (previous.length > 0 && !window.confirm(replacing)) {
    return;
  }

  // A restore is also the way back from unreadable saved data, so saving is allowed again.
  state.storageReadable = true;
  elements.storageError.hidden = true;
  updateAssignments(result.assignments);
  const skipped = result.skipped > 0 ? t("msg.restore_skipped", { n: result.skipped }) : "";
  showToast(t("msg.restored", { count: countAssignments(result.assignments.length), skipped }), () => updateAssignments(previous));
}

export function addExamples() {
  const examples = exampleAssignments();
  updateAssignments([...state.assignments, ...examples]);
  showToast(t("msg.examples_added", { count: countAssignments(examples.length) }));
}

export function handleRemoveExamples() {
  const previous = state.assignments;
  updateAssignments(removeExamples(previous));
  showToast(t("msg.examples_removed"), () => updateAssignments(previous));
}
