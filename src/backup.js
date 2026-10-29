// Backing up the assignment list to a file and restoring it, so the list survives a cleared
// browser and can move to another browser or device. No DOM, so it can be unit-tested with Node.

import { validateAssignmentInput } from "./assignments.js?v=14885c19";
import { toDateKey } from "./calendar.js?v=14885c19";
import { readSpentSeconds } from "./timer.js?v=14885c19";

// Written into every backup, so restoring can tell our file from any other JSON file.
const BACKUP_FORMAT = "homework-tracker-backup";
const BACKUP_VERSION = 1;

/** The backup file's contents: the list plus enough labeling to recognize it later. */
export function createBackup(assignments, now = new Date()) {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), assignments };
}

/** "homework-tracker-backup-2026-10-14.json" */
export function backupFileName(now = new Date()) {
  return `${BACKUP_FORMAT}-${toDateKey(now)}.json`;
}

/**
 * Reads a backup file's text. Returns { ok: true, assignments, skipped } or { ok: false, error }.
 * Every assignment goes through the same checks as the form; ones that fail (or repeat an id)
 * are skipped and counted, so a damaged file can't put broken data into the app.
 */
export function readBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't a Homework Tracker backup." };
  }
  if (backup?.format !== BACKUP_FORMAT || !Array.isArray(backup.assignments)) {
    return { ok: false, error: "That file isn't a Homework Tracker backup." };
  }
  if (typeof backup.version !== "number" || backup.version > BACKUP_VERSION) {
    return { ok: false, error: "That backup was made by a newer version of Homework Tracker. Reload the page and try again." };
  }

  const assignments = [];
  const seenIds = new Set();
  let skipped = 0;
  for (const saved of backup.assignments) {
    const restored = restoreAssignment(saved);
    if (!restored || seenIds.has(restored.id)) {
      skipped += 1;
      continue;
    }
    seenIds.add(restored.id);
    assignments.push(restored);
  }
  return { ok: true, assignments, skipped };
}

/** One saved assignment, checked and cleaned, or null if it can't be used. */
function restoreAssignment(saved) {
  if (typeof saved?.id !== "string" || saved.id === "") {
    return null;
  }
  const result = validateAssignmentInput({
    title: String(saved.title ?? ""),
    course: String(saved.course ?? ""),
    dueDate: String(saved.dueDate ?? ""),
    dueTime: String(saved.dueTime ?? ""),
    priority: saved.priority,
    notes: String(saved.notes ?? ""),
    type: saved.type,
    hours: saved.hours ?? "",
    steps: saved.steps,
  });
  if (!result.ok) {
    return null;
  }
  const restored = {
    id: saved.id,
    ...result.fields,
    done: saved.done === true,
    createdAt: typeof saved.createdAt === "string" ? saved.createdAt : new Date(0).toISOString(),
  };
  if (typeof saved.canvasUid === "string") {
    restored.canvasUid = saved.canvasUid;
  }
  // Keeps a repeating series combined in the list after a backup is restored.
  if (typeof saved.seriesId === "string") {
    restored.seriesId = saved.seriesId;
  }
  // An extension's original date, if it looks like one.
  if (/^\d{4}-\d{2}-\d{2}$/.test(saved.originalDueDate) && /^\d{2}:\d{2}$/.test(saved.originalDueTime)) {
    restored.originalDueDate = saved.originalDueDate;
    restored.originalDueTime = saved.originalDueTime;
  }
  // When it was finished, for the streak, if it's a real time.
  if (restored.done && typeof saved.doneAt === "string" && !Number.isNaN(Date.parse(saved.doneAt))) {
    restored.doneAt = saved.doneAt;
  }
  // Time spent is kept; a running timer isn't, since a backup may be days old and would count the whole gap.
  const spentSeconds = readSpentSeconds(saved.spentSeconds);
  if (spentSeconds !== undefined) {
    restored.spentSeconds = spentSeconds;
  }
  // Keeps "Remove example assignments" working after a backup is restored.
  if (saved.example === true) {
    restored.example = true;
  }
  return restored;
}
