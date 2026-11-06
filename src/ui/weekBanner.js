// The weekly planning banner: on the first open of each week (Monday to Sunday, like the Weekly review), a line at
// the top of the To do panel says what's left this week, the busiest day and the short days, until "Got it" or
// "Weekly review" is clicked. Remembered on this device.

import { formatHours, formatHoursPlain } from "../assignments.js?v=83b99c44";
import { formatList, t } from "../i18n.js?v=83b99c44";
import { render } from "../main.js?v=83b99c44";
import { weekdayOf } from "../plan.js?v=83b99c44";
import { weekAhead, weekStartKey } from "../review.js?v=83b99c44";
import { countAssignments, elements, formatDay } from "./dom.js?v=83b99c44";
import { openReview } from "./reviewPanel.js?v=83b99c44";
import { loadText, saveChoice, state } from "./store.js?v=83b99c44";
import { hoursLimit, weekdayName } from "./weekdayHours.js?v=83b99c44";

const SEEN_KEY = "homework-tracker.weekBannerSeen";

const banner = {
  box: document.getElementById("week-banner"),
  text: document.getElementById("week-banner-text"),
  review: document.getElementById("week-banner-review"),
  dismiss: document.getElementById("week-banner-dismiss"),
};

export function startWeekBanner() {
  banner.dismiss.addEventListener("click", () => {
    markSeen();
    // The button is gone, so give keyboard focus a place in the list.
    elements.listHeading.focus({ preventScroll: true });
  });
  banner.review.addEventListener("click", () => {
    markSeen();
    openReview();
  });
}

function markSeen() {
  saveChoice(SEEN_KEY, weekStartKey(new Date()));
  render();
}

export function renderWeekBanner(now) {
  const ahead = loadText(SEEN_KEY) === weekStartKey(now) ? null : weekAhead(state.assignments, now, hoursLimit(), state.dailyHours);
  banner.box.hidden = ahead === null;
  if (ahead) {
    banner.text.textContent = weekText(ahead);
  }
}

/** "6 assignments due by Sun, 11/8, ~14 h of work. Plus 1 overdue. Busiest: Fri, 11/6 (~4 h). Short days: Sat (day off)." */
function weekText({ end, count, hours, overdue, busiest, shortDays }) {
  const values = { count: countAssignments(count), end: formatDay(end), hours: formatHours(hours) };
  const sentences = [t(count === 0 ? "week.nothing_due" : hours > 0 ? "week.due_hours" : "week.due", values)];
  if (overdue > 0) {
    sentences.push(t("week.overdue", { n: overdue }));
  }
  if (busiest) {
    sentences.push(t("week.busiest", { day: formatDay(busiest.dueDate), hours: formatHours(busiest.hours) }));
  }
  if (shortDays.length > 0) {
    const days = shortDays.map(({ date, hours: dayHours }) => {
      const day = weekdayName(weekdayOf(date), "short");
      return dayHours === 0 ? t("week.day_off", { day }) : t("week.short_day", { day, hours: formatHoursPlain(dayHours) });
    });
    sentences.push(t("week.short_days", { days: formatList(days) }));
  }
  return sentences.join(" ");
}
