// What's new: one-line notes about features you'd notice, shown once per device after an update. No DOM, so it can be
// unit-tested with Node. Add a note (and its phrase in src/i18n.js) when publishing such a feature; never reorder or
// remove one, since each device remembers the id of the newest note it has shown.

/** Oldest first. Each phrase is a key in src/i18n.js. */
export const NOTES = [
  { id: "2026-11-06-weekday-hours", phrase: "new.weekday_hours" },
  { id: "2026-11-06-week-banner", phrase: "new.week_banner" },
  { id: "2026-11-06-monday-first", phrase: "new.monday_first" },
  { id: "2026-11-06-course-progress", phrase: "new.course_progress" },
  { id: "2026-11-07-copy-week", phrase: "new.copy_week" },
  { id: "2026-11-10-version", phrase: "new.version" },
  { id: "2026-11-11-regular-day-reminder", phrase: "new.regular_day_reminder" },
];

/**
 * Which notes to show, newest first, and which id to remember without showing anything. `seenId` is the newest
 * note this device has shown (null if none yet). A device that never saw a note shows them all if it already has
 * assignments (someone who used the app before notes existed), and none if it doesn't (a first-time visitor, who
 * gets the tour instead): then markSeen is the newest id, so later notes are the only ones it shows.
 * An id that isn't in the list (say, from a newer version on another tab) shows nothing.
 */
export function notesToShow(notes, seenId, hasAssignments) {
  const newestId = notes.at(-1)?.id ?? null;
  if (seenId === null) {
    return hasAssignments ? { show: [...notes].reverse(), markSeen: null } : { show: [], markSeen: newestId };
  }
  const seenAt = notes.findIndex((note) => note.id === seenId);
  return { show: seenAt === -1 ? [] : notes.slice(seenAt + 1).reverse(), markSeen: null };
}
