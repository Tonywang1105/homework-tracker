// Rules for syncing the list with a signed-in account, kept apart from Firebase so they can be tested.

/**
 * One assignment as the account stores it. Firestore refuses fields set to `undefined`, so those are left
 * out, and notes and done are always present because the database's rules (firestore.rules) require them.
 */
export function toRemote(assignment) {
  const remote = {};
  for (const [key, value] of Object.entries(assignment)) {
    if (value !== undefined) {
      remote[key] = value;
    }
  }
  remote.notes = assignment.notes ?? "";
  remote.done = Boolean(assignment.done);
  // Ticks also go in a map, one entry per step, which the database merges entry by entry: two devices ticking
  // different steps at once then both keep their tick (the list itself is replaced whole). The list is still stored
  // for older versions of the app.
  delete remote.stepTicks;
  if (Array.isArray(assignment.steps) && assignment.steps.length > 0) {
    remote.stepTicks = Object.fromEntries(assignment.steps.map((step) => [step.text, Boolean(step.done)]));
  }
  return remote;
}

/**
 * An assignment as the account stores it, read back for this device: ticks come from the map of ticks where it has
 * an entry for a step (see toRemote), and the map itself is left out.
 */
export function fromRemote(data, id) {
  const { stepTicks, ...assignment } = data;
  if (stepTicks && typeof stepTicks === "object" && Array.isArray(assignment.steps)) {
    assignment.steps = assignment.steps.map((step) => (typeof stepTicks[step?.text] === "boolean" ? { ...step, done: stepTicks[step.text] } : step));
  }
  return { ...assignment, id };
}

/**
 * The list after this device first signs in: everything already in the account, plus this device's
 * assignments the account doesn't have. Matching is by id, and Canvas assignments also by their Canvas id,
 * so a Canvas file imported on both the laptop and the phone doesn't give two copies of each assignment.
 * Where both have the same assignment, the account's copy wins.
 */
export function mergeLists(local, remote) {
  const remoteIds = new Set(remote.map((a) => a.id));
  const remoteCanvasUids = new Set(remote.filter((a) => a.canvasUid).map((a) => a.canvasUid));
  const added = local.filter((a) => !remoteIds.has(a.id) && !(a.canvasUid && remoteCanvasUids.has(a.canvasUid)));
  // The same Canvas assignment imported on both: the account's copy, plus what was added to it only on this device.
  const localByCanvasUid = new Map(local.filter((a) => a.canvasUid && !remoteIds.has(a.id)).map((a) => [a.canvasUid, a]));
  const kept = remote.map((theirs) => (localByCanvasUid.has(theirs.canvasUid) ? withLocalAdditions(theirs, localByCanvasUid.get(theirs.canvasUid)) : theirs));
  return { assignments: [...kept, ...added], addedCount: added.length };
}

/**
 * The account's copy of an assignment with what this device added to its own copy: notes (both kept when they
 * differ), and steps, an estimate or a weight the account's copy doesn't have. The account's other values win.
 */
function withLocalAdditions(theirs, mine) {
  const merged = { ...theirs };
  const theirNotes = theirs.notes ?? "";
  const myNotes = mine.notes ?? "";
  // Already in the account's notes (say, a first sign-in that stopped partway and ran again): not added twice.
  if (myNotes && !theirNotes.includes(myNotes)) {
    merged.notes = theirNotes ? `${theirNotes}\n\n${myNotes}` : myNotes;
  }
  if (!(theirs.steps?.length > 0) && mine.steps?.length > 0) {
    merged.steps = mine.steps;
  }
  for (const key of ["hours", "weight"]) {
    if (theirs[key] == null && mine[key] != null) {
      merged[key] = mine[key];
    }
  }
  return merged;
}

/**
 * The list after signing back in, or reconnecting, to an account this device has synced with before. `lastSynced`
 * is the account's list as this device last saw it, so each difference can be told apart:
 * - deleted on another device (in lastSynced, gone from the account) stays deleted;
 * - added here while signed out (in neither) is added;
 * - changed only here (the account still matches lastSynced) goes to the account, including a deletion, which is
 *   an assignment with deletedAt (Recently deleted);
 * - changed on both keeps the account's copy;
 * - missing here but in the account is kept: missing never means deleted, so an empty or out-of-date list on this
 *   device (unreadable storage, an emptied cache) can't delete anything from the account.
 * Returns { assignments, addedCount }, like mergeLists.
 */
export function mergeWithLastSynced(local, remote, lastSynced) {
  const localById = new Map(local.map((a) => [a.id, a]));
  const lastById = new Map(lastSynced.map((a) => [a.id, a]));
  const remoteIds = new Set(remote.map((a) => a.id));
  const remoteCanvasUids = new Set(remote.filter((a) => a.canvasUid).map((a) => a.canvasUid));

  const kept = [];
  for (const theirs of remote) {
    const mine = localById.get(theirs.id);
    const before = lastById.get(theirs.id);
    const unchangedElsewhere = before && sameAssignment(theirs, before);
    if (!mine) {
      kept.push(theirs);
    } else if (unchangedElsewhere && !sameAssignment(mine, before)) {
      kept.push(mine);
    } else {
      kept.push(theirs);
    }
  }
  const added = local.filter(
    (a) => !remoteIds.has(a.id) && !lastById.has(a.id) && !(a.canvasUid && remoteCanvasUids.has(a.canvasUid)),
  );
  return { assignments: [...kept, ...added], addedCount: added.length };
}

/**
 * What to merge when `userId` signs in or reconnects. `local` and `links` are this device's assignments and course
 * links; `saved` is the account as this device last saw it confirmed, { userId, assignments } (null if never); and
 * `setAside` maps other accounts' ids to what was set aside for them, { assignments, links, lastSynced }.
 * Returns { local, links, lastSynced, setAside, switchedFrom }:
 * - Normally local and links are this device's, and lastSynced is the saved list if it was this account's (else
 *   null, a first merge).
 * - If this device's list was last synced with a different account, nothing of it goes into this one (it's someone
 *   else's homework): it's set aside for that account (switchedFrom names it), and whatever was set aside for this
 *   account earlier is merged instead.
 */
export function signInPlan(local, links, saved, setAside, userId) {
  const kept = { ...setAside };
  const mine = kept[userId];
  delete kept[userId];
  if (saved?.userId && saved.userId !== userId) {
    kept[saved.userId] = { assignments: local, links, lastSynced: saved.assignments };
    return {
      local: mine?.assignments ?? [],
      links: mine?.links ?? [],
      lastSynced: mine?.lastSynced ?? null,
      setAside: kept,
      switchedFrom: saved.userId,
    };
  }
  if (mine && local.length === 0) {
    // This device was cleared for a switch that didn't finish: the owner gets their set-aside list back.
    return { local: mine.assignments, links: mine.links ?? [], lastSynced: mine.lastSynced ?? null, setAside: kept, switchedFrom: null };
  }
  return {
    local,
    links,
    lastSynced: saved?.userId === userId ? saved.assignments : null,
    // Only taken out of the set-aside lists when it's used above.
    setAside: mine ? { ...kept, [userId]: mine } : kept,
    switchedFrom: null,
  };
}

/**
 * What changed between two stored versions of one assignment, so only that is sent: { changed, removed }, where
 * changed holds the fields that are new or different (as stored) and removed names fields that are gone. null when
 * there's no earlier version, meaning the assignment is saved whole. Sending only this means a late save from another
 * device can't overwrite fields it never touched, such as a deletion made elsewhere.
 */
export function fieldChanges(before, after) {
  if (!before) {
    return null;
  }
  const old = toRemote(before);
  const now = toRemote(after);
  const changed = Object.fromEntries(Object.entries(now).filter(([key, value]) => stableJson(value) !== stableJson(old[key])));
  const removed = Object.keys(old).filter((key) => !(key in now));
  const result = { changed, removed };
  // The map of ticks is sent entry by entry, so this device's tick doesn't overwrite another device's other ticks.
  if (changed.stepTicks && old.stepTicks) {
    const ticks = Object.fromEntries(Object.entries(now.stepTicks).filter(([text, done]) => old.stepTicks[text] !== done));
    const gone = Object.keys(old.stepTicks).filter((text) => !(text in now.stepTicks));
    if (Object.keys(ticks).length > 0) {
      changed.stepTicks = ticks;
    } else {
      delete changed.stepTicks;
    }
    if (gone.length > 0) {
      result.removedTicks = gone;
    }
  }
  return result;
}

/**
 * The stored assignments that are whole: with a title and a due date. A save of only the changed fields to an
 * assignment another device had just deleted for good can leave a half-written one, which the database refuses but
 * Firebase shows until then; it's left out, so the list never holds an assignment with no title or date.
 */
export function completeAssignments(assignments) {
  return assignments.filter((a) => typeof a.title === "string" && a.title !== "" && typeof a.dueDate === "string" && a.dueDate !== "");
}

/** What to send to the account to turn `previous` into `next`: assignments to save, and ids to delete. */
export function listChanges(previous, next) {
  const previousById = new Map(previous.map((a) => [a.id, a]));
  const nextIds = new Set(next.map((a) => a.id));
  const saves = next.filter((a) => !previousById.has(a.id) || !sameAssignment(previousById.get(a.id), a));
  const deletes = previous.filter((a) => !nextIds.has(a.id)).map((a) => a.id);
  return { saves, deletes };
}

/** True if the two would be stored the same, ignoring the order of their fields. */
function sameAssignment(a, b) {
  return canonical(toRemote(a)) === canonical(toRemote(b));
}

/** A value as JSON with object fields in a fixed order, so equal values compare equal however they were built. */
function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function canonical(assignment) {
  return JSON.stringify(Object.keys(assignment).sort().map((key) => [key, assignment[key]]));
}
