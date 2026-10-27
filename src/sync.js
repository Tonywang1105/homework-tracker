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
  return remote;
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
  return { assignments: [...remote, ...added], addedCount: added.length };
}

/**
 * The list after signing back in to an account this device has synced with before. `lastSynced` is the
 * account's list as this device last saw it, so each difference can be told apart:
 * - deleted on another device (in lastSynced, gone from the account) stays deleted;
 * - added here while signed out (in neither) is added;
 * - changed or deleted only here (the account still matches lastSynced) goes to the account;
 * - changed on both keeps the account's copy.
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
      // Gone here: deleted here while signed out, unless the account changed it since (then it's kept).
      if (!unchangedElsewhere) {
        kept.push(theirs);
      }
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

function canonical(assignment) {
  return JSON.stringify(Object.keys(assignment).sort().map((key) => [key, assignment[key]]));
}
