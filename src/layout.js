// The adjustable split between the form and the To do list on wide screens.
// No DOM, so it can be unit-tested with Node. styles.css applies the same limits with clamp().

export const DEFAULT_FORM_WIDTH = 360;
export const MIN_FORM_WIDTH = 260;
// The To do side keeps at least this much room, so the calendar stays usable.
export const MIN_LIST_WIDTH = 440;
// How far one arrow-key press moves the divider.
export const KEYBOARD_STEP = 20;

/** The form width to use for a requested one, kept inside the limits for the space available. */
export function clampFormWidth(requested, availableWidth) {
  const largest = Math.max(MIN_FORM_WIDTH, availableWidth - MIN_LIST_WIDTH);
  return Math.round(Math.min(Math.max(requested, MIN_FORM_WIDTH), largest));
}

/** A saved width read back from storage, or null if there isn't a usable one. */
export function parseSavedWidth(saved) {
  const width = Number(saved);
  return saved !== null && Number.isFinite(width) && width > 0 ? width : null;
}
