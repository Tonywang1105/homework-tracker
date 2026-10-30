// Dragging an assignment's tag to another day on the calendar to move its due date (src/assignments.js decides
// whether that's an extension). A mouse drags once it moves a little; a finger has to press and hold first, so a
// quick swipe still scrolls the page. A plain click still opens the details box.

import { rescheduleTo } from "../assignments.js?v=03cdcd76";
import { elements, formatDay } from "./dom.js?v=03cdcd76";
import { findAssignment, state, updateAssignments } from "./store.js?v=03cdcd76";
import { showToast } from "./toast.js?v=03cdcd76";

const MOUSE_START_DISTANCE = 6;
const TOUCH_HOLD_MS = 450;
// Moving further than this before the hold is up means the finger is scrolling, not dragging.
const TOUCH_SLOP = 8;

// While a press might become a drag: { id, tag, pointerId, startX, startY, timer, dragging, ghost, target }.
let press = null;
// A drag ends with a click on the tag (or the day under it), which shouldn't also open the details or the form.
let swallowNextClick = false;

export function startCalendarDrag() {
  elements.calendarBody.addEventListener("pointerdown", handlePointerDown);
  elements.calendarBody.addEventListener("click", swallowClickAfterDrag, true);
  document.addEventListener("pointermove", handlePointerMove);
  document.addEventListener("pointerup", handlePointerUp);
  document.addEventListener("pointercancel", () => endPress(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && press?.dragging) {
      endPress(false);
    }
  });
  // Once a touch drag has started, the page mustn't scroll under the finger.
  document.addEventListener("touchmove", (event) => press?.dragging && event.preventDefault(), { passive: false });
}

function handlePointerDown(event) {
  const tag = event.target.closest(".calendar-item");
  const assignment = tag && findAssignment(tag.dataset.id);
  if (!assignment || assignment.done || event.button !== 0) {
    return;
  }
  press = { id: assignment.id, tag, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, dragging: false, ghost: null, target: null };
  if (event.pointerType !== "mouse") {
    press.timer = setTimeout(() => beginDrag(event.clientX, event.clientY), TOUCH_HOLD_MS);
  }
}

function handlePointerMove(event) {
  if (!press || event.pointerId !== press.pointerId) {
    return;
  }
  const distance = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
  if (!press.dragging) {
    if (event.pointerType === "mouse" && distance >= MOUSE_START_DISTANCE) {
      beginDrag(event.clientX, event.clientY);
    } else if (event.pointerType !== "mouse" && distance > TOUCH_SLOP) {
      // Scrolling, not a drag.
      endPress(false);
    }
    return;
  }
  moveDrag(event.clientX, event.clientY);
}

function handlePointerUp(event) {
  if (press && event.pointerId === press.pointerId) {
    endPress(press.dragging);
  }
}

function beginDrag(x, y) {
  press.dragging = true;
  press.ghost = press.tag.cloneNode(true);
  press.ghost.className = `${press.tag.className} drag-ghost`;
  press.ghost.removeAttribute("id");
  press.ghost.setAttribute("aria-hidden", "true");
  document.body.append(press.ghost);
  document.body.classList.add("is-dragging");
  press.tag.classList.add("is-drag-source");
  moveDrag(x, y);
}

function moveDrag(x, y) {
  press.ghost.style.left = `${x}px`;
  press.ghost.style.top = `${y}px`;
  const day = document.elementFromPoint(x, y)?.closest("td.calendar-day") ?? null;
  if (day !== press.target) {
    press.target?.classList.remove("is-drop-target");
    day?.classList.add("is-drop-target");
    press.target = day;
  }
}

/** Ends a press; if it was a drag that's being dropped on a day, moves the assignment there. */
function endPress(drop) {
  if (!press) {
    return;
  }
  clearTimeout(press.timer);
  const { id, dragging, ghost, target, tag } = press;
  press = null;
  if (!dragging) {
    return;
  }
  swallowNextClick = true;
  // A click doesn't always follow (it doesn't when the drop is on another day), so stop waiting for one soon.
  setTimeout(() => (swallowNextClick = false), 0);
  ghost.remove();
  tag.classList.remove("is-drag-source");
  target?.classList.remove("is-drop-target");
  document.body.classList.remove("is-dragging");
  if (drop && target) {
    moveTo(id, target.dataset.date);
  }
}

function swallowClickAfterDrag(event) {
  if (swallowNextClick) {
    swallowNextClick = false;
    event.stopPropagation();
    event.preventDefault();
  }
}

function moveTo(id, date) {
  const before = findAssignment(id);
  if (!before || !date || date === before.dueDate) {
    return;
  }
  const after = rescheduleTo(before, date);
  const previous = state.assignments;
  updateAssignments(previous.map((a) => (a.id === id ? after : a)));
  const day = formatDay(date);
  let message = `Moved "${after.title}" to ${day}.`;
  if (after.originalDueDate && !before.originalDueDate) {
    message = `Extended "${after.title}" to ${day}.`;
  } else if (before.originalDueDate && !after.originalDueDate) {
    message = `Moved "${after.title}" back to its original date, ${day}.`;
  }
  showToast(message, () => updateAssignments(previous));
}
