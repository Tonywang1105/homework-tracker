// Keeping keyboard focus through a redraw. render() replaces every row (once a minute, so "due in 3 hours" stays
// right, and whenever a sync arrives), and a replaced button takes keyboard focus with it, so the next Tab would
// start again near the top. Before a redraw, rememberFocus() notes which assignment and which of its controls had
// focus; afterwards, restoreFocus() puts focus on the same control in the new row.

/**
 * Where focus is, described so it can be found after the redraw: the list or view it's in, the assignment
 * (the nearest data-id) and the control (its data- attributes). Null when focus isn't on an assignment's row.
 */
export function rememberFocus() {
  const control = document.activeElement;
  const row = control instanceof Element ? control.closest("[data-id]") : null;
  if (!row) {
    return null;
  }
  return {
    control,
    regionId: row.parentElement?.closest("[id]")?.id ?? "",
    assignmentId: row.dataset.id,
    selector: control === row ? "" : controlSelector(control),
  };
}

/**
 * After the redraw: if the remembered control was replaced and nothing else has taken focus, focus its new copy.
 * When the row is gone (deleted, or filtered out), nothing is focused here, and the caller decides.
 */
export function restoreFocus(spot) {
  if (!spot || spot.control.isConnected || (document.activeElement && document.activeElement !== document.body)) {
    return;
  }
  const region = spot.regionId ? document.getElementById(spot.regionId) : document;
  const row = region?.querySelector(`[data-id="${CSS.escape(spot.assignmentId)}"]`);
  const target = row && spot.selector ? row.querySelector(spot.selector) : row;
  target?.focus({ preventScroll: true });
}

/** A selector for a control inside a row: its data- attributes (data-action="edit"), or else its first class. */
function controlSelector(control) {
  const attributes = [...control.attributes].filter((attribute) => attribute.name.startsWith("data-"));
  if (attributes.length > 0) {
    return attributes.map((attribute) => `[${attribute.name}="${CSS.escape(attribute.value)}"]`).join("");
  }
  return control.classList.length > 0 ? `.${CSS.escape(control.classList[0])}` : control.tagName.toLowerCase();
}
