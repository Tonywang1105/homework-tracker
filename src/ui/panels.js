// The panels under the To do list: Canvas import (and its reminder), backup and restore, calendar export, and example assignments.

import { backupFileName, createBackup, readBackup } from "../backup.js?v=8fe9dbad";
import {
  importReminder,
  isIcsCalendar,
  lastImportTime,
  mergeCanvasAssignments,
  readCanvasAssignments,
  snoozeUntil,
} from "../canvas.js?v=8fe9dbad";
import { exampleAssignments, removeExamples } from "../examples.js?v=8fe9dbad";
import { calendarFile, calendarFileName, upcomingForExport } from "../export.js?v=8fe9dbad";
import { render } from "../main.js?v=8fe9dbad";
import { countAssignments, downloadFile, elements } from "./dom.js?v=8fe9dbad";
import { loadText, removeChoice, saveChoice, state, updateAssignments } from "./store.js?v=8fe9dbad";
import { showToast } from "./toast.js?v=8fe9dbad";

const CANVAS_IMPORTED_KEY = "homework-tracker.canvasImportedAt";

const CANVAS_SNOOZE_KEY = "homework-tracker.canvasReminderSnoozedUntil";

// A semester's Canvas feed or a backup is well under 1 MB; anything far bigger is the wrong file.
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

// The two panels under the To do list ("Import from Canvas…" and "Backup & restore…"). Only one is open at a time.
export const panels = [
  { toggleId: "canvas-panel-toggle", panelId: "import-panel", firstButtonId: "canvas-import-button", closeId: "canvas-panel-close" },
  { toggleId: "backup-panel-toggle", panelId: "backup-panel", firstButtonId: "backup-download-button", closeId: "backup-panel-close" },
  { toggleId: "export-panel-toggle", panelId: "export-panel", firstButtonId: "export-download-button", closeId: "export-panel-close" },
  { toggleId: "review-panel-toggle", panelId: "review-panel", firstButtonId: "review-panel-close", closeId: "review-panel-close" },
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
 * telling the student what went wrong. `kind` names the file in messages, e.g. "Canvas calendar file".
 */
async function readChosenFile(input, kind) {
  const file = input.files[0];
  // Clear the choice so picking the same file again still fires "change".
  input.value = "";
  if (!file) {
    return null;
  }
  if (file.size > MAX_IMPORT_BYTES) {
    showToast(`"${file.name}" is too big to be a ${kind}.`);
    return null;
  }
  try {
    return { file, text: await file.text() };
  } catch {
    showToast(`Couldn't read "${file.name}". Try choosing it again.`);
    return null;
  }
}

export async function handleCanvasFile() {
  const chosen = await readChosenFile(elements.canvasFile, "Canvas calendar file");
  if (!chosen) {
    return;
  }
  const { file, text } = chosen;
  if (!isIcsCalendar(text)) {
    showToast(`"${file.name}" isn't a calendar (.ics) file. Use the Calendar Feed link in Canvas Calendar.`);
    return;
  }
  const imported = readCanvasAssignments(text);
  if (imported.length === 0) {
    showToast("No Canvas assignments found in that file.");
    return;
  }

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
    elements.canvasReminderText.textContent = `Your Canvas import is ${reminder.daysAgo} days old. New or changed deadlines won't show until you import again.`;
  }
}

export function snoozeCanvasReminder() {
  saveChoice(CANVAS_SNOOZE_KEY, snoozeUntil());
  render();
  showToast("OK, I'll remind you again in 3 days.");
}

/** "Imported 3 new, updated 1. Skipped 2 already past due." */
function importSummary({ added, updated, skippedPast }) {
  const changes = [];
  if (added > 0) {
    changes.push(`imported ${added} new`);
  }
  if (updated > 0) {
    changes.push(`updated ${updated}`);
  }
  let summary = changes.length > 0 ? `Canvas: ${changes.join(", ")}.` : "Canvas: already up to date.";
  if (skippedPast > 0) {
    summary += ` Skipped ${skippedPast} already past due.`;
  }
  return summary;
}

export function handleBackupDownload() {
  if (state.assignments.length === 0) {
    showToast("Nothing to back up yet.");
    return;
  }
  const fileName = backupFileName();
  downloadFile(fileName, JSON.stringify(createBackup(state.assignments), null, 2), "application/json");
  showToast(`Backed up ${countAssignments(state.assignments.length)} to ${fileName}.`);
}

export function handleCalendarExport() {
  const upcoming = upcomingForExport(state.assignments);
  if (upcoming.length === 0) {
    showToast("Nothing upcoming to export: every assignment is finished or past due.");
    return;
  }
  const fileName = calendarFileName();
  downloadFile(fileName, calendarFile(state.assignments), "text/calendar");
  showToast(`Exported ${countAssignments(upcoming.length)} to ${fileName}. Open it to add them to your calendar.`);
}

export async function handleBackupFile() {
  const chosen = await readChosenFile(elements.backupFile, "Homework Tracker backup");
  if (!chosen) {
    return;
  }
  const result = readBackup(chosen.text);
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  const previous = state.assignments;
  const replacing = `Replace your ${countAssignments(previous.length)} with the ${countAssignments(result.assignments.length)} in this backup?`;
  if (previous.length > 0 && !window.confirm(replacing)) {
    return;
  }

  // A restore is also the way back from unreadable saved data, so saving is allowed again.
  state.storageReadable = true;
  elements.storageError.hidden = true;
  updateAssignments(result.assignments);
  const skipped = result.skipped > 0 ? ` Skipped ${result.skipped} that couldn't be read.` : "";
  showToast(`Restored ${countAssignments(result.assignments.length)}.${skipped}`, () => updateAssignments(previous));
}

export function addExamples() {
  const examples = exampleAssignments();
  updateAssignments([...state.assignments, ...examples]);
  showToast(`Added ${countAssignments(examples.length)} as examples. Try the calendar, filters and details.`);
}

export function handleRemoveExamples() {
  const previous = state.assignments;
  updateAssignments(removeExamples(previous));
  showToast("Removed the example assignments.", () => updateAssignments(previous));
}
