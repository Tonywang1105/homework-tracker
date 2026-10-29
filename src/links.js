// Finding web links in a note, so they can be shown as clickable links, and shortening them for display.

// A link starts with http:// or https:// and runs to the next space. Anything else stays plain text,
// so a note can never become a link that runs code (such as "javascript:").
const LINK_PATTERN = /https?:\/\/[^\s<>"]+/g;
// Punctuation that usually ends the sentence, not the link: "see https://cs124.org." or "(https://cs124.org)".
const TRAILING_PUNCTUATION = /[.,;:!?'"]+$/;
// Labels longer than this are shortened to the site and the first part of the path.
const MAX_LABEL_LENGTH = 32;
const MAX_SEGMENT_LENGTH = 20;

/**
 * Splits a note into plain text and links, in order:
 * "Slides: https://cs124.org/x" becomes [{ text: "Slides: " }, { url: "https://cs124.org/x", label: "cs124.org/x" }].
 */
export function splitLinks(note) {
  const parts = [];
  let textStart = 0;
  for (const match of note.matchAll(LINK_PATTERN)) {
    const url = trimLink(match[0]);
    if (!isWebAddress(url)) {
      continue;
    }
    if (match.index > textStart) {
      parts.push({ text: note.slice(textStart, match.index) });
    }
    parts.push({ url, label: shortLinkLabel(url) });
    textStart = match.index + url.length;
  }
  if (textStart < note.length) {
    parts.push({ text: note.slice(textStart) });
  }
  return parts;
}

/**
 * A short label for a link: without "https://" and "www.", and, if still long, cut to the site and
 * the first part of the path, as in "cs124.org/lessons/…".
 */
export function shortLinkLabel(url) {
  const { hostname, pathname, search, hash } = new URL(url);
  const site = hostname.replace(/^www\./, "");
  const full = `${site}${pathname}${search}${hash}`.replace(/\/$/, "");
  if (full.length <= MAX_LABEL_LENGTH) {
    return full;
  }
  const firstSegment = pathname.split("/").find((segment) => segment !== "") ?? "";
  if (firstSegment === "") {
    return `${site}/…`;
  }
  const shortSegment =
    firstSegment.length > MAX_SEGMENT_LENGTH ? `${firstSegment.slice(0, MAX_SEGMENT_LENGTH)}…` : `${firstSegment}/…`;
  return `${site}/${shortSegment}`;
}

/** Drops sentence punctuation from the end, and a closing bracket the link didn't open. */
function trimLink(link) {
  let trimmed = link.replace(TRAILING_PUNCTUATION, "");
  while (trimmed.endsWith(")") && count(trimmed, "(") < count(trimmed, ")")) {
    trimmed = trimmed.slice(0, -1).replace(TRAILING_PUNCTUATION, "");
  }
  return trimmed;
}

function count(text, character) {
  return text.split(character).length - 1;
}

export function isWebAddress(text) {
  try {
    const { protocol, hostname } = new URL(text);
    return (protocol === "https:" || protocol === "http:") && hostname !== "";
  } catch {
    return false;
  }
}
