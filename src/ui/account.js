// Signing in with Google and syncing the list with the account through Firebase, so the laptop and the
// phone show the same assignments. Signed out, the app works as before, with the list saved on this device only.
// Firebase is downloaded only when someone signs in, so people who never sign in don't load it at all.

import { joinLinks, linkChanges, visibleLinks } from "../courseLinks.js?v=2a915822";
import { firebaseConfig } from "../firebase-config.js?v=2a915822";
import { t } from "../i18n.js?v=2a915822";
import { render } from "../main.js?v=2a915822";
import { saveAssignments } from "../storage.js?v=2a915822";
import { completeAssignments, fieldChanges, fromRemote, listChanges, mergeLists, mergeWithLastSynced, signInPlan, toRemote } from "../sync.js?v=2a915822";
import { settleFinishedTimer } from "../timer.js?v=2a915822";
import { splitDeleted } from "../trash.js?v=2a915822";
import { applyCourseLinks } from "./coursePage.js?v=2a915822";
import { countAssignments, elements } from "./dom.js?v=2a915822";
import { loadText, removeChoice, saveChoice, state, updateDeleted } from "./store.js?v=2a915822";
import { showToast } from "./toast.js?v=2a915822";

const FIREBASE_URL = "https://www.gstatic.com/firebasejs/12.4.0";
// Set only by npm run test:sync, to run against Firebase's local emulators instead of the real project (see
// usesEmulators): a stand-in Google sign-in and database on this computer, so sync can be tested with no real account.
const EMULATOR_KEY = "homework-tracker.testEmulators";
const EMULATOR_CONFIG = { apiKey: "demo-key", authDomain: "demo-homework-tracker.firebaseapp.com", projectId: "demo-homework-tracker" };
// The id of the account this device's list was merged into, kept so the merge happens only once per device.
// Later starts trust the account, so something deleted on the phone doesn't come back from the laptop's copy.
const SYNCED_ACCOUNT_KEY = "homework-tracker.syncedAccount";
// The account's list as this device last saw it confirmed by Firebase, with whose account it was, as
// { userId, assignments }. Kept after signing out, so signing back in can tell "deleted on the phone"
// apart from "added here while signed out" (see mergeWithLastSynced).
const LAST_SYNCED_KEY = "homework-tracker.lastSynced";
// What was on this device when a different account signed in, set aside for its own account instead of being
// copied into the new one: { <user id>: { assignments, links, lastSynced } } (see signInPlan in src/sync.js).
const SET_ASIDE_KEY = "homework-tracker.setAsideLists";
// The account's course links as this device last saw them, { userId, links }, so links changed here while sync wasn't
// running can be sent as changes later (see linkChanges) instead of replacing the whole list.
const LINKS_LAST_SEEN_KEY = "homework-tracker.courseLinksLastSeen";
// Set while a course link change hasn't been confirmed by the server, so it's sent again on the next start if it never
// got there (Firebase's queue of waiting writes doesn't always survive the app being closed offline).
const LINKS_UNCONFIRMED_KEY = "homework-tracker.courseLinksUnconfirmed";
// Set when course links change while signed in but before Firebase has connected, so they're sent once it has.
const LINKS_PENDING_KEY = "homework-tracker.courseLinksPending";

let firebase = null;
let connecting = null;
// While syncing: the signed-in user's id, the list as the account last had it, and how to stop listening.
let sync = null;
// The merge that's running, { uid, generation }, so Firebase reporting the same sign-in twice doesn't start a second
// one (a sign-out and back in is a new generation, so it does start one).
let merging = null;
// Goes up whenever who is signed in changes (sign-in, sign-out, a switch), so a merge that was still running for the
// previous person stops at its next step instead of finishing for someone no longer signed in.
let generation = 0;

/** Wires up the sign-in buttons, and reconnects straight away if this device was signed in last time. */
export function startAccount() {
  if (usesEmulators()) {
    // For npm run test:sync: sign in as a made-up Google account, which the emulator accepts without a password.
    window.homeworkTrackerTest = {
      async signIn(uid, email) {
        await connect();
        const { authApi, auth } = firebase;
        const { user } = await authApi.signInWithCredential(
          auth,
          authApi.GoogleAuthProvider.credential(JSON.stringify({ sub: uid, email, email_verified: true })),
        );
        // The emulator gives each made-up account its own id; the test needs it to read that account's data.
        return user.uid;
      },
    };
  }
  elements.signIn.addEventListener("click", signIn);
  elements.signOut.addEventListener("click", handleSignOut);
  // Fetch Firebase as soon as someone looks like they're about to sign in, because browsers only let
  // the Google window open if it opens quickly after the click.
  for (const eventName of ["pointerenter", "focus", "touchstart"]) {
    elements.signIn.addEventListener(eventName, () => connect().catch(() => {}), { once: true, passive: true });
  }
  if (loadText(SYNCED_ACCOUNT_KEY)) {
    showAccount({ status: t("sync.connecting") });
    connect().catch(() => showAccount({ status: t("sync.offline_copy"), signedIn: true }));
  } else {
    showAccount({ signedIn: false });
  }
}

/** Whether this device is syncing with an account right now. */
export function isSyncing() {
  return sync !== null;
}

/** Sends the list (live and Recently deleted together) to the account after the app saves it. Does nothing while signed out. */
export function syncAssignments(assignments) {
  if (!sync) {
    return;
  }
  const before = sync.remoteList;
  const { saves, deletes } = listChanges(before, assignments);
  sync.remoteList = assignments;
  writeChanges(sync.userId, before, saves, deletes).catch(handleSyncError);
}

/**
 * Sends the course links to the account after they change: only what changed since the account's links as this
 * device last saw them (see linkChanges), so a device with an older list can't undo another's edits or bring back a
 * deleted link. They live in one small document, users/<id>/settings/courseLinks, with a record of deleted links.
 */
export function syncCourseLinks(links) {
  if (!sync) {
    if (loadText(SYNCED_ACCOUNT_KEY)) {
      saveChoice(LINKS_PENDING_KEY, "yes");
    }
    return;
  }
  const before = sync.remoteLinks ?? lastSeenLinks(sync.userId);
  if (before === null) {
    // No record yet of the account's links to compare with: they're joined once the account's links arrive.
    saveChoice(LINKS_PENDING_KEY, "yes");
    return;
  }
  saveChoice(LINKS_UNCONFIRMED_KEY, "yes");
  writeLinkChanges(sync.userId, linkChanges(before, links)).catch(handleLinksError);
}

/** Sends link changes: links to add (clearing any deletion record), and links to take out (recording the deletion). */
async function writeLinkChanges(userId, { add, drop, removedKeys, restoredKeys }) {
  const { dbApi, db } = firebase;
  const ref = dbApi.doc(db, "users", userId, "settings", "courseLinks");
  // Taking out and putting in are separate writes, since one write can't do both to the same list (a rename).
  // Each part is sent only when it has something in it.
  const takeOut = {
    ...(drop.length > 0 && { links: dbApi.arrayRemove(...drop) }),
    ...(removedKeys.length > 0 && { removed: dbApi.arrayUnion(...removedKeys) }),
  };
  const putIn = {
    ...(add.length > 0 && { links: dbApi.arrayUnion(...add) }),
    ...(restoredKeys.length > 0 && { removed: dbApi.arrayRemove(...restoredKeys) }),
  };
  // Both are queued straight away (Firebase keeps them in order): waiting for the first to reach the server would
  // leave a renamed link removed but not yet put back, and lost if the app closed offline.
  const writes = [];
  if (Object.keys(takeOut).length > 0) {
    writes.push(dbApi.setDoc(ref, takeOut, { merge: true }));
  }
  if (Object.keys(putIn).length > 0) {
    writes.push(dbApi.setDoc(ref, putIn, { merge: true }));
  }
  await Promise.all(writes);
}

/** The account's links as this device last saw them, if it has a record for this account; null otherwise. */
function lastSeenLinks(userId) {
  try {
    const saved = JSON.parse(loadText(LINKS_LAST_SEEN_KEY) ?? "null");
    return saved?.userId === userId ? visibleLinks(saved.links) : null;
  } catch {
    return null;
  }
}

/**
 * Whether to use the local emulators: only on this computer's own address, and only when a test turned it on, so the
 * published app always uses the real project.
 */
function usesEmulators() {
  return ["localhost", "127.0.0.1"].includes(location.hostname) && loadText(EMULATOR_KEY) === "on";
}

/** Loads Firebase once and starts following who is signed in. */
function connect() {
  connecting ??= (async () => {
    const [app, auth, firestore] = await Promise.all([
      import(`${FIREBASE_URL}/firebase-app.js`),
      import(`${FIREBASE_URL}/firebase-auth.js`),
      import(`${FIREBASE_URL}/firebase-firestore.js`),
    ]);
    const emulators = usesEmulators();
    const firebaseApp = app.initializeApp(emulators ? EMULATOR_CONFIG : firebaseConfig);
    firebase = {
      auth: auth.getAuth(firebaseApp),
      authApi: auth,
      // Keeps a copy in the browser, so the list opens offline and changes made offline are sent later.
      db: firestore.initializeFirestore(firebaseApp, {
        localCache: firestore.persistentLocalCache({ tabManager: firestore.persistentMultipleTabManager() }),
      }),
      dbApi: firestore,
    };
    if (emulators) {
      auth.connectAuthEmulator(firebase.auth, "http://127.0.0.1:9099", { disableWarnings: true });
      firestore.connectFirestoreEmulator(firebase.db, "127.0.0.1", 8085);
    }
    auth.onAuthStateChanged(firebase.auth, (user) => handleUser(user).catch(handleSyncError));
  })();
  connecting.catch(() => {
    connecting = null;
  });
  return connecting;
}

async function signIn() {
  try {
    await connect();
  } catch {
    showToast(t("msg.signin_unreachable"));
    return;
  }
  const { authApi, auth } = firebase;
  try {
    await authApi.signInWithPopup(auth, new authApi.GoogleAuthProvider());
  } catch (error) {
    if (error.code === "auth/popup-blocked") {
      showToast(t("msg.signin_blocked"));
    } else if (error.code !== "auth/popup-closed-by-user" && error.code !== "auth/cancelled-popup-request") {
      showToast(t("msg.signin_failed", { code: error.code ?? error.message }));
    }
  }
}

async function handleSignOut() {
  generation += 1;
  stopSyncing();
  removeChoice(SYNCED_ACCOUNT_KEY);
  showAccount({ signedIn: false });
  if (firebase) {
    await firebase.authApi.signOut(firebase.auth);
  }
  showToast(t("msg.signed_out"));
}

async function handleUser(user) {
  if (!user) {
    generation += 1;
    stopSyncing();
    // Signed out somewhere else, or the sign-in expired: go back to saving on this device only.
    removeChoice(SYNCED_ACCOUNT_KEY);
    showAccount({ signedIn: false });
    return;
  }
  if (sync?.userId === user.uid || (merging?.uid === user.uid && merging.generation === generation)) {
    return;
  }
  stopSyncing();
  generation += 1;
  const mine = { uid: user.uid, generation };
  merging = mine;
  try {
    await startSyncing(user, mine.generation);
  } finally {
    if (merging === mine) {
      merging = null;
    }
  }
}

/** Thrown to stop a merge whose person is no longer the one signed in. */
class SyncCancelled extends Error {}

/** Stops a merge (by throwing SyncCancelled) if someone signed out or another account signed in since it began. */
function stillCurrent(startedIn) {
  if (startedIn !== generation) {
    throw new SyncCancelled();
  }
}

/** Merges this device's list with the account's, then listens for changes from either side. */
async function startSyncing(user, startedIn) {
  showAccount({ status: t("sync.syncing"), signedIn: true });
  const { dbApi, db } = firebase;
  const assignmentsRef = dbApi.collection(db, "users", user.uid, "assignments");
  const linksRef = dbApi.doc(db, "users", user.uid, "settings", "courseLinks");

  const firstTime = loadText(SYNCED_ACCOUNT_KEY) !== user.uid;
  const { addedCount, switchedFrom, account } = await mergeIntoAccount(user, assignmentsRef, firstTime, startedIn);
  stillCurrent(startedIn);
  if (firstTime) {
    // Course links too: the account's, plus any this device has that the account doesn't.
    try {
      const linksSnapshot = await dbApi.getDocFromServer(linksRef);
      stillCurrent(startedIn);
      const accountLinks = visibleLinks(linksSnapshot.data()?.links, linksSnapshot.data()?.removed);
      // Joined, not compared: this device's links are added, and a link deleted in the account stays deleted.
      const { links, changes } = joinLinks(state.courseLinks, accountLinks, linksSnapshot.data()?.removed ?? []);
      await writeLinkChanges(user.uid, changes);
      stillCurrent(startedIn);
      removeChoice(LINKS_PENDING_KEY);
      state.courseLinks = links;
    } catch (error) {
      if (error instanceof SyncCancelled) {
        throw error;
      }
      handleLinksError(error);
    }
    stillCurrent(startedIn);
    saveChoice(SYNCED_ACCOUNT_KEY, user.uid);
    showToast(
      switchedFrom
        ? t("msg.signed_in_set_aside")
        : addedCount > 0
          ? t("msg.signed_in_added", { count: countAssignments(addedCount) })
          : t("msg.signed_in"),
    );
  }

  const lastSeen = lastSeenLinks(user.uid);
  if ((loadText(LINKS_PENDING_KEY) || loadText(LINKS_UNCONFIRMED_KEY)) && lastSeen !== null) {
    // Changed here while sync wasn't running: send what changed since the account's links as last seen here. (With
    // no record, the account's links are joined instead when they arrive; see showRemoteLinks.)
    removeChoice(LINKS_PENDING_KEY);
    saveChoice(LINKS_UNCONFIRMED_KEY, "yes");
    writeLinkChanges(user.uid, linkChanges(lastSeen, state.courseLinks)).catch(handleLinksError);
  }

  // The account holds what the merge sent; anything changed here since (say, during the course links step) is sent now.
  sync = { userId: user.uid, remoteList: account ?? [...state.assignments, ...state.deleted], remoteLinks: null, stop: null, stopLinks: null };
  syncAssignments([...state.assignments, ...state.deleted]);
  sync.stop = dbApi.onSnapshot(
    assignmentsRef,
    { includeMetadataChanges: true },
    (snapshot) => showRemoteList(user, snapshot),
    handleSyncError,
  );
  sync.stopLinks = dbApi.onSnapshot(linksRef, { includeMetadataChanges: true }, (snapshot) => showRemoteLinks(user, snapshot), handleLinksError);
}

/**
 * Combines this device's list with the account's before listening, so nothing saved here while sync wasn't running
 * (the Connecting… moment, "offline copy", or signed out) is replaced by the account's older list. The rules are in
 * src/sync.js: changes made only here go to the account, deletions travel as Recently deleted, something missing
 * here is never deleted, and a list that belongs to another account is set aside, not copied (signInPlan).
 * Returns { addedCount, switchedFrom, account }, where account is the list sent to the account (null if not merged).
 */
async function mergeIntoAccount(user, assignmentsRef, firstTime, startedIn) {
  const { dbApi } = firebase;
  if (!state.storageReadable) {
    // This device's saved list couldn't be read, so it isn't merged: the account's list is shown as it is.
    return { addedCount: 0, switchedFrom: null, account: null };
  }
  // Recently deleted ones are merged too, so a deletion here or there isn't undone by the other copy.
  const plan = signInPlan([...state.assignments, ...state.deleted], state.courseLinks, loadSavedList(), loadSetAside(), user.uid);
  if (plan.switchedFrom) {
    // Before anything is read or sent: set the other account's list and links aside and take them off this device,
    // so even a sign-in that stops part-way can't copy them into this account.
    saveChoice(SET_ASIDE_KEY, JSON.stringify(plan.setAside));
    // This device's (now empty) list belongs to this account from here on, even if the rest of the sign-in fails,
    // so a later sign-in by someone else sets aside anything added here instead of copying it.
    saveChoice(LAST_SYNCED_KEY, JSON.stringify({ userId: user.uid, assignments: [] }));
    removeChoice(LINKS_PENDING_KEY);
    removeChoice(LINKS_UNCONFIRMED_KEY);
    removeChoice(LINKS_LAST_SEEN_KEY);
    const { live, deleted } = splitDeleted(plan.local);
    updateDeleted(live, deleted);
    applyCourseLinks(plan.links);
  }
  if (!firstTime && !plan.lastSynced) {
    // Reconnecting with no record of the account to compare against: show the account's list, as before.
    return { addedCount: 0, switchedFrom: null, account: null };
  }
  const liveBefore = state.assignments;
  const deletedBefore = state.deleted;
  let remote;
  try {
    // From the server, not the offline copy, since an out-of-date account list would make deletions on another
    // device look like additions here on a first merge.
    remote = completeAssignments((await dbApi.getDocsFromServer(assignmentsRef)).docs.map((d) => fromRemote(d.data(), d.id)));
    if (!firstTime) {
      saveChoice(LAST_SYNCED_KEY, JSON.stringify({ userId: user.uid, assignments: remote }));
    }
  } catch (error) {
    // A first sign-in needs the account itself; a reconnect can use the saved copy.
    if (firstTime || !plan.lastSynced) {
      throw error;
    }
    // Offline on a device that has synced before: Firebase's saved copy of the account will do, and the uploads
    // wait until the connection is back.
    remote = completeAssignments((await dbApi.getDocsFromCache(assignmentsRef)).docs.map((d) => fromRemote(d.data(), d.id)));
  }
  stillCurrent(startedIn);
  let { assignments, addedCount } = plan.lastSynced ? mergeWithLastSynced(plan.local, remote, plan.lastSynced) : mergeLists(plan.local, remote);
  const writing = sendChanges(user.uid, remote, assignments);
  if (firstTime) {
    await writing;
    stillCurrent(startedIn);
    // Only now, with the account confirmed to hold the merged list, is it this device's record of the account.
    saveChoice(LAST_SYNCED_KEY, JSON.stringify({ userId: user.uid, assignments }));
  } else {
    // Reconnecting, maybe offline: don't wait for the server; Firebase sends these when it can.
    writing.catch(handleSyncError);
  }
  if (state.assignments !== liveBefore || state.deleted !== deletedBefore) {
    // Changed here while the account was being read or written: merge that in, compared with the list from before,
    // so an item the account gained meanwhile isn't mistaken for one deleted here.
    const account = assignments;
    ({ assignments } = mergeWithLastSynced([...state.assignments, ...state.deleted], account, plan.local));
    sendChanges(user.uid, account, assignments).catch(handleSyncError);
  }
  saveChoice(SET_ASIDE_KEY, JSON.stringify(plan.setAside));
  ({ live: state.assignments, deleted: state.deleted } = splitDeleted(assignments));
  return { addedCount, switchedFrom: plan.switchedFrom, account: assignments };
}

/** Writes what turns `before` into `after` in the account. Offline, Firebase keeps the writes and sends them later. */
function sendChanges(userId, before, after) {
  const { saves, deletes } = listChanges(before, after);
  return writeChanges(userId, before, saves, deletes);
}

/** The account's course links changed (here or on another device): show them. */
function showRemoteLinks(user, snapshot) {
  // Only what the server has confirmed counts as the account's links as last seen, not changes still on their way.
  const confirmed = !snapshot.metadata.hasPendingWrites && !snapshot.metadata.fromCache;
  if (!snapshot.exists()) {
    if (!confirmed) {
      // Missing from the offline copy says nothing about the account: wait for the server.
      return;
    }
    // No links in the account yet (and so no deletions recorded): that's a record too, of an empty list. Start it with
    // this device's links.
    removeChoice(LINKS_PENDING_KEY);
    sync.remoteLinks = [];
    saveChoice(LINKS_LAST_SEEN_KEY, JSON.stringify({ userId: user.uid, links: [] }));
    if (state.courseLinks.length > 0) {
      sync.remoteLinks = state.courseLinks;
      writeLinkChanges(user.uid, linkChanges([], state.courseLinks)).catch(handleLinksError);
    }
    return;
  }
  const links = visibleLinks(snapshot.data().links, snapshot.data().removed);
  if (confirmed) {
    saveChoice(LINKS_LAST_SEEN_KEY, JSON.stringify({ userId: user.uid, links }));
    removeChoice(LINKS_UNCONFIRMED_KEY);
  }
  if (loadText(LINKS_PENDING_KEY)) {
    // Changed here with no record of the account's links (say, right after updating to this version): join them,
    // adding this device's and keeping every deletion the account has recorded.
    removeChoice(LINKS_PENDING_KEY);
    const joined = joinLinks(state.courseLinks, links, snapshot.data().removed ?? []);
    writeLinkChanges(user.uid, joined.changes).catch(handleLinksError);
    sync.remoteLinks = joined.links;
    applyCourseLinks(joined.links);
    return;
  }
  sync.remoteLinks = links;
  applyCourseLinks(links);
}

/** The account's list changed (here or on another device): show it, and keep this device's copy up to date. */
function showRemoteList(user, snapshot) {
  // Leaves out a half-written assignment (see completeAssignments), which would have no title or date to show.
  const remote = completeAssignments(snapshot.docs.map((d) => fromRemote(d.data(), d.id)));
  sync.remoteList = remote;
  // Finished work with a timer still running (started on one device while another marked it done) is set right here.
  const settled = remote.map(settleFinishedTimer);
  ({ live: state.assignments, deleted: state.deleted } = splitDeleted(settled));
  // While the saved list can't be read, it's left alone until Start over, as the app promises (see persist).
  if (state.storageReadable) {
    saveAssignments(localStorage, settled);
  }
  if (settled.some((assignment, index) => assignment !== remote[index])) {
    syncAssignments(settled);
  }
  // Only a list Firebase has confirmed counts as "the account as last seen", not one with uploads pending.
  if (!snapshot.metadata.hasPendingWrites && !snapshot.metadata.fromCache) {
    saveChoice(LAST_SYNCED_KEY, JSON.stringify({ userId: user.uid, assignments: remote }));
  }
  const status = snapshot.metadata.hasPendingWrites
    ? t("sync.saving")
    : snapshot.metadata.fromCache
      ? t("sync.offline_later")
      : t("sync.synced");
  showAccount({ status, email: user.email, signedIn: true });
  render();
}

/** The account's list as last seen confirmed on this device, { userId, assignments }, or null. */
function loadSavedList() {
  try {
    const saved = JSON.parse(loadText(LAST_SYNCED_KEY) ?? "null");
    return typeof saved?.userId === "string" && Array.isArray(saved.assignments) ? saved : null;
  } catch {
    return null;
  }
}

/** What's set aside for other accounts (see SET_ASIDE_KEY), or nothing if what's saved can't be read. */
function loadSetAside() {
  try {
    const saved = JSON.parse(loadText(SET_ASIDE_KEY) ?? "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

/**
 * Sends saves and deletions to the account. A new assignment is written whole; a changed one sends only the fields
 * that changed since `before` (the account as this device last had it), so a late save from another device can't undo
 * what this one didn't touch, such as a deletion made there. Each is its own write, so one the database refuses
 * doesn't cancel the others.
 */
async function writeChanges(userId, before, saves, deletes) {
  const { dbApi, db } = firebase;
  const beforeById = new Map(before.map((a) => [a.id, a]));
  const ref = (id) => dbApi.doc(db, "users", userId, "assignments", id);
  const writes = saves.map((a) => {
    const changes = fieldChanges(beforeById.get(a.id), a);
    if (!changes) {
      return dbApi.setDoc(ref(a.id), toRemote(a));
    }
    const removed = Object.fromEntries(changes.removed.map((key) => [key, dbApi.deleteField()]));
    const update = { ...changes.changed, ...removed };
    if (changes.removedTicks) {
      // Steps renamed or removed: their entries come out of the map of ticks, leaving the other entries alone.
      update.stepTicks = { ...changes.changed.stepTicks, ...Object.fromEntries(changes.removedTicks.map((text) => [text, dbApi.deleteField()])) };
    }
    return dbApi.setDoc(ref(a.id), update, { merge: true });
  });
  writes.push(...deletes.map((id) => dbApi.deleteDoc(ref(id))));
  await Promise.all(writes);
}

function stopSyncing() {
  sync?.stop?.();
  sync?.stopLinks?.();
  sync = null;
}

function handleSyncError(error) {
  if (error instanceof SyncCancelled) {
    // Someone signed out, or another account signed in, while this sync was running: nothing went wrong.
    return;
  }
  console.error("Sync failed:", error.code ?? error.message);
  showAccount({ status: t("sync.failed"), signedIn: true });
  showToast(t("msg.sync_failed", { code: error.code ?? error.message }));
}

/** Course links failing to sync leaves the assignments syncing; the links stay saved on this device. */
function handleLinksError(error) {
  console.error("Course links sync failed:", error.code ?? error.message);
  showToast(t("msg.links_sync_failed", { code: error.code ?? error.message }));
}

/** Shows the sign-in button, or who is signed in and whether the list is synced. */
function showAccount({ signedIn, status = "", email = "" }) {
  elements.signIn.hidden = signedIn !== false;
  // What signing in does goes with the button, so it's gone once signed in.
  elements.signInHint.hidden = elements.signIn.hidden;
  elements.signOut.hidden = signedIn !== true;
  elements.accountStatus.textContent = email ? `${status} · ${email}` : status;
  elements.accountStatus.hidden = status === "";
}
