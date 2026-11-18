// The service worker: a small script the browser runs alongside the page, which keeps a copy of the
// app's files so the app opens with no internet, for example when it's installed on a phone's home screen.
//
// It is network-first: online, every file comes fresh from the site (so a new version is never held back). Only when
// the network fails, or takes too long, is a saved copy used, and never a copy from another version of the app. The
// publish script puts the version in every file's address ("src/main.js?v=86b9f91d"), and each version's files are
// saved together, in a cache of their own. A new version becomes the one the app opens offline only once all of its
// files are saved, so an update cut off part-way can't leave half of one version and half of another, which stops
// the app from starting (npm run test:update checks both cases). Older versions' caches are then removed.
// On this laptop (npm start) files carry no version, so they're saved by path as they arrive, in one cache.

// The cache for files without a version (the icons, the manifest, and everything when run locally); the earlier
// worker kept every file here, so its copies are still used if nothing newer is saved.
const UNVERSIONED_CACHE = "homework-tracker";
// Each version's files: "homework-tracker-v-86b9f91d".
const VERSION_CACHE_PREFIX = "homework-tracker-v-";
// Which version is saved completely, so it's the one opened offline.
const META_CACHE = "homework-tracker-meta";
const COMPLETE_VERSION_KEY = "complete-version";
// How long to wait for the network before using the saved copy, so a weak signal doesn't leave a blank screen.
const NETWORK_TIMEOUT_MS = 4000;
// Firebase's files never change at a given version number, so a saved copy can be used straight away.
const FIREBASE_PREFIX = "https://www.gstatic.com/firebasejs/";

// Everything the app needs to open, saved when the service worker is first installed.
// tests/offline.test.js checks this list against the files in index.html, styles/ and src/.
const APP_FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "styles/base.css",
  "styles/agenda.css",
  "styles/calendar.css",
  "styles/form.css",
  "styles/list.css",
  "styles/messages.css",
  "styles/panels.css",
  "styles/types.css",
  "src/assignments.js",
  "src/backup.js",
  "src/calendar.js",
  "src/canvas.js",
  "src/courseColors.js",
  "src/courseLinks.js",
  "src/estimates.js",
  "src/examples.js",
  "src/export.js",
  "src/focus.js",
  "src/gradescope.js",
  "src/i18n.js",
  "src/lessons.js",
  "src/firebase-config.js",
  "src/layout.js",
  "src/links.js",
  "src/main.js",
  "src/paste.js",
  "src/plan.js",
  "src/progress.js",
  "src/prairielearn.js",
  "src/quickadd.js",
  "src/reminders.js",
  "src/repeat.js",
  "src/review.js",
  "src/semester.js",
  "src/shortcuts.js",
  "src/storage.js",
  "src/sync.js",
  "src/timer.js",
  "src/trash.js",
  "src/version.js",
  "src/whatsNew.js",
  "src/ui/account.js",
  "src/ui/agendaView.js",
  "src/ui/calendarDrag.js",
  "src/ui/calendarView.js",
  "src/ui/canvasMovedBanner.js",
  "src/ui/colorsPanel.js",
  "src/ui/copyWeek.js",
  "src/ui/coursePage.js",
  "src/ui/deletedPanel.js",
  "src/ui/dom.js",
  "src/ui/focus.js",
  "src/ui/form.js",
  "src/ui/guide.js",
  "src/ui/keepFocus.js",
  "src/ui/language.js",
  "src/ui/lessonBar.js",
  "src/ui/list.js",
  "src/ui/panels.js",
  "src/ui/pastePanel.js",
  "src/ui/phoneFolds.js",
  "src/ui/quickAdd.js",
  "src/ui/reminders.js",
  "src/ui/reviewPanel.js",
  "src/ui/select.js",
  "src/ui/settings.js",
  "src/ui/shortcuts.js",
  "src/ui/store.js",
  "src/ui/toast.js",
  "src/ui/todayPlan.js",
  "src/ui/weekBanner.js",
  "src/ui/weekdayHours.js",
  "src/ui/whatsNewBanner.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(saveCurrentSite());
  self.skipWaiting();
});

// Take charge of the page that's already open, so the files it loads next (such as Firebase) are saved too.
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.href.startsWith(FIREBASE_PREFIX)) {
    event.respondWith(savedFirst(request));
  } else if (url.origin !== self.location.origin) {
    // Anything else (Google sign-in, the Firestore database) goes straight to the network as usual.
    return;
  } else if (request.mode === "navigate") {
    event.respondWith(openPage(request, event));
  } else if (url.searchParams.has("v")) {
    event.respondWith(versionedFile(request, url.searchParams.get("v")));
  } else {
    event.respondWith(unversionedFile(request));
  }
});

/** On install: saves every file of the version the site serves now (or, run locally, every file as it is). */
async function saveCurrentSite() {
  const response = await fetch(scopeUrl(), { cache: "no-cache" });
  const version = versionInPage(await response.text());
  if (version) {
    await saveVersion(version);
  } else {
    const cache = await caches.open(UNVERSIONED_CACHE);
    await cache.addAll(APP_FILES.map((path) => new Request(path, { cache: "reload" })));
  }
}

/** The page: fresh if the network answers in time (then its version is saved in the background), else the saved one. */
async function openPage(request, event) {
  const network = fetch(request).then(async (response) => {
    if (response.ok) {
      const version = versionInPage(await response.clone().text());
      if (version) {
        event.waitUntil(saveVersion(version).catch(() => {}));
      } else {
        await (await caches.open(UNVERSIONED_CACHE)).put(cacheKey(request), response.clone());
      }
    }
    return response;
  });
  try {
    return await withTimeout(network, NETWORK_TIMEOUT_MS);
  } catch {
    const complete = await completeVersion();
    const saved = complete
      ? await (await caches.open(VERSION_CACHE_PREFIX + complete)).match(scopeUrl())
      : await (await caches.open(UNVERSIONED_CACHE)).match(scopeUrl());
    if (saved) {
      network.catch(() => {});
      return saved;
    }
    return network;
  }
}

/** A file of one version: fresh if the network answers in time, else that same version's saved copy, never another's. */
async function versionedFile(request, version) {
  const name = VERSION_CACHE_PREFIX + version;
  const network = fetch(request).then(async (response) => {
    if (response.ok) {
      await (await caches.open(name)).put(cacheKey(request), response.clone());
    }
    return response;
  });
  try {
    return await withTimeout(network, NETWORK_TIMEOUT_MS);
  } catch {
    const saved = (await caches.has(name)) ? await (await caches.open(name)).match(cacheKey(request)) : undefined;
    if (saved) {
      network.catch(() => {});
      return saved;
    }
    // No copy of this version: wait for the network rather than use another version's copy.
    return network;
  }
}

/** A file without a version (an icon, the manifest, or any file run locally): fresh if possible, else the saved one. */
async function unversionedFile(request) {
  const network = fetch(request).then(async (response) => {
    if (response.ok) {
      await (await caches.open(UNVERSIONED_CACHE)).put(cacheKey(request), response.clone());
    }
    return response;
  });
  try {
    return await withTimeout(network, NETWORK_TIMEOUT_MS);
  } catch {
    const complete = await completeVersion();
    const saved =
      (complete ? await (await caches.open(VERSION_CACHE_PREFIX + complete)).match(cacheKey(request)) : undefined) ??
      (await (await caches.open(UNVERSIONED_CACHE)).match(cacheKey(request)));
    if (saved) {
      network.catch(() => {});
      return saved;
    }
    return network;
  }
}

// Versions being saved right now, so a page opened twice doesn't save the same version twice at once.
const saving = new Map();

/**
 * Saves every file of `version` (those the page has already loaded are kept), then makes it the version opened
 * offline and removes older versions. If any file can't be fetched, nothing changes and the last complete version
 * stays; the next visit tries again.
 */
function saveVersion(version) {
  if (!saving.has(version)) {
    saving.set(version, saveAllFiles(version).finally(() => saving.delete(version)));
  }
  return saving.get(version);
}

async function saveAllFiles(version) {
  if ((await completeVersion()) === version) {
    return;
  }
  const cache = await caches.open(VERSION_CACHE_PREFIX + version);
  for (const path of APP_FILES) {
    const url = new URL(path, self.registration.scope);
    // The publish script stamps the scripts and stylesheets; the page, icons and manifest have no version.
    if (path.startsWith("src/") || path.startsWith("styles/")) {
      url.searchParams.set("v", version);
    }
    const key = cacheKey(new Request(url));
    if (await cache.match(key)) {
      continue;
    }
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Couldn't save ${path}.`);
    }
    // The site may have moved on to a newer version meanwhile; then this one is never completed.
    if ((path === "./" || path === "index.html") && versionInPage(await response.clone().text()) !== version) {
      throw new Error(`The site no longer serves version ${version}.`);
    }
    await cache.put(key, response);
  }
  await (await caches.open(META_CACHE)).put(COMPLETE_VERSION_KEY, new Response(version));
  for (const name of await caches.keys()) {
    if (name.startsWith(VERSION_CACHE_PREFIX) && name !== VERSION_CACHE_PREFIX + version && !saving.has(name.slice(VERSION_CACHE_PREFIX.length))) {
      await caches.delete(name);
    }
  }
}

/** The version saved completely, or null if none is yet. */
async function completeVersion() {
  const saved = await (await caches.open(META_CACHE)).match(COMPLETE_VERSION_KEY);
  return saved ? saved.text() : null;
}

/** The version the publish script stamped on a page's main script, or null for an unpublished (local) copy. */
function versionInPage(html) {
  return html.match(/src\/main\.js\?v=([\w-]+)/)?.[1] ?? null;
}

async function savedFirst(request) {
  const cache = await caches.open(UNVERSIONED_CACHE);
  const saved = await cache.match(request);
  if (saved) {
    return saved;
  }
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

/** The address a file is saved under, without "?v=..." (each version's files have a cache of their own). */
function cacheKey(request) {
  const url = new URL(request.url);
  url.search = "";
  return url.href;
}

function scopeUrl() {
  return new URL("./", self.registration.scope).href;
}

function withTimeout(promise, milliseconds) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The network took too long.")), milliseconds);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// A reminder's notification was clicked (src/ui/reminders.js): show the app, opening it if it isn't open.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.registration.scope));
      return open ? open.focus() : self.clients.openWindow(self.registration.scope);
    }),
  );
});
