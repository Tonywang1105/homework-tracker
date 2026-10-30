// Recently deleted: deleted assignments are kept for 30 days, so a missed Undo (or a Select delete) can be put
// right. They stay in the saved and synced list with a deletedAt time, and the app splits them off where it loads
// and saves, so every screen sees only the live ones. No DOM, so it can be unit-tested with Node.

export const KEEP_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Splits a saved or synced list into { live, deleted }, deleted newest first. Anything deleted more than
 * 30 days ago is dropped, which (once saved) removes it for good, on every device.
 */
export function splitDeleted(all, now = new Date()) {
  const cutoff = now.getTime() - KEEP_DAYS * DAY_MS;
  const live = all.filter((a) => !a.deletedAt);
  const deleted = all
    .filter((a) => a.deletedAt && Date.parse(a.deletedAt) >= cutoff)
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  return { live, deleted };
}

/**
 * The deleted list after the live list changes from `before` to `after`: whatever left the list is added with
 * the time it was deleted (except example assignments, which are just removed), and whatever came back (Undo)
 * is taken out.
 */
export function withDeletions(before, after, deleted, now = new Date()) {
  const stillLive = new Set(after.map((a) => a.id));
  const removed = before
    .filter((a) => !stillLive.has(a.id) && !a.example)
    .map((a) => ({ ...a, deletedAt: now.toISOString() }));
  const removedIds = new Set(removed.map((a) => a.id));
  return [...removed, ...deleted.filter((a) => !stillLive.has(a.id) && !removedIds.has(a.id))];
}

/** Restore: the assignment goes back to the live list as it was, without its deletedAt. */
export function restoreDeleted(live, deleted, id) {
  const item = deleted.find((a) => a.id === id);
  if (!item) {
    return { live, deleted };
  }
  const { deletedAt, ...restored } = item;
  return { live: [...live, restored], deleted: deleted.filter((a) => a.id !== id) };
}

/** Canvas assignments in Recently deleted, so importing again doesn't bring them back. */
export function deletedCanvasUids(deleted) {
  return new Set(deleted.filter((a) => a.canvasUid).map((a) => a.canvasUid));
}

/** "just now", "3 hours ago", "2 days ago". */
export function deletedAgo(deletedAt, now = new Date()) {
  const minutes = Math.floor((now - new Date(deletedAt)) / 60000);
  if (minutes < 60) {
    return "just now";
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
