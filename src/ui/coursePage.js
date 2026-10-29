// Course pages: clicking a course tag shows the List for that course (the Course filter) with the course's links
// above it, such as Canvas, PrairieLearn and Gradescope. Links are saved in this browser and synced when signed in.

import { linksFor, parseSavedLinks, validateLink } from "../courseLinks.js?v=78dcb73d";
import { render } from "../main.js?v=78dcb73d";
import { syncCourseLinks } from "./account.js?v=78dcb73d";
import { elements, makeButton } from "./dom.js?v=78dcb73d";
import { handleFilterChange } from "./list.js?v=78dcb73d";
import { setView } from "./settings.js?v=78dcb73d";
import { loadText, saveChoice, state } from "./store.js?v=78dcb73d";
import { showToast } from "./toast.js?v=78dcb73d";

const COURSE_LINKS_KEY = "homework-tracker.courseLinks";

const page = {
  section: document.getElementById("course-page"),
  title: document.getElementById("course-page-title"),
  all: document.getElementById("course-page-all"),
  links: document.getElementById("course-links"),
  empty: document.getElementById("course-links-empty"),
  editToggle: document.getElementById("course-links-edit"),
  editor: document.getElementById("course-links-editor"),
  editList: document.getElementById("course-links-edit-list"),
  form: document.getElementById("course-link-form"),
  error: document.getElementById("course-link-error"),
  done: document.getElementById("course-links-done"),
};
// The course whose links are being edited, so choosing another course closes the editor.
let editingCourse = null;

export function startCoursePages() {
  state.courseLinks = parseSavedLinks(loadText(COURSE_LINKS_KEY));
  // Capturing, so a course tag inside a list row or the details box opens the page instead of the row's own action.
  document.addEventListener("click", handleCourseTagClick, true);
  page.all.addEventListener("click", () => chooseCourse(""));
  page.editToggle.addEventListener("click", () => setEditorOpen(page.editor.hidden));
  page.done.addEventListener("click", () => setEditorOpen(false));
  page.form.addEventListener("submit", handleAddLink);
  page.editList.addEventListener("change", handleRename);
  page.editList.addEventListener("click", handleRemove);
}

/** The links changed here: remember them in this browser, send them to the account, and redraw. */
function saveLinks(links) {
  applyCourseLinks(links);
  syncCourseLinks(links);
}

/** Shows a list of links (also called when the account's links change on another device). */
export function applyCourseLinks(links) {
  state.courseLinks = links;
  saveChoice(COURSE_LINKS_KEY, JSON.stringify(links));
  render();
}

function handleCourseTagClick(event) {
  const tag = event.target instanceof Element ? event.target.closest("[data-course-page]") : null;
  if (!tag) {
    return;
  }
  event.stopPropagation();
  state.detailsId = null;
  if (state.view !== "list") {
    setView("list");
  }
  chooseCourse(tag.dataset.coursePage);
  page.section.scrollIntoView({ behavior: "smooth", block: "nearest" });
  page.title.focus({ preventScroll: true });
}

/** Sets the Course filter, which is what decides whose page is shown ("" for all courses). */
function chooseCourse(course) {
  elements.courseFilter.value = course;
  handleFilterChange();
}

export function renderCoursePage() {
  const course = state.courseFilter;
  page.section.hidden = course === "" || state.view !== "list";
  if (page.section.hidden) {
    return;
  }
  if (editingCourse !== null && editingCourse !== course) {
    setEditorOpen(false);
  }
  const links = linksFor(state.courseLinks, course);
  const left = state.assignments.filter((a) => a.course === course && !a.done).length;
  page.title.textContent = course;
  const count = document.createElement("span");
  count.className = "course-page-count";
  count.textContent = left === 0 ? "nothing to do" : `${left} to do`;
  page.title.append(" ", count);

  page.links.replaceChildren(
    ...links.map((link) => {
      const item = document.createElement("li");
      const anchor = document.createElement("a");
      anchor.className = "button course-link";
      anchor.href = link.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = link.label;
      anchor.title = link.url;
      item.append(anchor);
      return item;
    }),
  );
  page.links.hidden = links.length === 0;
  page.empty.hidden = links.length > 0 || !page.editor.hidden;
  page.editToggle.hidden = !page.editor.hidden;
  page.editToggle.textContent = links.length === 0 ? "Add links" : "Edit links";
  // Don't redraw the rename boxes while one is being typed in (the list redraws every minute and on sync).
  if (!page.editList.contains(document.activeElement)) {
    page.editList.replaceChildren(...links.map(renderEditRow));
  }
}

/** A link in the editor: its name (rename by typing) and Remove. */
function renderEditRow(link) {
  const item = document.createElement("li");
  item.dataset.url = link.url;
  const name = document.createElement("input");
  name.value = link.label;
  name.maxLength = 40;
  name.setAttribute("aria-label", `Name of the link to ${link.url}`);
  const address = document.createElement("span");
  address.className = "course-link-address";
  address.textContent = link.url;
  const remove = makeButton("link-button action-delete", "Remove");
  remove.dataset.removeLink = "";
  remove.setAttribute("aria-label", `Remove the link "${link.label}"`);
  item.append(name, address, remove);
  return item;
}

function setEditorOpen(open) {
  page.editor.hidden = !open;
  page.editToggle.setAttribute("aria-expanded", String(open));
  editingCourse = open ? state.courseFilter : null;
  page.error.textContent = "";
  render();
  if (open) {
    page.form.elements.url.focus();
  } else {
    page.editToggle.focus();
  }
}

function handleAddLink(event) {
  event.preventDefault();
  const course = state.courseFilter;
  const result = validateLink({ course, label: page.form.elements.label.value, url: page.form.elements.url.value }, state.courseLinks);
  page.error.textContent = result.ok ? "" : result.error;
  if (!result.ok) {
    page.form.elements.url.focus();
    return;
  }
  saveLinks([...state.courseLinks, result.link]);
  page.form.reset();
  page.form.elements.url.focus();
  showToast(`Added "${result.link.label}" to ${course}.`);
}

/** Renaming: the new name is saved when the box loses focus or Enter is pressed. */
function handleRename(event) {
  const row = event.target.closest("li[data-url]");
  if (!row || event.target.tagName !== "INPUT") {
    return;
  }
  const course = state.courseFilter;
  const label = event.target.value.trim();
  if (label === "") {
    page.error.textContent = "A link needs a name. Type one, or remove the link.";
    return;
  }
  page.error.textContent = "";
  saveLinks(state.courseLinks.map((link) => (link.course === course && link.url === row.dataset.url ? { ...link, label: label.slice(0, 40) } : link)));
}

function handleRemove(event) {
  const row = event.target.closest("[data-remove-link]")?.closest("li[data-url]");
  if (!row) {
    return;
  }
  const previous = state.courseLinks;
  const removed = previous.find((link) => link.course === state.courseFilter && link.url === row.dataset.url);
  saveLinks(previous.filter((link) => link !== removed));
  showToast(`Removed "${removed.label}".`, () => saveLinks(previous));
  page.form.elements.url.focus();
}
