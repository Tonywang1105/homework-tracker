// Saves the assignment list in the browser's localStorage as JSON.

import { t } from "./i18n.js?v=da81b4bb";

export const STORAGE_KEY = "homework-tracker.assignments.v1";

/**
 * Reads saved assignments. Returns { ok: true, assignments } or, if the saved data
 * cannot be read, { ok: false, error } so the page can say so instead of crashing.
 */
export function loadAssignments(storage) {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    if (saved === null) {
      return { ok: true, assignments: [] };
    }
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      return { ok: false, error: t("err.saved_not_list") };
    }
    return { ok: true, assignments: parsed };
  } catch (error) {
    return { ok: false, error: t("err.saved_unreadable", { detail: error.message }) };
  }
}

/** Writes the list. Returns true on success, false if the browser refused (for example, storage is full or blocked). */
export function saveAssignments(storage, assignments) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(assignments));
    return true;
  } catch {
    return false;
  }
}
