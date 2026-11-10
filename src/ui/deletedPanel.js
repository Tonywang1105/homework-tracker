// Recently deleted, in Settings: what was deleted in the last 30 days, each with Restore, and Delete all now.
// The rules are in src/trash.js; store.js keeps the list up to date as assignments are deleted.

import { t } from "../i18n.js?v=a4a2142e";
import { deletedAgo, restoreDeleted } from "../trash.js?v=a4a2142e";
import { countAssignments, makeButton } from "./dom.js?v=a4a2142e";
import { state, updateDeleted } from "./store.js?v=a4a2142e";
import { showToast } from "./toast.js?v=a4a2142e";

const settingsPanel = document.getElementById("settings-panel");
const list = document.getElementById("deleted-list");
const count = document.getElementById("deleted-count");
const emptyButton = document.getElementById("deleted-empty");

export function startDeletedPanel() {
  list.addEventListener("click", handleRestore);
  emptyButton.addEventListener("click", handleEmpty);
}

/** Fills in the list while Settings is open, so it's current when looked at. */
export function renderDeleted(now) {
  if (settingsPanel.hidden) {
    return;
  }
  count.textContent = state.deleted.length > 0 ? `(${state.deleted.length})` : "";
  emptyButton.hidden = state.deleted.length === 0;
  if (state.deleted.length === 0) {
    list.replaceChildren(Object.assign(document.createElement("li"), { className: "deleted-none", textContent: t("settings.deleted_none") }));
    return;
  }
  list.replaceChildren(
    ...state.deleted.map((assignment) => {
      const item = document.createElement("li");
      const text = document.createElement("span");
      text.className = "deleted-text";
      const title = document.createElement("strong");
      title.textContent = assignment.title;
      const course = assignment.course ? ` · ${assignment.course}` : "";
      text.append(title, `${course} · ${t("settings.deleted_row", { ago: deletedAgo(assignment.deletedAt, now) })}`);
      const restore = makeButton("button", t("settings.restore"));
      restore.dataset.restore = assignment.id;
      restore.setAttribute("aria-label", t("aria.restore", { title: assignment.title }));
      item.append(text, restore);
      return item;
    }),
  );
}

function handleRestore(event) {
  const id = event.target.closest("[data-restore]")?.dataset.restore;
  if (!id) {
    return;
  }
  const title = state.deleted.find((a) => a.id === id)?.title;
  const { live, deleted } = restoreDeleted(state.assignments, state.deleted, id);
  updateDeleted(live, deleted);
  showToast(t("msg.restored_one", { title }));
  // The row is gone, so move focus to the next Restore button, or to Close if that was the last one.
  (list.querySelector("[data-restore]") ?? document.getElementById("settings-panel-close")).focus();
}

function handleEmpty() {
  const how = countAssignments(state.deleted.length);
  if (!window.confirm(t("msg.confirm_delete_forever", { count: how }))) {
    return;
  }
  updateDeleted(state.assignments, []);
  showToast(t("msg.deleted_forever", { count: how }));
}
