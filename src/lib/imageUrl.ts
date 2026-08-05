import { url } from "../api/url";

/**
 * Builds the absolute URL of a stored image.
 *
 * Two reasons this is not a template string at each call site:
 *
 * 1. **Separator.** Concatenating `${url}${path}` without a slash turns a
 *    stored value like ".attacker.tld/x.jpg" into a request to
 *    "https://our-api.example.attacker.tld/x.jpg" — a host somebody else owns.
 *    A user who can edit an event's `image` field can point the exporters at
 *    their own server that way.
 *
 * 2. **Stored formats differ.** The database holds three shapes, left by
 *    successive versions of the upload code: "/name.webp" (most rows),
 *    "images/name.jpg" (older rows) and bare "name.jpg". Only the first two
 *    resolved; roughly one photo link in eight was dead.
 */
export function imageUrl(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;

  // Strip any combination of leading slashes and legacy "images/" prefixes.
  const name = trimmed.replace(/^(?:\/+|images\/+)+/i, "");
  if (name === "") return null;

  return `${url}/${encodeURI(name)}`;
}
