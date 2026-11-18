// Phones only: the filters and Today's plan fold behind a button each, so the list starts about a screen higher.
// The buttons are shown and the blocks folded only by the phone layout in styles/base.css; on a laptop both blocks
// always show and the buttons stay hidden, so nothing there changes. Open or closed isn't saved: each visit starts
// folded, and a count on the Filters button says when a filter is narrowing the list.

import { activeFilterCount } from "../assignments.js?v=c722303e";
import { t } from "../i18n.js?v=c722303e";
import { elements } from "./dom.js?v=c722303e";
import { state } from "./store.js?v=c722303e";

const filtersToggle = document.getElementById("filters-toggle");
const planBox = document.getElementById("today-plan");
const planToggle = document.getElementById("today-plan-toggle");

export function startPhoneFolds() {
  filtersToggle.addEventListener("click", () => setOpen(elements.filters, filtersToggle, !elements.filters.classList.contains("is-open")));
  planToggle.addEventListener("click", () => {
    setOpen(planBox, planToggle, !planBox.classList.contains("is-open"));
    renderPhoneFolds();
  });
}

function setOpen(block, toggle, open) {
  block.classList.toggle("is-open", open);
  toggle.setAttribute("aria-expanded", String(open));
}

/** The buttons' words: "Filters (2 on)" when filters are narrowing the list, and "Show 3" or "Hide" for the plan. */
export function renderPhoneFolds() {
  filtersToggle.hidden = elements.filters.hidden;
  const count = activeFilterCount({
    course: elements.courseFilter.value,
    platform: elements.platformFilter.value,
    hideSmall: !elements.showSmall.checked,
    hideDone: elements.hideDone.checked,
    search: elements.search.value,
  });
  filtersToggle.textContent = count > 0 ? t("filter.toggle_count", { n: count }) : t("filter.toggle");

  // With nothing in it the plan is just a short message, so there's nothing to fold.
  const items = state.todayPlan.length;
  planToggle.hidden = items === 0;
  planBox.classList.toggle("can-fold", items > 0);
  planToggle.textContent = planBox.classList.contains("is-open") ? t("plan.hide") : t("plan.show", { n: items });
}
