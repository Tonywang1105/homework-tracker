// Signing in with Google and syncing the list with the account through Firebase, so the laptop and the
// phone show the same assignments. Signed out, the app works as before, with the list saved on this device only.
// Firebase is downloaded only when someone signs in, so people who never sign in don't load it at all.

import { firebaseConfig } from "../firebase-config.js?v=ee7cd01c";
import { render } from "../main.js?v=ee7cd01c";
import { saveAssignments } from "../storage.js?v=ee7cd01c";
import { listChanges, mergeLists, mergeWithLastSynced, toRemote } from "../sync.js?v=ee7cd01c";
import { elements } from "./dom.js?v=ee7cd01c";
import { loadText, removeChoice, saveChoice, state } from "./store.js?v=ee7cd01c";
import { showToast } from "./toast.js?v=ee7cd01c";

const FIREBASE_URL = "https://www.gstatic.com/firebasejs/12.4.0";
// The id of the account this device's list was merged into, kept so the merge happens only once per device.
// Later starts trust the account, so something deleted on the phone doesn't come back from the laptop's copy.
const SYNCED_ACCOUNT_KEY = "homework-tracker.syncedAccount";
// The account's list as this device last saw it confirmed by Firebase, with whose account it was, as
// { userId, assignments }. Kept after signing out, so signing back in can tell "deleted on the phone"
// apart from "added here while signed out" (see mergeWithLastSynced).
const LAST_SYNCED_KEY = "homework-tracker.lastSynced";
// Firestore takes at most 500 writes at once.
const MAX_WRITES_PER_BATCH = 400;

let firebase = null;
let connecting = null;
// While syncing: the signed-in user's id, the list as the account last had it, and how to stop listening.
let sync = null;

/** Wires up the sign-in buttons, and reconnects straight away if this device was signed in last time. */
export function startAccount() {
  elements.signIn.addEventListener("click", signIn);
  elements.signOut.addEventListener("click", handleSignOut);
  // Fetch Firebase as soon as someone looks like they're about to sign in, because browsers only let
  // the Google window open if it opens quickly after the click.
  for (const eventName of ["pointerenter", "focus", "touchstart"]) {
    elements.signIn.addEventListener(eventName, () => connect().catch(() => {}), { once: true, passive: true });
  }
  if (loadText(SYNCED_ACCOUNT_KEY)) {
    showAccount({ status: "Connecting…" });
    connect().catch(() => showAccount({ status: "Offline: showing this device's copy", signedIn: true }));
  } else {
    showAccount({ signedIn: false });
  }
}

/** Sends the list to the account after the app saves it. Does nothing while signed out. */
export function syncAssignments(assignments) {
  if (!sync) {
    return;
  }
  const { saves, deletes } = listChanges(sync.remoteList, assignments);
  sync.remoteList = assignments;
  writeChanges(sync.userId, saves, deletes).catch(handleSyncError);
}

/** Loads Firebase once and starts following who is signed in. */
function connect() {
  connecting ??= (async () => {
    const [app, auth, firestore] = await Promise.all([
      import(`${FIREBASE_URL}/firebase-app.js`),
      import(`${FIREBASE_URL}/firebase-auth.js`),
      import(`${FIREBASE_URL}/firebase-firestore.js`),
    ]);
    const firebaseApp = app.initializeApp(firebaseConfig);
    firebase = {
      auth: auth.getAuth(firebaseApp),
      authApi: auth,
      // Keeps a copy in the browser, so the list opens offline and changes made offline are sent later.
      db: firestore.initializeFirestore(firebaseApp, {
        localCache: firestore.persistentLocalCache({ tabManager: firestore.persistentMultipleTabManager() }),
      }),
      dbApi: firestore,
    };
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
    showToast("Couldn't reach Google to sign in. Check your internet connection and try again.");
    return;
  }
  const { authApi, auth } = firebase;
  try {
    await authApi.signInWithPopup(auth, new authApi.GoogleAuthProvider());
  } catch (error) {
    if (error.code === "auth/popup-blocked") {
      showToast("Your browser blocked the Google sign-in window. Click Sign in again.");
    } else if (error.code !== "auth/popup-closed-by-user" && error.code !== "auth/cancelled-popup-request") {
      showToast(`Couldn't sign in (${error.code ?? error.message}).`);
    }
  }
}

async function handleSignOut() {
  stopSyncing();
  removeChoice(SYNCED_ACCOUNT_KEY);
  showAccount({ signedIn: false });
  if (firebase) {
    await firebase.authApi.signOut(firebase.auth);
  }
  showToast("Signed out. Your list stays on this device, but changes won't sync until you sign in again.");
}

async function handleUser(user) {
  if (!user) {
    stopSyncing();
    // Signed out somewhere else, or the sign-in expired: go back to saving on this device only.
    removeChoice(SYNCED_ACCOUNT_KEY);
    showAccount({ signedIn: false });
    return;
  }
  if (sync?.userId === user.uid) {
    return;
  }
  stopSyncing();
  showAccount({ status: "Syncing…", signedIn: true });
  const { dbApi, db } = firebase;
  const assignmentsRef = dbApi.collection(db, "users", user.uid, "assignments");

  if (loadText(SYNCED_ACCOUNT_KEY) !== user.uid) {
    // Signing in on this device: combine its list with the account's. From the server, not the offline
    // copy, since an out-of-date account list would make deletions look like additions.
    const snapshot = await dbApi.getDocsFromServer(assignmentsRef);
    const remote = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
    const lastSynced = loadLastSynced(user.uid);
    const { assignments, addedCount } = lastSynced
      ? mergeWithLastSynced(state.assignments, remote, lastSynced)
      : mergeLists(state.assignments, remote);
    const { saves, deletes } = listChanges(remote, assignments);
    await writeChanges(user.uid, saves, deletes);
    state.assignments = assignments;
    saveChoice(SYNCED_ACCOUNT_KEY, user.uid);
    showToast(
      addedCount > 0
        ? `Signed in. Added ${addedCount} assignment${addedCount === 1 ? "" : "s"} from this device to your account.`
        : "Signed in. Your list now syncs with your account.",
    );
  }

  sync = { userId: user.uid, remoteList: state.assignments, stop: null };
  sync.stop = dbApi.onSnapshot(
    assignmentsRef,
    { includeMetadataChanges: true },
    (snapshot) => showRemoteList(user, snapshot),
    handleSyncError,
  );
}

/** The account's list changed (here or on another device): show it, and keep this device's copy up to date. */
function showRemoteList(user, snapshot) {
  const remote = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
  sync.remoteList = remote;
  state.assignments = remote;
  saveAssignments(localStorage, remote);
  // Only a list Firebase has confirmed counts as "the account as last seen", not one with uploads pending.
  if (!snapshot.metadata.hasPendingWrites && !snapshot.metadata.fromCache) {
    saveChoice(LAST_SYNCED_KEY, JSON.stringify({ userId: user.uid, assignments: remote }));
  }
  const status = snapshot.metadata.hasPendingWrites
    ? "Saving…"
    : snapshot.metadata.fromCache
      ? "Offline: changes will sync later"
      : "Synced";
  showAccount({ status, email: user.email, signedIn: true });
  render();
}

/** The account's list as last seen on this device, if it was this account's; null otherwise. */
function loadLastSynced(userId) {
  try {
    const saved = JSON.parse(loadText(LAST_SYNCED_KEY) ?? "null");
    return saved?.userId === userId && Array.isArray(saved.assignments) ? saved.assignments : null;
  } catch {
    return null;
  }
}

async function writeChanges(userId, saves, deletes) {
  const { dbApi, db } = firebase;
  const writes = [
    ...saves.map((a) => (batch) => batch.set(dbApi.doc(db, "users", userId, "assignments", a.id), toRemote(a))),
    ...deletes.map((id) => (batch) => batch.delete(dbApi.doc(db, "users", userId, "assignments", id))),
  ];
  for (let start = 0; start < writes.length; start += MAX_WRITES_PER_BATCH) {
    const batch = dbApi.writeBatch(db);
    for (const write of writes.slice(start, start + MAX_WRITES_PER_BATCH)) {
      write(batch);
    }
    await batch.commit();
  }
}

function stopSyncing() {
  sync?.stop?.();
  sync = null;
}

function handleSyncError(error) {
  console.error("Sync failed:", error.code ?? error.message);
  showAccount({ status: "Sync failed: changes are saved on this device only", signedIn: true });
  showToast(`Couldn't sync with your account (${error.code ?? error.message}). Try reloading the page.`);
}

/** Shows the sign-in button, or who is signed in and whether the list is synced. */
function showAccount({ signedIn, status = "", email = "" }) {
  elements.signIn.hidden = signedIn !== false;
  elements.signOut.hidden = signedIn !== true;
  elements.accountStatus.textContent = email ? `${status} · ${email}` : status;
  elements.accountStatus.hidden = status === "";
}
