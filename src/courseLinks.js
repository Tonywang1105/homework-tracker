// Course pages' links (Canvas, PrairieLearn, Gradescope, slides…): checking them, and combining two lists of
// them when signing in. No DOM, so it can be unit-tested with Node. Each link is { course, label, url }.

import { t } from "./i18n.js?v=29f9a5f9";
import { isWebAddress, shortLinkLabel } from "./links.js?v=29f9a5f9";

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
    return { ok: false, error: t("err.link_empty") };
  }
  const fullUrl = /^[a-z][a-z0-9+.-]*:/i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
  if (fullUrl.length > MAX_URL_LENGTH || !isWebAddress(fullUrl) || !new URL(fullUrl).hostname.includes(".")) {
    return { ok: false, error: t("err.link_bad") };
  }
  const forCourse = linksFor(existing, course);
  if (forCourse.some((link) => link.url === fullUrl)) {
    return { ok: false, error: t("err.link_dup") };
  }
  if (forCourse.length >= MAX_LINKS_PER_COURSE || existing.length >= MAX_LINKS) {
    return { ok: false, error: t("err.link_many", { n: MAX_LINKS_PER_COURSE }) };
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

/** What identifies a link across devices: its course and address (the label can be renamed). */
export function linkKey(link) {
  return `${link.course}\n${link.url}`;
}

/** Signing in on a device: the account's links, plus any this device has that the account doesn't. */
export function mergeLinks(local, remote) {
  const known = new Set(remote.map(linkKey));
  return [...remote, ...local.filter((link) => !known.has(linkKey(link)))].slice(0, MAX_LINKS);
}

/**
 * The links to show from the account's document: its links (checked as in readLinks), each once, leaving out any
 * whose key is in `removed`, the record of deleted links. That record is why a device with an older list can't bring
 * a deleted link back.
 */
export function visibleLinks(links, removed = []) {
  const gone = new Set(Array.isArray(removed) ? removed : []);
  const seen = new Set();
  return readLinks(links).filter((link) => {
    const key = linkKey(link);
    if (gone.has(key) || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * What to send when the links go from `before` (the account's, as this device last saw them) to `after`:
 * { add, drop, removedKeys, restoredKeys }. add and drop are links to put in and take out of the account's list, so a
 * rename is one of each; removedKeys are links now gone (recorded as deleted), and restoredKeys are new ones, whose
 * old deletion record is cleared so they show again. Only these changes are sent, never the whole list, so an older
 * device can't undo another's newer edits.
 */
export function linkChanges(before, after) {
  const same = (a, b) => a.course === b.course && a.url === b.url && a.label === b.label;
  const beforeKeys = new Set(before.map(linkKey));
  const afterKeys = new Set(after.map(linkKey));
  return {
    add: after.filter((link) => !before.some((old) => same(old, link))),
    drop: before.filter((old) => !after.some((link) => same(old, link))),
    removedKeys: [...beforeKeys].filter((key) => !afterKeys.has(key)),
    restoredKeys: [...afterKeys].filter((key) => !beforeKeys.has(key)),
  };
}

/**
 * This device's links joined to the account's when there's no record to compare against (a first sign-in, or a
 * device that synced before deletions were recorded): { links, changes }. The account's links, plus this device's that
 * the account has neither nor a deletion record for; nothing is removed and no deletion record is cleared, since
 * without a record a link missing here can't be told from one deleted here.
 */
export function joinLinks(local, accountLinks, removed = []) {
  const gone = new Set(removed);
  const links = mergeLinks(local.filter((link) => !gone.has(linkKey(link))), accountLinks);
  return { links, changes: linkChanges(accountLinks, links) };
}
