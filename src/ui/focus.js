// Focus blocks on this device: the timer runs in blocks of work (25 minutes unless changed) with a break after
// each. When a block ends it chimes, the focus bar offers the break or Keep going, and the tab's title shows the
// time left. The rules are in src/focus.js; the time spent still syncs like any other timer.

import {
  blockSecondsLeft,
  endBlock,
  parseBreakMinutes,
  parseFocusBreak,
  parseFocusSettings,
  parseWorkMinutes,
} from "../focus.js?v=78dcb73d";
import { render } from "../main.js?v=78dcb73d";
import { formatClock, startTimer } from "../timer.js?v=78dcb73d";
import { findAssignment, loadText, removeChoice, saveChoice, state, updateAssignments } from "./store.js?v=78dcb73d";
import { showToast } from "./toast.js?v=78dcb73d";

const FOCUS_KEY = "homework-tracker.focus";
const BREAK_KEY = "homework-tracker.focusBreak";
// A block or break that ended more than this long ago happened while the app was closed, so it gets no chime.
const CHIME_WINDOW_MS = 5000;
const pageTitle = document.title;

const focusElements = {
  settings: document.getElementById("focus-settings"),
  on: document.getElementById("focus-on"),
  lengths: document.getElementById("focus-lengths"),
  work: document.getElementById("focus-work"),
  breakMinutes: document.getElementById("focus-break"),
  bar: document.getElementById("focus-bar"),
  barText: document.getElementById("focus-bar-text"),
  barAction: document.getElementById("focus-bar-action"),
  barDismiss: document.getElementById("focus-bar-dismiss"),
};
let audio = null;

export function startFocus() {
  state.focus = parseFocusSettings(loadText(FOCUS_KEY));
  state.focusBreak = parseFocusBreak(loadText(BREAK_KEY));
  focusElements.on.checked = state.focus.on;
  focusElements.work.value = state.focus.workMinutes;
  focusElements.breakMinutes.value = state.focus.breakMinutes;
  focusElements.lengths.hidden = !state.focus.on;
  focusElements.on.addEventListener("change", () => saveFocus({ on: focusElements.on.checked }));
  focusElements.work.addEventListener("change", () => changeLength(focusElements.work, parseWorkMinutes, "workMinutes", "A block can be 1 to 120 minutes."));
  focusElements.breakMinutes.addEventListener("change", () =>
    changeLength(focusElements.breakMinutes, parseBreakMinutes, "breakMinutes", "A break can be 1 to 60 minutes."),
  );
  focusElements.barAction.addEventListener("click", startNextBlock);
  focusElements.barDismiss.addEventListener("click", () => setBreak(null));
}

function saveFocus(changes) {
  state.focus = { ...state.focus, ...changes };
  saveChoice(FOCUS_KEY, JSON.stringify(state.focus));
  focusElements.lengths.hidden = !state.focus.on;
  if (!state.focus.on) {
    setBreak(null);
  }
  // A running timer's tag switches between "Working…" and "Focus … left".
  render();
}

function changeLength(input, parse, key, problem) {
  const minutes = parse(input.value);
  if (minutes === null) {
    input.value = state.focus[key];
    showToast(problem);
    return;
  }
  saveFocus({ [key]: minutes });
}

function setBreak(focusBreak) {
  state.focusBreak = focusBreak;
  if (focusBreak) {
    saveChoice(BREAK_KEY, JSON.stringify(focusBreak));
  } else {
    removeChoice(BREAK_KEY);
  }
  renderFocus();
}

/** Called on Start (a click), because browsers only let a page play sound once someone has interacted with it. */
export function primeChime() {
  try {
    audio ??= new AudioContext();
    audio.resume();
  } catch {
    // No sound in this browser: the focus bar and the title still say when a block ends.
  }
}

/** Two soft notes, made by the browser rather than loaded from a file. */
function chime() {
  if (!audio) {
    return;
  }
  for (const [frequency, delay] of [
    [880, 0],
    [1320, 0.18],
  ]) {
    const tone = audio.createOscillator();
    const volume = audio.createGain();
    const at = audio.currentTime + delay;
    tone.frequency.value = frequency;
    volume.gain.setValueAtTime(0.0001, at);
    volume.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
    tone.connect(volume).connect(audio.destination);
    tone.start(at);
    tone.stop(at + 0.65);
  }
}

/** Every second: ends a finished block, notices a finished break, and updates the focus bar and the tab's title. */
export function tickFocus(now = new Date()) {
  const running = state.assignments.find((a) => a.timerStartedAt);
  if (running && state.focusBreak) {
    // A timer started again (here or on another device), so the break is over.
    setBreak(null);
    return;
  }
  if (state.focus.on && running && blockSecondsLeft(running, state.focus, now) <= 0) {
    const { assignments, focusBreak } = endBlock(state.assignments, running, state.focus);
    updateAssignments(assignments);
    if (now - new Date(focusBreak.endedAt) < CHIME_WINDOW_MS) {
      chime();
    }
    setBreak(focusBreak);
    return;
  }
  const breakEnds = state.focusBreak ? new Date(state.focusBreak.endsAt) : null;
  if (breakEnds && now >= breakEnds && !state.focusBreak.chimed) {
    if (now - breakEnds < CHIME_WINDOW_MS) {
      chime();
    }
    setBreak({ ...state.focusBreak, chimed: true });
    return;
  }
  renderFocus(now);
}

/**
 * Shows the settings, the focus bar and the tab's title, without changing anything, so the list's redraw can call
 * it; only tickFocus (every second) ends blocks, since that saves and redraws the list itself.
 */
export function renderFocus(now = new Date()) {
  focusElements.settings.hidden = state.assignments.length === 0 || state.view !== "list";
  const running = state.assignments.find((a) => a.timerStartedAt);
  const focusBreak = state.focusBreak;
  focusElements.bar.hidden = focusBreak === null;
  if (focusBreak) {
    const secondsLeft = Math.ceil((new Date(focusBreak.endsAt) - now) / 1000);
    const minutes = Math.round((new Date(focusBreak.endsAt) - new Date(focusBreak.endedAt)) / 60000);
    if (secondsLeft > 0) {
      focusElements.barText.textContent = `Block done on "${focusBreak.title}". Take a ${minutes}-minute break: ${formatClock(secondsLeft)} left.`;
      focusElements.barAction.textContent = "Keep going";
      focusElements.barDismiss.textContent = "End focus";
    } else {
      focusElements.barText.textContent = `Break's over. Ready for the next block on "${focusBreak.title}"?`;
      focusElements.barAction.textContent = "Start next block";
      focusElements.barDismiss.textContent = "Not now";
    }
  }
  document.title = titleText(now, running, focusBreak);
}

/** "Focus 18:42 · Homework Tracker" or "Break 4:12 · …", so the time shows from another tab. */
function titleText(now, running, focusBreak) {
  if (state.focus.on && running) {
    return `Focus ${formatClock(Math.max(blockSecondsLeft(running, state.focus, now), 0))} · ${pageTitle}`;
  }
  const breakLeft = focusBreak ? Math.ceil((new Date(focusBreak.endsAt) - now) / 1000) : 0;
  return breakLeft > 0 ? `Break ${formatClock(breakLeft)} · ${pageTitle}` : pageTitle;
}

/** Keep going / Start next block: a new block on the same assignment, if it's still there and not done. */
function startNextBlock() {
  const assignment = findAssignment(state.focusBreak?.assignmentId ?? "");
  setBreak(null);
  if (!assignment || assignment.done) {
    showToast("That assignment is done or gone. Press Start on the next one.");
    return;
  }
  primeChime();
  updateAssignments(startTimer(state.assignments, assignment.id));
  showToast(`Next block on "${assignment.title}".`);
}
