// The service worker: a small script the browser runs alongside the page, which keeps a copy of the
// app's files so the app opens with no internet, for example when it's installed on a phone's home screen.
//
// It is network-first: online, every file comes fresh from the site (so a new version is never held back),
// and each one is saved as it arrives. Only when the network fails, or takes too long, is the saved copy used.
// Copies are saved by path without the "?v=..." the publish script adds, so each file has one copy, the latest.

const CACHE_NAME = "homework-tracker";
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
  "src/examples.js",
  "src/export.js",
  "src/focus.js",
  "src/firebase-config.js",
  "src/layout.js",
  "src/links.js",
  "src/main.js",
  "src/plan.js",
  "src/quickadd.js",
  "src/repeat.js",
  "src/review.js",
  "src/shortcuts.js",
  "src/storage.js",
  "src/sync.js",
  "src/timer.js",
  "src/trash.js",
  "src/ui/account.js",
  "src/ui/agendaView.js",
  "src/ui/calendarDrag.js",
  "src/ui/calendarView.js",
  "src/ui/colorsPanel.js",
  "src/ui/coursePage.js",
  "src/ui/deletedPanel.js",
  "src/ui/dom.js",
  "src/ui/focus.js",
  "src/ui/form.js",
  "src/ui/guide.js",
  "src/ui/list.js",
  "src/ui/panels.js",
  "src/ui/quickAdd.js",
  "src/ui/reviewPanel.js",
  "src/ui/select.js",
  "src/ui/settings.js",
  "src/ui/shortcuts.js",
  "src/ui/store.js",
  "src/ui/toast.js",
  "src/ui/todayPlan.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES.map((path) => new Request(path, { cache: "reload" })))),
  );
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
  } else if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  }
  // Anything else (Google sign-in, the Firestore database) goes straight to the network as usual.
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const key = cacheKey(request);
  const network = fetch(request).then(async (response) => {
    if (response.ok) {
      await cache.put(key, response.clone());
    }
    return response;
  });
  try {
    return await withTimeout(network, NETWORK_TIMEOUT_MS);
  } catch {
    const saved = (await cache.match(key)) ?? (request.mode === "navigate" ? await cache.match(scopeUrl()) : undefined);
    if (saved) {
      // The network may still answer later; its copy is then saved for next time.
      network.catch(() => {});
      return saved;
    }
    // Nothing saved yet: keep waiting for the network (or report its error).
    return network;
  }
}

async function savedFirst(request) {
  const cache = await caches.open(CACHE_NAME);
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

/** The address a file is saved under: without "?v=...", so a new version replaces the old copy. */
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
