import { describe, it, expect } from "vitest";
import { styleForTheme, MAP_STYLE_LIGHT, MAP_STYLE_DARK } from "./mapStyle";

describe("styleForTheme", () => {
  it("uses the dark style only for the dark theme", () => {
    expect(styleForTheme("dark")).toBe(MAP_STYLE_DARK);
    expect(styleForTheme("light")).toBe(MAP_STYLE_LIGHT);
  });

  it("falls back to light for anything it does not know", () => {
    expect(styleForTheme("")).toBe(MAP_STYLE_LIGHT);
    expect(styleForTheme("system")).toBe(MAP_STYLE_LIGHT);
  });

  it("points at OpenFreeMap and carries no API key", () => {
    for (const url of [MAP_STYLE_LIGHT, MAP_STYLE_DARK]) {
      expect(url).toMatch(/^https:\/\/tiles\.openfreemap\.org\/styles\//);
      expect(url).not.toMatch(/key|token|api/i);
    }
  });
});
