// The app's language (the buttons at the top of the page): English, 中文 or Español. It starts in the language chosen on this
// device, or the browser's if it's one of these, and changing it redraws every word the app writes. The words
// themselves are in src/i18n.js; the page's fixed words are marked with data-i18n, and placeholders, screen-reader
// labels and tooltips with data-i18n-placeholder, data-i18n-aria and data-i18n-title.

import { DATE_LOCALES, getLanguage, HTML_LANGS, pickLanguage, setLanguage, t } from "../i18n.js?v=a4a2142e";
import { render } from "../main.js?v=a4a2142e";
import { renderTypeLegend, renderWeekdayHeadings } from "./calendarView.js?v=a4a2142e";
import { setDateLocale } from "./dom.js?v=a4a2142e";
import { renderFormMode } from "./form.js?v=a4a2142e";
import { handleQuickAddInput } from "./quickAdd.js?v=a4a2142e";
import { renderShortcutList } from "./shortcuts.js?v=a4a2142e";
import { loadText, saveChoice } from "./store.js?v=a4a2142e";

const LANGUAGE_KEY = "homework-tracker.language";
const buttons = document.querySelectorAll(".language-button");

/** Before the first render: picks the language and translates the page's fixed words. */
export function startLanguage() {
  applyLanguage(pickLanguage(loadText(LANGUAGE_KEY), navigator.languages ?? [navigator.language]));
  for (const button of buttons) {
    button.addEventListener("click", () => chooseLanguage(button.dataset.language));
  }
}

function chooseLanguage(language) {
  saveChoice(LANGUAGE_KEY, language);
  applyLanguage(language);
  renderWeekdayHeadings();
  renderTypeLegend();
  render();
}

function applyLanguage(language) {
  setLanguage(language);
  setDateLocale(DATE_LOCALES[getLanguage()]);
  document.documentElement.lang = HTML_LANGS[getLanguage()];
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-placeholder]")) {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  }
  for (const element of document.querySelectorAll("[data-i18n-aria]")) {
    element.setAttribute("aria-label", t(element.dataset.i18nAria));
  }
  for (const element of document.querySelectorAll("[data-i18n-title]")) {
    element.title = t(element.dataset.i18nTitle);
  }
  for (const button of buttons) {
    button.setAttribute("aria-pressed", String(button.dataset.language === getLanguage()));
  }
  renderFormMode();
  renderShortcutList();
  // Quick add's hint (or its preview of what's typed) in the new language.
  handleQuickAddInput();
}
