// Which published version is running. scripts/deploy.sh adds ?v=<version> to every script's address, so a script can
// read the version from its own address. No DOM, so it can be unit-tested with Node.

/** The version in a script's address ("da81b4bb" from ".../main.js?v=da81b4bb"), or null for an unpublished copy. */
export function versionFromUrl(url) {
  try {
    const version = new URL(url).searchParams.get("v");
    return version && /^[0-9a-f]{8}$/.test(version) ? version : null;
  } catch {
    return null;
  }
}
