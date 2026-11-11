// Reminders on this device: while the app is open, a notification when unfinished work is due soon (src/reminders.js
// decides which). Turning it on asks the browser for permission; if it can't or won't, Settings says why.

import { describeDue } from "../assignments.js?v=51ea54e1";
import { t } from "../i18n.js?v=51ea54e1";
import { dueReminders, readSentReminders, reminderKey } from "../reminders.js?v=51ea54e1";
import { loadText, removeChoice, saveChoice, state } from "./store.js?v=51ea54e1";

const ON_KEY = "homework-tracker.reminders";
const SENT_KEY = "homework-tracker.remindersSent";
const CHECK_EVERY_MS = 30 * 1000;

const toggle = document.getElementById("reminders-on");
const status = document.getElementById("reminders-status");

export function startReminders() {
  toggle.checked = loadText(ON_KEY) === "on" && notificationsAllowed();
  showStatus(toggle.checked ? t("reminders.on") : "");
  toggle.addEventListener("change", handleToggle);
  setInterval(checkReminders, CHECK_EVERY_MS);
  checkReminders();
}

function notificationsAllowed() {
  return "Notification" in window && Notification.permission === "granted";
}

async function handleToggle() {
  if (!toggle.checked) {
    removeChoice(ON_KEY);
    showStatus("");
    return;
  }
  if (!("Notification" in window)) {
    toggle.checked = false;
    showStatus(t("reminders.unsupported"));
    return;
  }
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") {
    toggle.checked = false;
    showStatus(t("reminders.blocked"));
    return;
  }
  saveChoice(ON_KEY, "on");
  showStatus(t("reminders.on"));
  checkReminders();
}

function showStatus(text) {
  status.textContent = text;
  status.hidden = text === "";
}

/** Shows a notification for anything due soon that hasn't had one, and remembers it so it's shown once. */
export function checkReminders(now = new Date()) {
  if (!toggle.checked || !notificationsAllowed()) {
    return;
  }
  const sent = readSentReminders(loadText(SENT_KEY), now);
  for (const assignment of dueReminders(state.assignments, sent, now)) {
    const { text } = describeDue(assignment, now);
    notify(assignment.title, assignment.course ? `${text} · ${assignment.course}` : text, reminderKey(assignment));
    sent.add(reminderKey(assignment));
  }
  saveChoice(SENT_KEY, JSON.stringify([...sent]));
}

/**
 * A notification, from the page if the browser allows that, else from the service worker (phones only allow that
 * way, and sw.js then focuses the app when it's clicked).
 */
function notify(title, body, tag) {
  try {
    const notification = new Notification(title, { body, tag, icon: "icons/icon-192.png" });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    navigator.serviceWorker?.ready.then((registration) => registration.showNotification(title, { body, tag, icon: "icons/icon-192.png" }));
  }
}
