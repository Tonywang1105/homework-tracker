// Settings: List or Calendar view, color theme, column width, and the workload line with its daily limit.

import { formatHours, workload } from "../assignments.js?v=5726d47e";
import { t } from "../i18n.js?v=5726d47e";
import { clampFormWidth, DEFAULT_FORM_WIDTH, KEYBOARD_STEP } from "../layout.js?v=5726d47e";
import { render } from "../main.js?v=5726d47e";
import { parseDailyHours } from "../plan.js?v=5726d47e";
import { countAssignments, elements, formatDay } from "./dom.js?v=5726d47e";
import { removeChoice, saveChoice, state } from "./store.js?v=5726d47e";
import { showToast } from "./toast.js?v=5726d47e";

export const VIEW_STORAGE_KEY = "homework-tracker.view";

export const VIEWS = ["list", "calendar", "agenda"];

// Also read by the small script at the top of index.html, which applies the theme before the page is drawn.
export const THEME_STORAGE_KEY = "homework-tracker.theme";

export const THEMES = ["system", "light", "dark"];

// When Canvas was last imported, and until when "Not now" pauses the reminder (ISO times).
export const FORM_WIDTH_KEY = "homework-tracker.formWidth";

export const DAILY_HOURS_KEY = "homework-tracker.dailyHours";

export function setView(view) {
  state.view = view;
  saveChoice(VIEW_STORAGE_KEY, view);
  render();
}

/** The width the form and the To do list share, not counting the page's padding and the drag handle. */
function columnsWidth() {
  const style = getComputedStyle(elements.layout);
  const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  return elements.layout.clientWidth - padding - elements.columnResizer.offsetWidth;
}

function setFormWidth(requested) {
  const width = clampFormWidth(requested, columnsWidth());
  elements.layout.style.setProperty("--form-width", `${width}px`);
  elements.columnResizer.setAttribute("aria-valuenow", String(width));
  return width;
}

export function resetFormWidth() {
  elements.layout.style.removeProperty("--form-width");
  elements.columnResizer.setAttribute("aria-valuenow", String(DEFAULT_FORM_WIDTH));
  removeChoice(FORM_WIDTH_KEY);
}

export function startResizing(event) {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  const resizer = elements.columnResizer;
  resizer.setPointerCapture(event.pointerId);
  resizer.classList.add("is-dragging");
  document.body.classList.add("is-resizing");
  const formLeft = elements.formPanel.getBoundingClientRect().left;
  let width = elements.formPanel.offsetWidth;

  const move = (moveEvent) => {
    width = setFormWidth(moveEvent.clientX - formLeft);
  };
  const stop = () => {
    resizer.removeEventListener("pointermove", move);
    resizer.classList.remove("is-dragging");
    document.body.classList.remove("is-resizing");
    saveChoice(FORM_WIDTH_KEY, String(width));
  };
  resizer.addEventListener("pointermove", move);
  resizer.addEventListener("pointerup", stop, { once: true });
  resizer.addEventListener("pointercancel", stop, { once: true });
}

export function handleResizerKey(event) {
  const steps = { ArrowLeft: -KEYBOARD_STEP, ArrowRight: KEYBOARD_STEP };
  if (event.key in steps) {
    event.preventDefault();
    saveChoice(FORM_WIDTH_KEY, String(setFormWidth(elements.formPanel.offsetWidth + steps[event.key])));
  } else if (event.key === "Enter") {
    event.preventDefault();
    resetFormWidth();
  }
}

/** "system" follows the computer's light or dark setting; "light" and "dark" override it. */
export function applyTheme(theme) {
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
  for (const button of elements.themeButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme));
  }
}

export function setTheme(theme) {
  applyTheme(theme);
  saveChoice(THEME_STORAGE_KEY, theme);
}

/** "Next 7 days: ~11 h of work · busiest: Thu, 10/22 (~4 h) · 3 without an estimate" */
export function renderWorkload(now) {
  const { count, hours, unestimated, busiest } = workload(state.assignments, now);
  elements.workload.hidden = count === 0;
  if (count === 0) {
    return;
  }
  const heading = document.createElement("strong");
  heading.textContent = t("work.next7");
  if (hours === 0) {
    elements.workloadText.replaceChildren(heading, t("work.no_hours", { count: countAssignments(count) }));
    return;
  }
  const parts = [t("work.of_work", { hours: formatHours(hours) })];
  if (busiest) {
    parts.push(t("work.busiest", { day: formatDay(busiest.dueDate), hours: formatHours(busiest.hours) }));
  }
  if (unestimated > 0) {
    parts.push(t("work.unestimated", { n: unestimated }));
  }
  elements.workloadText.replaceChildren(heading, parts.join(" · "));
}

export function handleDailyHoursChange() {
  const hours = parseDailyHours(elements.dailyHours.value);
  if (hours === null) {
    showToast(t("msg.daily_range"));
    elements.dailyHours.value = state.dailyHours;
    return;
  }
  state.dailyHours = hours;
  saveChoice(DAILY_HOURS_KEY, String(hours));
  render();
  showToast(t("msg.daily_set", { hours }));
}
