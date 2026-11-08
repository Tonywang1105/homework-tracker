// Different hours on some days: in Settings → Planning, seven boxes (Sunday or Monday first) for the hours of homework
// that weekday has, such as 1 h on a lab day or 0 for a day off. An empty box uses the usual hours a day. Saved on
// this device, like the usual hours; the planner reads both through hoursLimit().

import { DATE_LOCALES, formatNumber, getLanguage, t } from "../i18n.js?v=da81b4bb";
import { render } from "../main.js?v=da81b4bb";
import { dailyLimit, parseWeekdayBox, parseWeekdayHours } from "../plan.js?v=da81b4bb";
import { loadText, saveChoice, state } from "./store.js?v=da81b4bb";
import { showToast } from "./toast.js?v=da81b4bb";

export const WEEKDAY_HOURS_KEY = "homework-tracker.weekdayHours";
// Sunday, November 1, 2026, and the six days after it: one date for each weekday, to name them in any language.
const A_SUNDAY = new Date(2026, 10, 1);

const section = document.getElementById("weekday-hours");
const list = document.getElementById("weekday-hours-list");
const boxes = [];

/** The hours planned for any date ("YYYY-MM-DD"), from the usual hours and the weekdays set here. */
export function hoursLimit() {
  return dailyLimit(state.dailyHours, state.weekdayHours);
}

/** Whether a weekday has its own hours (so messages can say "on Friday" rather than "a day"). */
export function hasOwnHours(weekday) {
  return state.weekdayHours[weekday] !== null;
}

/** A weekday's name in the chosen language: "Friday", "星期五", "viernes". */
export function weekdayName(weekday, style = "long") {
  const date = new Date(A_SUNDAY.getFullYear(), A_SUNDAY.getMonth(), A_SUNDAY.getDate() + weekday);
  return new Intl.DateTimeFormat(DATE_LOCALES[getLanguage()], { weekday: style }).format(date);
}

export function startWeekdayHours() {
  state.weekdayHours = parseWeekdayHours(loadText(WEEKDAY_HOURS_KEY));
  for (let weekday = 0; weekday < 7; weekday++) {
    const label = document.createElement("label");
    label.className = "weekday-hours-day";
    const name = document.createElement("span");
    const box = document.createElement("input");
    box.type = "number";
    box.min = "0";
    box.max = "16";
    box.step = "0.5";
    box.inputMode = "decimal";
    box.value = state.weekdayHours[weekday] ?? "";
    box.addEventListener("change", () => handleWeekdayChange(weekday, box));
    label.append(name, box);
    list.append(label);
    boxes.push({ label, name, box });
  }
  // Opened already when some day has its own hours, so they're easy to find again.
  section.open = state.weekdayHours.some((hours) => hours !== null);
  renderWeekdayHours();
}

/** The weekday names (in the chosen language) and, as each empty box's hint, the usual hours it would use. */
export function renderWeekdayHours() {
  // In the week's order (Monday first if chosen in Settings). Moved only when that changes, so a box being typed in
  // isn't disturbed by the redraw every minute.
  const order = Array.from({ length: 7 }, (_, index) => (index + state.weekStart) % 7);
  if (list.firstElementChild !== boxes[order[0]].label) {
    list.append(...order.map((weekday) => boxes[weekday].label));
  }
  boxes.forEach(({ name, box }, weekday) => {
    name.textContent = weekdayName(weekday, "short");
    box.placeholder = String(state.dailyHours);
    box.setAttribute("aria-label", t("settings.weekday_aria", { day: weekdayName(weekday) }));
  });
}

function handleWeekdayChange(weekday, box) {
  const hours = parseWeekdayBox(box.value);
  const day = weekdayName(weekday);
  if (hours === undefined) {
    showToast(t("msg.weekday_range", { day }));
    box.value = state.weekdayHours[weekday] ?? "";
    return;
  }
  state.weekdayHours = state.weekdayHours.map((old, index) => (index === weekday ? hours : old));
  saveChoice(WEEKDAY_HOURS_KEY, JSON.stringify(state.weekdayHours));
  render();
  if (hours === null) {
    showToast(t("msg.weekday_usual", { day, hours: formatNumber(state.dailyHours) }));
  } else if (hours === 0) {
    showToast(t("msg.weekday_off", { day }));
  } else {
    showToast(t("msg.weekday_set", { day, hours: formatNumber(hours) }));
  }
}
