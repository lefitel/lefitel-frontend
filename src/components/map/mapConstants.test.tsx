import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { MAP_DOT, MAP_RADIUS, MAP_WEIGHT, SUBJECT_PAINT, dotDiameter } from "./mapConstants";
import MapPoint from "./MapPoint";
import { SonarMarker } from "./SonarMarker";

vi.mock("@vis.gl/react-maplibre", () => ({
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

describe("the three ranks of dot on a map", () => {
  it("puts the subject above the ends of the stretch, and those above its other poles", () => {
    // The pole a screen was about measured 14 px across beside neighbours of 15
    // and cities of 16: the smallest dot on its own map.
    const subject = dotDiameter(MAP_RADIUS.main, MAP_WEIGHT.main);
    const city = dotDiameter(MAP_RADIUS.endpoint, MAP_WEIGHT.secondary);
    const pole = dotDiameter(MAP_RADIUS.secondary, MAP_WEIGHT.secondary);

    // By enough to read as a rank, not by the half pixel it used to be.
    expect(subject - city).toBeGreaterThanOrEqual(3);
    expect(city - pole).toBeGreaterThanOrEqual(3);
  });

  it("holds even against the thickest border a screen gives a lesser dot", () => {
    // The pole form draws the stretch's poles with a 1.5 border, and the cities
    // with none: the widest and the narrowest any of them gets.
    const subject = dotDiameter(MAP_RADIUS.main, MAP_WEIGHT.main);
    expect(subject).toBeGreaterThan(dotDiameter(MAP_RADIUS.endpoint, 1.5));
    expect(dotDiameter(MAP_RADIUS.endpoint, 0)).toBeGreaterThanOrEqual(dotDiameter(MAP_RADIUS.secondary, 1.5));
  });
});

describe("what a radius means", () => {
  /** The box a dot really takes: its declared size, plus the border when it is outside. */
  const across = (el: HTMLElement): number => {
    const size = parseFloat(el.style.width);
    const border = parseFloat(el.style.borderWidth || el.style.border);
    return el.style.boxSizing === "content-box" ? size + 2 * border : size;
  };

  it("is the same size in both components that draw a dot", () => {
    // They disagreed: `MapPoint` put the border outside the radius and
    // `SonarMarker`, under the page's `border-box`, inside. One number, two
    // sizes — which is how the subject ended up the small one.
    const point = render(
      <MapPoint center={{ lat: 1, lng: 2 }} radius={8} strokeWidth={1.5} fillColor="#000" />,
    ).container.querySelector("span") as HTMLElement;
    const sonar = render(
      <SonarMarker center={[1, 2]} fillColor="#000" strokeColor="#fff" rgb="0, 0, 0" dotRadius={8} weight={1.5} />,
    ).container.querySelector(".sonar-dot") as HTMLElement;

    expect(across(point)).toBe(dotDiameter(8, 1.5));
    expect(across(sonar)).toBe(dotDiameter(8, 1.5));
  });
});

describe("the quiet dots follow the theme", () => {
  // Two greys picked against the light map, written into five screens. On the
  // dark map the cities all but vanished and the stretch's poles went dim.
  const css = readFileSync(path.resolve(__dirname, "..", "..", "index.css"), "utf8");
  const block = (selector: string): string => {
    const start = css.indexOf(`  ${selector} {`);
    return css.slice(start, css.indexOf("\n  }", start));
  };
  const valueOf = (text: string, token: string): string | undefined =>
    text.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1].trim();

  it("each has a value in both themes, and not the same one", () => {
    for (const token of ["--map-endpoint", "--map-pole", "--map-pole-fill", "--map-subject", "--map-subject-rgb"]) {
      const light = valueOf(block(":root"), token);
      const dark = valueOf(block(".dark"), token);
      expect(light, `${token} en claro`).toBeTruthy();
      expect(dark, `${token} en oscuro`).toBeTruthy();
      expect(dark, token).not.toBe(light);
    }
  });

  it("the canvas copy of the subject blue is the stylesheet's, in both themes", () => {
    // One map paints on the canvas and cannot read the token, so the colour is
    // written twice. This is what stops the two from drifting.
    expect(valueOf(block(":root"), "--map-subject")).toBe(SUBJECT_PAINT.light);
    expect(valueOf(block(".dark"), "--map-subject")).toBe(SUBJECT_PAINT.dark);
  });

  it("every name the screens use is one the stylesheet defines", () => {
    for (const value of Object.values(MAP_DOT)) {
      const token = value.match(/^var\((--[\w-]+)\)$/)?.[1];
      expect(token, value).toBeTruthy();
      expect(css).toContain(`${token}:`);
    }
  });

  it("no screen goes back to writing one of the old greys on a dot", () => {
    const SRC = path.resolve(__dirname, "..", "..");
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return walk(full);
        return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [full] : [];
      });
    const offenders = walk(SRC).filter((file) =>
      /(?:fillColor|strokeColor)="#(?:374151|9ca3af|1e293b)"/i.test(readFileSync(file, "utf8")));

    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});

describe("the screens that put dots on a map", () => {
  // Every size on a map comes from the scale. A literal is how the cities were
  // a 7 beside a subject of 7 and nobody saw the rank had gone.
  const SRC = path.resolve(__dirname, "..", "..");
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return sources(full);
      return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [full] : [];
    });

  it("take the subject's size from the scale, never from a number of their own", () => {
    const offenders = sources(SRC).filter((file) =>
      /dotRadius=\{(?!MAP_RADIUS\.)/.test(readFileSync(file, "utf8")));

    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it("draw nothing larger than the subject on a map that has one", () => {
    const largest = MAP_RADIUS.main;
    const offenders: string[] = [];
    for (const file of sources(SRC)) {
      const text = readFileSync(file, "utf8");
      if (!text.includes("<SonarMarker")) continue;
      for (const [, value] of text.matchAll(/\bradius=\{(\d+(?:\.\d+)?)\}/g)) {
        if (Number(value) >= largest) offenders.push(`${path.relative(SRC, file)}: radius={${value}}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
