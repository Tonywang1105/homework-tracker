// Today's plan, at the top of the list: what's overdue, what's due today, and the hours the start-date
// plan (src/plan.js) fits into today, each with Start, so "what should I do now?" has one answer.

import { assignmentType, describeDue, formatHours } from "../assignments.js?v=5448d2e0";
import { toDateKey } from "../calendar.js?v=5448d2e0";
import { makeTag } from "./dom.js?v=5448d2e0";
import { makeTimerClock, stepSchedule, timerButton } from "./list.js?v=5448d2e0";
import { state } from "./store.js?v=5448d2e0";

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
  total.textContent = hours > 0 ? `${formatHours(hours)} of work` : "";
  list.replaceChildren(...entries.map((entry) => renderEntry(entry, now)));

  emptyMessage.hidden = entries.some((entry) => entry.todayHours > 0);
  if (!emptyMessage.hidden) {
    // With no estimates on upcoming work the plan has nothing to fit into the day, so say how to give it some.
    const nothing = entries.length === 0 ? "Nothing planned for today." : "Nothing else planned for today.";
    const hint = state.startPlan.size === 0 ? ' Add "Time needed" to assignments so the plan can fit them into your days.' : "";
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
  checkbox.setAttribute("aria-label", `Mark "${assignment.title}" as done`);

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
    const ofLeft = hoursLeft > todayHours ? ` of ${formatHours(hoursLeft)} left` : "";
    const ahead = reason === "ahead" ? " · getting ahead" : "";
    body.append(makeTag(`${formatHours(todayHours)} today${ofLeft}${ahead}`, "today-plan-hours"));
  }
  // Today's share of its steps (an exam's topics): "Study: Eigenvalues, Diagonalization".
  const today = toDateKey(now);
  const todaySteps = (assignment.steps ?? []).filter((_, index) => stepSchedule(assignment, now)[index] === today);
  if (todaySteps.length > 0) {
    const label = assignmentType(assignment) === "exam" ? "Study" : "Steps";
    body.append(makeTag(`${label}: ${todaySteps.map((step) => step.text).join(", ")}`, "today-plan-steps"));
  }
  if (assignment.timerStartedAt) {
    body.append(makeTimerClock(assignment, now));
  }

  item.append(checkbox, body, timerButton(assignment));
  return item;
}
