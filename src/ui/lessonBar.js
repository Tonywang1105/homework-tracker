// The "how did it go?" bar: after big or regular work is marked done, one optional line for next time, saved on
// that assignment (src/lessons.js shows it on the next one of its kind). It stays until saved or skipped.

import { updateAssignment } from "../assignments.js?v=ff7901f2";
import { t } from "../i18n.js?v=ff7901f2";
import { asksForLesson, cleanLesson } from "../lessons.js?v=ff7901f2";
import { findAssignment, state, updateAssignments } from "./store.js?v=ff7901f2";
import { showToast } from "./toast.js?v=ff7901f2";

const bar = {
  form: document.getElementById("lesson-bar"),
  question: document.getElementById("lesson-question"),
  text: document.getElementById("lesson-text"),
  skip: document.getElementById("lesson-skip"),
};

export function startLessonBar() {
  bar.form.addEventListener("submit", handleSave);
  bar.skip.addEventListener("click", () => {
    state.lessonFor = null;
    renderLessonBar();
  });
}

/** Called when work is marked done: asks how it went, if it's big or regular work. */
export function askForLesson(assignment) {
  if (asksForLesson(assignment)) {
    state.lessonFor = assignment.id;
    bar.text.value = "";
  }
}

/** Shows the bar while there's finished work to ask about (Undo, or deleting it, makes the question go away). */
export function renderLessonBar() {
  const assignment = state.lessonFor ? findAssignment(state.lessonFor) : null;
  if (!assignment?.done) {
    state.lessonFor = null;
  }
  bar.form.hidden = state.lessonFor === null;
  if (assignment?.done) {
    bar.question.textContent = t("lesson.question", { title: assignment.title });
  }
}

function handleSave(event) {
  event.preventDefault();
  const lesson = cleanLesson(bar.text.value);
  const id = state.lessonFor;
  state.lessonFor = null;
  if (lesson && findAssignment(id)) {
    updateAssignments(updateAssignment(state.assignments, id, { lesson }));
    showToast(t("lesson.saved"));
  }
  renderLessonBar();
}
