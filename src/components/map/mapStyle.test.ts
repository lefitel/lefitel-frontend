import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { styleForTheme, MAP_STYLE_LIGHT, MAP_STYLE_DARK } from "./mapStyle";

const PUBLIC_DIR = join(__dirname, "..", "..", "..", "public");

/** Reads a style the way the browser would, from what `public/` will serve. */
function readStyle(publicPath: string) {
  const raw = readFileSync(join(PUBLIC_DIR, publicPath), "utf8");
  return { raw, style: JSON.parse(raw) };
}

describe("styleForTheme", () => {
  it("uses the dark style only for the dark theme", () => {
    expect(styleForTheme("dark")).toBe(MAP_STYLE_DARK);
    expect(styleForTheme("light")).toBe(MAP_STYLE_LIGHT);
  });

  it("falls back to light for anything it does not know", () => {
    expect(styleForTheme("")).toBe(MAP_STYLE_LIGHT);
    expect(styleForTheme("system")).toBe(MAP_STYLE_LIGHT);
  });
});

describe("the shipped styles", () => {
  it("exist where the app asks for them", () => {
    for (const path of [MAP_STYLE_LIGHT, MAP_STYLE_DARK]) {
      expect(() => readStyle(path)).not.toThrow();
    }
  });

  it("take their tiles from OpenFreeMap and carry no API key", () => {
    for (const path of [MAP_STYLE_LIGHT, MAP_STYLE_DARK]) {
      const { raw, style } = readStyle(path);
      const urls = Object.values(style.sources as Record<string, { url?: string; tiles?: string[] }>)
        .flatMap((s) => [s.url, ...(s.tiles ?? [])])
        .filter((u): u is string => typeof u === "string");

      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) expect(url).toMatch(/^https:\/\/tiles\.openfreemap\.org\//);
      // A key smuggled into any URL — glyphs, sprite, a source — is the failure
      // that sent us here in the first place.
      expect(raw).not.toMatch(/[?&](key|token|access_token|apikey)=/i);
    }
  });

  it("keeps the dark style dark", () => {
    const { style } = readStyle(MAP_STYLE_DARK);
    const background = style.layers.find((l: { id: string }) => l.id === "background");
    const lightness = /hsl\(\s*\d+\s*,\s*\d+%\s*,\s*(\d+)%/.exec(
      background.paint["background-color"],
    );
    expect(lightness).not.toBeNull();
    expect(Number(lightness![1])).toBeLessThan(20);
  });

  it("differs from the light style only in colour", () => {
    const light = readStyle(MAP_STYLE_LIGHT).style;
    const dark = readStyle(MAP_STYLE_DARK).style;
    const shape = (s: { layers: { id: string; type: string; layout?: unknown; filter?: unknown }[] }) =>
      s.layers.map((l) => ({ id: l.id, type: l.type, layout: l.layout, filter: l.filter }));

    expect(shape(dark)).toEqual(shape(light));
  });
});
