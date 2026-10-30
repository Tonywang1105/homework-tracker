// Course pages' links (Canvas, PrairieLearn, Gradescope, slides…): checking them, and combining two lists of
// them when signing in. No DOM, so it can be unit-tested with Node. Each link is { course, label, url }.

import { isWebAddress, shortLinkLabel } from "./links.js?v=03cdcd76";

export const MAX_LINKS_PER_COURSE = 12;
// Also the limit in firestore.rules, which keeps the synced list to one small document.
export const MAX_LINKS = 200;
const MAX_LABEL_LENGTH = 40;
const MAX_URL_LENGTH = 500;

/**
 * Checks a link typed into a course page. A missing "https://" is added ("cs124.org" works), anything that
 * isn't a web address (such as "javascript:…") is refused, and an empty label becomes a short form of the address.
 * Returns { ok: true, link } or { ok: false, error }.
 */
export function validateLink({ course, label = "", url = "" }, existing = []) {
  const trimmedUrl = url.trim();
  if (trimmedUrl === "") {
    return { ok: false, error: "Enter the link's web address." };
  }
  const fullUrl = /^[a-z][a-z0-9+.-]*:/i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
  if (fullUrl.length > MAX_URL_LENGTH || !isWebAddress(fullUrl) || !new URL(fullUrl).hostname.includes(".")) {
    return { ok: false, error: "That doesn't look like a web address. Try something like cs124.org." };
  }
  const forCourse = linksFor(existing, course);
  if (forCourse.some((link) => link.url === fullUrl)) {
    return { ok: false, error: "That link is already here." };
  }
  if (forCourse.length >= MAX_LINKS_PER_COURSE || existing.length >= MAX_LINKS) {
    return { ok: false, error: `A course can have up to ${MAX_LINKS_PER_COURSE} links. Remove one first.` };
  }
  return { ok: true, link: { course, label: cleanLabel(label, fullUrl), url: fullUrl } };
}

/** A label as typed, or a short form of the address if it's empty; at most 40 characters. */
export function cleanLabel(label, url) {
  const trimmed = label.trim().slice(0, MAX_LABEL_LENGTH);
  return trimmed === "" ? shortLinkLabel(url).slice(0, MAX_LABEL_LENGTH) : trimmed;
}

/** One course's links, in the order they were added. */
export function linksFor(links, course) {
  return links.filter((link) => link.course === course);
}

/** Saved links (from this browser or the account), keeping only ones that still look right. */
export function readLinks(saved) {
  if (!Array.isArray(saved)) {
    return [];
  }
  return saved
    .filter((link) => typeof link?.course === "string" && typeof link.label === "string" && typeof link.url === "string")
    .filter((link) => link.course !== "" && link.url.length <= MAX_URL_LENGTH && isWebAddress(link.url))
    .map(({ course, label, url }) => ({ course, label: cleanLabel(label, url), url }))
    .slice(0, MAX_LINKS);
}

/** Links saved in this browser, from their JSON text; none if missing or unreadable. */
export function parseSavedLinks(text) {
  try {
    return readLinks(JSON.parse(text ?? "[]"));
  } catch {
    return [];
  }
}

/** Signing in on a device: the account's links, plus any this device has that the account doesn't. */
export function mergeLinks(local, remote) {
  const key = (link) => `${link.course}\n${link.url}`;
  const known = new Set(remote.map(key));
  return [...remote, ...local.filter((link) => !known.has(key(link)))].slice(0, MAX_LINKS);
}
