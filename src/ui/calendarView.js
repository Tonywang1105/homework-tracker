// The month calendar, its details box, and the Due soon chips above it.

import { assignmentType, describeDue, formatHours, toDueDate, totalHours, TYPE_LABELS, TYPES } from "../assignments.js?v=b626d73a";
import { buildMonthGrid, calendarTagText, isPastWeek, visibleOnDay } from "../calendar.js?v=b626d73a";
import { render } from "../main.js?v=b626d73a";
import { DATE_LOCALE, elements, formatDay, makeButton, monthFormatter, timeFormatter } from "./dom.js?v=b626d73a";
import { startAddingOn } from "./form.js?v=b626d73a";
import { renderDueParts, renderTags } from "./list.js?v=b626d73a";
import { findAssignment, state } from "./store.js?v=b626d73a";

// A day shows at most this many lines (tags, or tags plus a "+N more" link), so one busy day can't stretch its week.
const MAX_LINES_PER_DAY = 3;

// How screen readers hear each size on the calendar.
const SIZE_NAMES = { big: "Big assignment", regular: "Regular assignment", small: "Small reminder" };

export function renderCalendar(assignments, course, now) {
  const weeks = buildMonthGrid(state.shownMonth, assignments, now);
  const monthName = monthFormatter.format(new Date(state.shownMonth.year, state.shownMonth.month, 1));
  elements.calendarMonth.textContent = monthName;

  elements.calendarBody.replaceChildren(
    ...weeks.map((week) => {
      const row = document.createElement("tr");
      // Weeks already over are drawn slimmer, so this week stays near the top of the screen.
      row.classList.toggle("past-week", isPastWeek(week, now));
      row.append(...week.map(renderCalendarDay));
      return row;
    }),
  );

  const leftThisMonth = weeks.flat().some((day) => day.inMonth && day.assignments.some((a) => !a.done));
  elements.calendarEmpty.hidden = leftThisMonth || state.assignments.length === 0;
  const forCourse = course ? ` for ${course}` : "";
  elements.calendarEmpty.textContent = `Nothing left to do${forCourse} in ${monthName}.`;
}

function renderCalendarDay(day) {
  const cell = document.createElement("td");
  cell.className = "calendar-day";
  cell.classList.toggle("outside-month", !day.inMonth);
  cell.classList.toggle("is-today", day.isToday);
  cell.dataset.date = day.key;

  // The day number is a button so the keyboard can add an assignment too; a click anywhere else in the day does the same.
  const dayName = formatDay(day.key);
  const number = makeButton("day-number", day.dayOfMonth);
  number.setAttribute("aria-label", `Add an assignment due ${dayName}${day.isToday ? " (today)" : ""}`);
  cell.title = `Add an assignment due ${dayName}`;
  cell.append(number);
  const dayHours = totalHours(day.assignments);
  if (dayHours > 0) {
    const hoursLabel = document.createElement("span");
    hoursLabel.className = "day-hours";
    hoursLabel.textContent = dayHours < 1 ? `${Math.round(dayHours * 60)}m` : `${Math.round(dayHours * 10) / 10}h`;
    hoursLabel.title = `About ${formatHours(dayHours).slice(1)} of unfinished work due`;
    cell.append(hoursLabel);
  }

  if (day.assignments.length > 0) {
    const { shown, hiddenCount, hasToggle } = visibleOnDay(day.assignments, {
      maxLines: MAX_LINES_PER_DAY,
      expanded: state.expandedDays.has(day.key),
    });
    const list = document.createElement("ul");
    list.className = "calendar-items";
    list.append(...shown.map(renderCalendarItem));
    if (hasToggle) {
      list.append(renderMoreToggle(hiddenCount, dayName));
    }
    cell.append(list);
  }
  return cell;
}

/** "+2 more" on a busy day, or "Show less" once it is expanded. */
function renderMoreToggle(hiddenCount, dayName) {
  const item = document.createElement("li");
  const button = makeButton("calendar-more");
  if (hiddenCount > 0) {
    // On a phone the day is too narrow for "+3 more", so CSS hides the word "more" there.
    const moreWord = document.createElement("span");
    moreWord.className = "more-word";
    moreWord.textContent = " more";
    button.append(`+${hiddenCount}`, moreWord);
  } else {
    button.textContent = "Show less";
  }
  button.setAttribute(
    "aria-label",
    hiddenCount > 0 ? `Show ${hiddenCount} more assignments due ${dayName}` : `Show fewer assignments for ${dayName}`,
  );
  item.append(button);
  return item;
}

function renderCalendarItem(assignment) {
  const item = document.createElement("li");
  const button = makeButton(`calendar-item priority-${assignment.priority}`, calendarTagText(assignment));
  button.classList.toggle("is-done", assignment.done);
  button.classList.toggle("is-selected", assignment.id === state.detailsId);
  button.dataset.id = assignment.id;
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", String(assignment.id === state.detailsId));

  const dueTime = timeFormatter.format(toDueDate(assignment.dueDate, assignment.dueTime));
  const size = SIZE_NAMES[assignment.priority];
  const course = assignment.course ? ` (${assignment.course})` : "";
  const type = assignmentType(assignment);
  const typeName = type ? `${TYPE_LABELS[type]}, ` : "";
  if (type) {
    const dot = document.createElement("span");
    dot.className = `type-dot type-${type}`;
    button.prepend(dot);
  }
  // The tag is only a short label, so the tooltip and screen-reader label carry the full title.
  button.title = `${assignment.title}${course}, ${typeName}due ${dueTime}`;
  const status = assignment.done ? ", done" : "";
  button.setAttribute("aria-label", `Show details: "${assignment.title}"${course}, ${typeName}${size}, due ${dueTime}${status}`);

  item.append(button);
  return item;
}

/** The color key under the calendar, built from the same list of types the app uses everywhere. */
export function renderTypeLegend() {
  elements.typeLegend.replaceChildren(
    ...TYPES.map((type) => {
      const item = document.createElement("li");
      item.className = `type-${type}`;
      item.textContent = TYPE_LABELS[type];
      return item;
    }),
  );
}

export function renderWeekdayHeadings() {
  const shortName = new Intl.DateTimeFormat(DATE_LOCALE, { weekday: "short" });
  const longName = new Intl.DateTimeFormat(DATE_LOCALE, { weekday: "long" });
  // 2026-10-04 is a Sunday, so the next seven days give the weekday names in grid order.
  const week = Array.from({ length: 7 }, (_, index) => new Date(2026, 9, 4 + index));
  elements.calendarWeekdays.replaceChildren(
    ...week.map((date) => {
      const heading = document.createElement("th");
      heading.scope = "col";
      const abbreviation = document.createElement("abbr");
      abbreviation.title = longName.format(date);
      abbreviation.textContent = shortName.format(date);
      heading.append(abbreviation);
      return heading;
    }),
  );
}

export function handleCalendarClick(event) {
  const moreToggle = event.target.closest(".calendar-more");
  if (moreToggle) {
    const dateKey = moreToggle.closest(".calendar-day").dataset.date;
    if (!state.expandedDays.delete(dateKey)) {
      state.expandedDays.add(dateKey);
    }
    render();
    // render() replaced the button, so put keyboard focus on the new one.
    elements.calendarBody.querySelector(`.calendar-day[data-date="${dateKey}"] .calendar-more`)?.focus();
    return;
  }
  const button = event.target.closest(".calendar-item");
  if (button) {
    // Clicking the open tag again closes its box.
    toggleDetails(button.dataset.id === state.detailsId && !state.detailsFromChip ? null : button.dataset.id);
    return;
  }
  const cell = event.target.closest(".calendar-day");
  // While a details box is open, a click elsewhere only closes it (see handleOutsideClick).
  if (cell && !state.detailsId) {
    startAddingOn(cell.dataset.date);
  }
}

export function toggleDetails(assignmentId, { fromChip = false } = {}) {
  const closingId = state.detailsId;
  const closingFromChip = state.detailsFromChip;
  state.detailsId = assignmentId;
  state.detailsFromChip = fromChip;
  render();
  if (assignmentId) {
    elements.details.focus();
  } else if (closingId) {
    // Put keyboard focus back on the tag or chip that opened the box.
    (closingFromChip ? dueSoonChip(closingId) : calendarItemButton(closingId))?.focus();
  }
}

function dueSoonChip(assignmentId) {
  return elements.dueSoonList.querySelector(`.due-soon-chip[data-id="${CSS.escape(assignmentId)}"]`);
}

function calendarItemButton(assignmentId) {
  return elements.calendarBody.querySelector(`.calendar-item[data-id="${CSS.escape(assignmentId)}"]`);
}

export function renderDetails(now) {
  const assignment = findAssignment(state.detailsId);
  const button = assignment && (state.detailsFromChip ? dueSoonChip(assignment.id) : calendarItemButton(assignment.id));
  if (!button) {
    // The assignment was deleted, or its tag or chip is gone (filtered out, another month, no longer due soon): close the box.
    state.detailsId = null;
    elements.details.hidden = true;
    return;
  }

  elements.detailsTitle.textContent = assignment.title;
  elements.detailsTags.replaceChildren(...renderTags(assignment));
  elements.detailsDue.replaceChildren(...renderDueParts(assignment, now));
  // textContent (not innerHTML) so anything typed in a note is shown as text, never run as HTML.
  elements.detailsNotes.textContent = assignment.notes || "No notes.";
  elements.detailsNotes.classList.toggle("is-empty", !assignment.notes);
  elements.detailsDone.textContent = assignment.done ? "Mark not done" : "Mark done";
  elements.details.hidden = false;
  positionDetails(button);
}

/** Places the box just below the tag, kept inside the calendar's width. */
function positionDetails(button) {
  const container = elements.calendarView.getBoundingClientRect();
  const tag = button.getBoundingClientRect();
  const boxWidth = elements.details.offsetWidth;
  const left = Math.min(Math.max(0, tag.left - container.left), container.width - boxWidth);
  elements.details.style.left = `${Math.max(0, left)}px`;
  elements.details.style.top = `${tag.bottom - container.top + 4}px`;
}

export function handleOutsideClick(event) {
  const onOpener = event.target.closest(".calendar-item, .due-soon-chip");
  if (state.detailsId && !elements.details.contains(event.target) && !onOpener) {
    toggleDetails(null);
  }
}

export function showMonth(month) {
  state.shownMonth = month;
  state.expandedDays.clear();
  render();
}

/** The reminder box on the calendar: everything unfinished that is overdue or due within a day, whatever the filters. */
export function renderDueSoon(soon, now) {
  // Only in Calendar view: in List view the same items already sit at the top, tinted (see renderAssignment).
  elements.dueSoon.hidden = soon.length === 0 || state.view !== "calendar";
  elements.dueSoonCount.textContent = `(${soon.length})`;
  elements.dueSoonList.replaceChildren(...soon.map((assignment) => renderDueSoonChip(assignment, now)));
}

/** One compact chip: type dot, title and time left. Clicking it opens the same details box as a calendar tag. */
function renderDueSoonChip(assignment, now) {
  const item = document.createElement("li");
  const { text, urgency } = describeDue(assignment, now);
  const chip = makeButton(`due-soon-chip urgency-${urgency}`);
  chip.dataset.id = assignment.id;
  chip.classList.toggle("is-selected", state.detailsFromChip && assignment.id === state.detailsId);
  chip.setAttribute("aria-haspopup", "dialog");
  const course = assignment.course ? ` (${assignment.course})` : "";
  chip.setAttribute("aria-label", `Show details: "${assignment.title}"${course}, ${text}`);

  const type = assignmentType(assignment);
  if (type) {
    const dot = document.createElement("span");
    dot.className = `type-dot type-${type}`;
    chip.append(dot);
  }
  const title = document.createElement("span");
  title.className = "due-soon-title";
  title.textContent = assignment.title;
  const when = document.createElement("span");
  when.className = "due-soon-when";
  when.textContent = text;
  chip.append(title, when);

  item.append(chip);
  return item;
}

export function handleDueSoonClick(event) {
  const chip = event.target.closest(".due-soon-chip");
  if (chip) {
    const isOpen = chip.dataset.id === state.detailsId && state.detailsFromChip;
    toggleDetails(isOpen ? null : chip.dataset.id, { fromChip: true });
  }
}
