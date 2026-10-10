// A value is not a place.
//
// `mapGeo.test.ts` covers what `hasCoords` always did — 0,0 means "not located".
// This file is about what it did not do, and about the screens that asked the
// question by hand instead of asking it.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { boundsOf, hasCoords, pointsToFeatureCollection } from "./mapGeo";

describe("hasCoords", () => {
  it("takes a pole that is somewhere", () => {
    expect(hasCoords({ lat: -22.0283, lng: -63.680898 })).toBe(true);
    expect(hasCoords({ lat: 89.9, lng: 179.9 })).toBe(true);
  });

  it("refuses the six pairs found stored", () => {
    // A decimal point lost in the typing, as they sat in the table.
    for (const lat of [-22048385017.82594, -10101630, -167426350]) {
      expect(hasCoords({ lat, lng: -63.6844 })).toBe(false);
    }
    for (const lng of [-666.668161, -652112270, -65528673]) {
      expect(hasCoords({ lat: -17.710695, lng })).toBe(false);
    }
  });

  it("refuses what is not a number", () => {
    expect(hasCoords({ lat: null, lng: null })).toBe(false);
    expect(hasCoords({})).toBe(false);
    expect(hasCoords({ lat: NaN, lng: -63 })).toBe(false);
    // Text is not a number here: the API sends numbers, and a string that
    // slipped through would be compared as text further down.
    expect(hasCoords({ lat: "-17" as unknown as number, lng: -63 })).toBe(false);
  });
});

describe("what one impossible pole no longer drags with it", () => {
  const BUENOS = [{ lat: -22.0283, lng: -63.680898 }, { lat: -22.028658, lng: -63.680992 }];
  const MALO = { lat: -22048385017.82594, lng: -63.6844 };

  it("the bounds a map is fitted to", () => {
    // With it counted, the south edge of the view was twenty-two thousand
    // million degrees away.
    expect(boundsOf([...BUENOS, MALO])).toEqual(boundsOf(BUENOS));
  });

  it("the layer the operations map draws", () => {
    const points = [...BUENOS, MALO].map((p, i) => ({ ...p, id: i, color: "#000", item: null }));
    expect(pointsToFeatureCollection(points).features).toHaveLength(2);
  });
});

describe("the screens that draw poles", () => {
  // Six files asked "is there a value" in twelve places. The function is only
  // worth having while nobody writes the old question again in a thirteenth.
  const SRC = path.resolve(__dirname, "..", "..");
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return sources(full);
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
    });

  it("ask whether a pole has a place, never merely whether it has values", () => {
    // Not `mapGeo.ts` itself, whose comment quotes the old question.
    const offenders = sources(SRC)
      .filter((file) => !file.endsWith(path.join("map", "mapGeo.ts")))
      .filter((file) => /\bp\d?\.lat\s*&&\s*p\d?\.lng\b/.test(readFileSync(file, "utf8")));

    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it("the four that ask for a road route filter before they ask", () => {
    const routed = sources(SRC).filter((file) => {
      const text = readFileSync(file, "utf8");
      return /fetchOrsRoute\(/.test(text) && !file.endsWith("orsRoute.ts");
    });

    // If this stops being four, a screen was added or removed: look at it.
    expect(routed).toHaveLength(4);
    for (const file of routed) {
      expect(readFileSync(file, "utf8"), path.relative(SRC, file)).toMatch(/\.filter\(hasCoords\)/);
    }
  });
});
