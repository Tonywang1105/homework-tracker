// Today's plan, at the top of the list: what's overdue, what's due today, and the hours the start-date
// plan (src/plan.js) fits into today, each with Start, so "what should I do now?" has one answer.

import { assignmentType, describeDue, formatHours } from "../assignments.js?v=0164f23d";
import { toDateKey } from "../calendar.js?v=0164f23d";
import { t } from "../i18n.js?v=0164f23d";
import { makeTag } from "./dom.js?v=0164f23d";
import { makeTimerClock, stepSchedule, timerButton } from "./list.js?v=0164f23d";
import { state } from "./store.js?v=0164f23d";

const box = document.getElementById("today-plan");
const total = document.getElementById("today-plan-total");
const list = document.getElementById("today-plan-list");
const emptyMessage = document.getElementById("today-plan-empty");

export const todayPlanList = list;

export function renderTodayPlan(now) {
  box.hidden = state.assignments.length === 0 || state.view !== "list";
  if (box.hidden) {
    return;
  }
  const entries = state.todayPlan;
  const hours = entries.reduce((sum, entry) => sum + entry.todayHours, 0);
  total.textContent = hours > 0 ? t("plan.total", { hours: formatHours(hours) }) : "";
  list.replaceChildren(...entries.map((entry) => renderEntry(entry, now)));

  emptyMessage.hidden = entries.some((entry) => entry.todayHours > 0);
  if (!emptyMessage.hidden) {
    // With no estimates on upcoming work the plan has nothing to fit into the day, so say how to give it some.
    const nothing = t(entries.length === 0 ? "plan.nothing" : "plan.nothing_else");
    const hint = state.startPlan.size === 0 ? t("plan.add_estimates") : "";
    emptyMessage.textContent = nothing + hint;
  }
}

/** One line: done box, title, why it's here ("overdue by 1 day", "~2 h today of ~4 h left · getting ahead"), Start or Stop. */
function renderEntry({ assignment, reason, todayHours, hoursLeft }, now) {
  const item = document.createElement("li");
  item.className = "today-plan-item";
  item.dataset.id = assignment.id;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "done-checkbox";
  checkbox.dataset.action = "toggle-done";
  checkbox.setAttribute("aria-label", t("aria.mark_done", { title: assignment.title }));

  const body = document.createElement("div");
  body.className = "today-plan-body";
  const title = document.createElement("span");
  title.className = "assignment-title";
  title.textContent = assignment.title;
  body.append(title);
  if (reason !== "planned") {
    const { text, urgency } = describeDue(assignment, now);
    body.append(makeTag(text, `relative-due urgency-${urgency}`));
  }
  if (todayHours > 0) {
    const ofLeft = hoursLeft > todayHours ? t("plan.of_left", { hours: formatHours(hoursLeft) }) : "";
    const ahead = reason === "ahead" ? t("plan.ahead") : "";
    body.append(makeTag(`${t("plan.today_hours", { hours: formatHours(todayHours) })}${ofLeft}${ahead}`, "today-plan-hours"));
  }
  // Today's share of its steps (an exam's topics): "Study: Eigenvalues, Diagonalization".
  const today = toDateKey(now);
  const todaySteps = (assignment.steps ?? []).filter((_, index) => stepSchedule(assignment, now)[index] === today);
  if (todaySteps.length > 0) {
    const list = todaySteps.map((step) => step.text).join(", ");
    body.append(makeTag(t(assignmentType(assignment) === "exam" ? "plan.study" : "plan.steps", { list }), "today-plan-steps"));
  }
  if (assignment.timerStartedAt) {
    body.append(makeTimerClock(assignment, now));
  }

  item.append(checkbox, body, timerButton(assignment));
  return item;
}
