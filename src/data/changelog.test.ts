import { describe, expect, it } from "vitest";
import pkg from "../../package.json";
import { APP_VERSION, RELEASES } from "./changelog";

/**
 * The notes and the released version have to agree. Nothing here checks
 * wording — only that a release cannot go out claiming a version it has no
 * notes for, or show a number that is not the one that was built.
 */
describe("changelog", () => {
  it("reports the version recorded in package.json", () => {
    expect(APP_VERSION).toBe(pkg.version);
  });

  it("leads with the notes for the version being shipped", () => {
    expect(RELEASES[0].version).toBe(pkg.version);
  });

  it("lists every version once", () => {
    const seen = RELEASES.map((r) => r.version);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("runs newest first, so the panel opens on what just changed", () => {
    const dates = RELEASES.map((r) => r.date);
    expect(dates).toStrictEqual([...dates].sort().reverse());
  });

  it("dates every release in a form a browser can parse", () => {
    for (const release of RELEASES) {
      expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(release.date))).toBe(false);
    }
  });

  it("gives every release something to say", () => {
    for (const release of RELEASES) {
      expect(release.changes.length).toBeGreaterThan(0);
      for (const change of release.changes) {
        expect(change.text.trim()).not.toBe("");
      }
    }
  });
});
