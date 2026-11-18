// Whether to warn that an iPhone may delete a signed-out list. iPhone browsers delete a website's saved data if the
// site isn't opened for 7 days, unless it was added to the Home Screen; signed out, that saved data is the whole list.
// No DOM, so it can be unit-tested with Node.

/** Whether the browser runs on an iPhone or iPad (an iPad says it's a Mac, but has a touch screen). */
export function isAppleMobile({ userAgent = "", maxTouchPoints = 0 } = {}) {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/**
 * Whether to show the note: on an iPhone or iPad, in the browser rather than the Home Screen app, signed out, with
 * something in the list to lose, and not dismissed with Got it.
 */
export function needsStorageNote({ appleMobile, homeScreenApp, signedIn, hasAssignments, dismissed }) {
  return appleMobile && !homeScreenApp && !signedIn && hasAssignments && !dismissed;
}
