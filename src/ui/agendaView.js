// The Agenda view: overdue work, then the next two weeks day by day, made for reading on a phone.
// Tapping an assignment opens the same details box as the calendar.

import { formatHours, toDueDate, totalHours } from "../assignments.js?v=8fdd39f5";
import { buildAgenda } from "../calendar.js?v=8fdd39f5";
import { elements, formatDay, makeButton, timeFormatter } from "./dom.js?v=8fdd39f5";
import { renderTags } from "./list.js?v=8fdd39f5";
import { state } from "./store.js?v=8fdd39f5";

const AGENDA_DAYS = 14;

export function renderAgenda(assignments, now) {
  const { overdue, days, laterCount } = buildAgenda(assignments, now, AGENDA_DAYS);
  const sections = days.map((day) => renderAgendaDay(dayHeading(day), day.assignments, "Nothing due"));
  if (overdue.length > 0) {
    sections.unshift(renderAgendaDay("Overdue", overdue, "", { overdue: true }));
  }
  elements.agendaList.replaceChildren(...sections);

  const lastDay = formatDay(days.at(-1).key);
  elements.agendaLater.textContent =
    laterCount === 1
      ? `1 more assignment is due after ${lastDay}. See List or Calendar.`
      : `${laterCount} more assignments are due after ${lastDay}. See List or Calendar.`;
  elements.agendaLater.hidden = laterCount === 0;
}

/** "Today · Fri, 10/23", "Tomorrow · Sat, 10/24", or "Sun, 10/25". */
function dayHeading(day) {
  const date = formatDay(day.key);
  if (day.isToday) {
    return `Today · ${date}`;
  }
  return day.isTomorrow ? `Tomorrow · ${date}` : date;
}

function renderAgendaDay(heading, assignments, emptyText, { overdue = false } = {}) {
  const section = document.createElement("li");
  section.className = "agenda-day";
  section.classList.toggle("is-overdue", overdue);
  section.classList.toggle("is-empty", assignments.length === 0);

  const header = document.createElement("div");
  header.className = "agenda-heading";
  const title = document.createElement("h3");
  title.textContent = heading;
  header.append(title);
  const hours = totalHours(assignments);
  if (hours > 0) {
    const hoursLabel = document.createElement("span");
    hoursLabel.className = "agenda-hours";
    hoursLabel.textContent = `${formatHours(hours)} of work`;
    header.append(hoursLabel);
  }
  if (assignments.length === 0) {
    const nothing = document.createElement("span");
    nothing.className = "agenda-nothing";
    nothing.textContent = emptyText;
    header.append(nothing);
  }
  section.append(header);

  if (assignments.length > 0) {
    const list = document.createElement("ul");
    list.className = "agenda-items";
    // Overdue work comes from different days, so it shows its date as well as its time.
    list.append(...assignments.map((assignment) => renderAgendaItem(assignment, { showDate: overdue })));
    section.append(list);
  }
  return section;
}

function renderAgendaItem(assignment, { showDate }) {
  const item = document.createElement("li");
  const button = makeButton(`agenda-item priority-${assignment.priority}`);
  button.classList.toggle("is-done", assignment.done);
  button.classList.toggle("is-selected", assignment.id === state.detailsId);
  button.dataset.id = assignment.id;
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", String(assignment.id === state.detailsId));

  const time = document.createElement("span");
  time.className = "agenda-time";
  const dueTime = timeFormatter.format(toDueDate(assignment.dueDate, assignment.dueTime));
  time.textContent = showDate ? `${formatDay(assignment.dueDate)}\n${dueTime}` : dueTime;
  const title = document.createElement("span");
  title.className = "agenda-title";
  title.textContent = assignment.title;
  const tags = document.createElement("span");
  tags.className = "agenda-tags";
  tags.append(...renderTags(assignment));
  button.append(time, title, tags);
  if (assignment.done) {
    button.setAttribute("aria-label", `Show details: "${assignment.title}", done`);
  }

  item.append(button);
  return item;
}
