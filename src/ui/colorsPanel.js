// Course colors, in Settings: each course with its tag's color, which can be changed (saved in this browser).

import { COURSE_COLORS, courseColors, parseChosenColors } from "../courseColors.js?v=14885c19";
import { render } from "../main.js?v=14885c19";
import { makeOption, makeTag } from "./dom.js?v=14885c19";
import { loadText, saveChoice, state } from "./store.js?v=14885c19";

const CHOSEN_COLORS_KEY = "homework-tracker.courseColors";
const AUTOMATIC = "";
const colorList = document.getElementById("course-color-list");
const panel = document.getElementById("settings-panel");

export function loadChosenColors() {
  state.chosenColors = parseChosenColors(loadText(CHOSEN_COLORS_KEY));
}

/** Works out every course's color for this render, and fills in Settings' list while it is open. */
export function updateCourseColors(courses) {
  state.courseColors = courseColors(courses, state.chosenColors);
  if (panel.hidden) {
    return;
  }
  colorList.replaceChildren(
    ...courses.map((course) => {
      const item = document.createElement("li");
      const select = document.createElement("select");
      select.dataset.course = course;
      select.setAttribute("aria-label", `Color for ${course}`);
      select.append(makeOption(AUTOMATIC, "Automatic"), ...COURSE_COLORS.map((color) => makeOption(color, capitalized(color))));
      select.value = state.chosenColors[course] ?? AUTOMATIC;
      item.append(makeTag(course, `course-tag course-color-${state.courseColors.get(course)}`), select);
      return item;
    }),
  );
  if (courses.length === 0) {
    colorList.append(Object.assign(document.createElement("li"), { textContent: "No courses yet." }));
  }
}

export function handleCourseColorChange(event) {
  const { course } = event.target.dataset;
  if (!course) {
    return;
  }
  if (event.target.value === AUTOMATIC) {
    delete state.chosenColors[course];
  } else {
    state.chosenColors[course] = event.target.value;
  }
  saveChoice(CHOSEN_COLORS_KEY, JSON.stringify(state.chosenColors));
  render();
  // render() rebuilt the list, so keep keyboard focus on this course's color.
  colorList.querySelector(`select[data-course="${CSS.escape(course)}"]`)?.focus();
}

function capitalized(word) {
  return word[0].toUpperCase() + word.slice(1);
}
