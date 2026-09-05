import { describe, it, expect } from "vitest";
import {
  toLngLat, toLngLatList, fromLatLngTuple, boundsOf, hasCoords, pointsToFeatureCollection,
} from "./mapGeo";

describe("toLngLat", () => {
  it("puts longitude first, which is the opposite of Leaflet", () => {
    expect(toLngLat({ lat: -19.03, lng: -65.26 })).toEqual([-65.26, -19.03]);
  });

  it("does not confuse equal-looking values", () => {
    // A point where lat and lng differ in sign catches a silent swap.
    expect(toLngLat({ lat: 10, lng: -20 })).toEqual([-20, 10]);
  });
});

describe("toLngLatList", () => {
  it("keeps the order of the list and flips every pair", () => {
    expect(toLngLatList([
      { lat: 1, lng: 2 },
      { lat: 3, lng: 4 },
    ])).toEqual([[2, 1], [4, 3]]);
  });
});

describe("fromLatLngTuple", () => {
  it("reads a Leaflet-shaped tuple as lat first", () => {
    expect(fromLatLngTuple([-19.03, -65.26])).toEqual({ lat: -19.03, lng: -65.26 });
  });
});

describe("boundsOf", () => {
  it("returns southwest then northeast, each as [lng, lat]", () => {
    const b = boundsOf([
      { lat: -19, lng: -65 },
      { lat: -17, lng: -63 },
      { lat: -18, lng: -64 },
    ]);
    expect(b).toEqual([[-65, -19], [-63, -17]]);
  });

  it("returns null when there are fewer than two points, because a box needs two", () => {
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([{ lat: 1, lng: 1 }])).toBeNull();
  });

  it("ignores points at 0,0, which is how this codebase marks 'no coordinates'", () => {
    const b = boundsOf([
      { lat: -19, lng: -65 },
      { lat: 0, lng: 0 },
      { lat: -17, lng: -63 },
    ]);
    expect(b).toEqual([[-65, -19], [-63, -17]]);
  });
});

describe("hasCoords", () => {
  it("rejects 0,0, null and undefined", () => {
    expect(hasCoords({ lat: 0, lng: 0 })).toBe(false);
    expect(hasCoords(null)).toBe(false);
    expect(hasCoords(undefined)).toBe(false);
    expect(hasCoords({ lat: 0, lng: -65 })).toBe(false);
  });

  it("accepts a real pair", () => {
    expect(hasCoords({ lat: -19.03, lng: -65.26 })).toBe(true);
  });
});

describe("pointsToFeatureCollection", () => {
  it("writes each point as [lng, lat] and carries its colour and id", () => {
    const fc = pointsToFeatureCollection([
      { id: 7, lat: -19, lng: -65, color: "#DD0031", item: { name: "P7" } },
    ]);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry).toEqual({ type: "Point", coordinates: [-65, -19] });
    expect(fc.features[0].properties).toMatchObject({ id: 7, color: "#DD0031" });
  });

  it("drops points with no coordinates instead of drawing them off the coast of Africa", () => {
    const fc = pointsToFeatureCollection([
      { id: 1, lat: 0, lng: 0, color: "#000", item: null },
      { id: 2, lat: -19, lng: -65, color: "#000", item: null },
    ]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties?.id).toBe(2);
  });
});
