/**
 * Regenerates the street plan the public page's showcase draws its map on.
 *
 *   node scripts/build-landing-map.mjs              (fetches from Overpass)
 *   node scripts/build-landing-map.mjs saved.json   (reuses an earlier response)
 *
 * A maintenance tool, not a build step, like `build-map-styles.mjs`: it needs
 * the network and its output, `src/pages/landing/parts/coroico.ts`, is
 * committed.
 *
 * ## Why a drawn plan of a real town
 *
 * The showcase used to draw a lattice of rectangles with a river through it,
 * and nobody took it for a map. The application's map is OpenStreetMap data in
 * the MapTiler Basic dark style, so the showcase now draws the same data in the
 * same colours: Coroico, where the tramo the section follows begins. It stays a
 * drawing (one SVG, no tiles fetched) so the public page makes no third-party
 * request just to decorate a section.
 *
 * The poles are not real. They are placed along the real streets every sixty
 * metres or so, which is roughly how a line is strung, and their states come
 * from a fixed seed. No street is named on the page and no pole maps to a real
 * asset, which keeps the rule in `parts/fiction.ts`: nothing real is ever shown
 * with a fault against it.
 *
 * ## Licence
 *
 * Map data (c) OpenStreetMap contributors, ODbL. The showcase prints that
 * credit on the plan itself.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "pages",
  "landing",
  "parts",
  "coroico.ts",
);

/** The plan's own coordinate space. Two to one, like the widest panel. */
const W = 840;
const H = 420;

/** Coroico's centre and the width of ground the plan covers, in metres. */
const CENTER = { lat: -16.1896, lon: -67.7264 };
const WIDTH_M = 1400;

const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LON = 111320 * Math.cos((CENTER.lat * Math.PI) / 180);
const dLon = WIDTH_M / M_PER_DEG_LON;
const dLat = WIDTH_M / 2 / M_PER_DEG_LAT;
const WEST = CENTER.lon - dLon / 2;
const NORTH = CENTER.lat + dLat / 2;

const project = ({ lat, lon }) => [((lon - WEST) / dLon) * W, ((NORTH - lat) / dLat) * H];
/** Plan units per metre, for spacing poles in real distances. */
const UNITS_PER_M = W / WIDTH_M;

const PAD = 30;
const bbox = [
  CENTER.lat - dLat / 2 - (PAD / H) * dLat,
  WEST - (PAD / W) * dLon,
  NORTH + (PAD / H) * dLat,
  WEST + dLon + (PAD / W) * dLon,
].map((v) => v.toFixed(5));

async function load() {
  const saved = process.argv[2];
  if (saved) return JSON.parse(await fs.readFile(saved, "utf8"));
  const b = `(${bbox.join(",")})`;
  const query = `[out:json][timeout:120];(way[highway]${b};way[building]${b};way[landuse]${b};way[leisure]${b};way[natural]${b};way[waterway]${b};);out geom;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      // Overpass answers 406 to requests without a User-Agent of their own.
      "User-Agent": "osefi-landing-map/1.0",
    },
    body: new URLSearchParams({ data: query }),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  return res.json();
}

// ── geometry ────────────────────────────────────────────────────────────────

/** Ramer–Douglas–Peucker, so a building is four corners and not forty. */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  let far = 0;
  let at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
    if (d > far) {
      far = d;
      at = i;
    }
  }
  if (far <= tol) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}

/**
 * A closed ring cannot go through `simplify` whole: its first and last points
 * coincide, the reference segment has no length, and every vertex measures
 * zero from it, so the shape collapses to a point. Split it at the vertex
 * farthest from the start and simplify the two halves instead.
 */
function simplifyRing(pts, tol) {
  const ring = pts.slice(0, -1);
  if (ring.length < 4) return pts;
  const [ox, oy] = ring[0];
  let at = 1;
  ring.forEach(([x, y], i) => {
    if (Math.hypot(x - ox, y - oy) > Math.hypot(ring[at][0] - ox, ring[at][1] - oy)) at = i;
  });
  const first = simplify(ring.slice(0, at + 1), tol);
  const second = simplify([...ring.slice(at), ring[0]], tol);
  return [...first.slice(0, -1), ...second];
}

const inFrame = (pts) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return Math.max(...xs) > -PAD && Math.min(...xs) < W + PAD && Math.max(...ys) > -PAD && Math.min(...ys) < H + PAD;
};

const n = (v) => Math.round(v * 10) / 10;
const toPath = (pts, closed) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${n(x)} ${n(y)}`).join("") + (closed ? "Z" : "");

// ── classification ──────────────────────────────────────────────────────────

const MAJOR = new Set(["primary", "secondary", "tertiary", "trunk"]);
const MINOR = new Set(["residential", "unclassified", "service", "living_street", "pedestrian", "track"]);
const PATH = new Set(["path", "footway", "steps", "cycleway"]);
const GREEN = new Set(["forest", "wood", "scrub", "grassland", "park", "pitch", "playground", "garden", "meadow", "orchard"]);
const FIELD = new Set(["farmland", "farmyard", "vineyard", "allotments"]);

function layerOf(tags) {
  if (tags.building) return "buildings";
  if (tags.highway) {
    if (MAJOR.has(tags.highway)) return "major";
    if (MINOR.has(tags.highway)) return "minor";
    if (PATH.has(tags.highway)) return "paths";
    return null;
  }
  if (tags.waterway) return "water";
  if (tags.natural === "water" || tags.leisure === "swimming_pool") return "pools";
  const use = tags.landuse ?? tags.leisure ?? tags.natural;
  if (use === "residential") return "residential";
  if (GREEN.has(use)) return "green";
  if (FIELD.has(use)) return "fields";
  return null;
}

// ── poles along the streets ────────────────────────────────────────────────

const seeded = (seed) => {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
};

/** Walks a street and drops a pole every `step`, a little off the kerb. */
function polesAlong(pts, step, offset) {
  const out = [];
  let carry = step / 2;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const seg = Math.hypot(bx - ax, by - ay);
    if (!seg) continue;
    const ux = (bx - ax) / seg;
    const uy = (by - ay) / seg;
    let d = carry;
    for (; d <= seg; d += step) out.push([ax + ux * d - uy * offset, ay + uy * d + ux * offset]);
    carry = d - seg;
  }
  return out;
}

async function main() {
  const data = await load();
  const layers = { fields: [], green: [], residential: [], water: [], pools: [], buildings: [], paths: [], minor: [], major: [] };
  const streets = [];

  for (const el of data.elements) {
    if (el.type !== "way" || !el.geometry) continue;
    const layer = layerOf(el.tags ?? {});
    if (!layer) continue;
    const raw = el.geometry.map(project);
    if (!inFrame(raw)) continue;
    const closed = el.nodes?.[0] === el.nodes?.[el.nodes.length - 1] && raw.length > 3;
    const line = layer === "major" || layer === "minor" || layer === "paths" || layer === "water";
    if (!line && !closed) continue;
    const tol = layer === "buildings" ? 0.25 : 0.4;
    const pts = line ? simplify(raw, tol) : simplifyRing(raw, tol);
    layers[layer].push(toPath(pts, !line));
    if (layer === "major" || (layer === "minor" && el.tags.highway !== "track"))
      streets.push({ pts, major: layer === "major" });
  }

  const rnd = seeded(20261013);
  const step = 60 * UNITS_PER_M;
  const poles = [];
  for (const { pts, major } of streets) {
    for (const [x, y] of polesAlong(pts, step, 2.4)) {
      if (x < 10 || x > W - 10 || y < 10 || y > H - 10) continue;
      if (poles.some((p) => Math.hypot(p.x - x, p.y - y) < step * 0.55)) continue;
      poles.push({ x: n(x), y: n(y), major });
    }
  }

  // States in roughly the network's own proportions: about one in eight with
  // work pending, a handful critical, the rest solved or never reported.
  for (const p of poles) {
    const r = rnd();
    p.s = r < 0.03 ? "crit" : r < 0.13 ? "warn" : r < 0.22 ? "idle" : "ok";
  }

  // The pole the section follows: the one nearest the middle of the plan that
  // stands on a main road, flagged pending like the defect it carries.
  let flagged = 0;
  let best = Infinity;
  poles.forEach((p, i) => {
    if (!p.major) return;
    const d = Math.hypot(p.x - W * 0.52, p.y - H * 0.5);
    if (d < best) {
      best = d;
      flagged = i;
    }
  });
  poles[flagged].s = "warn";
  for (const p of poles) delete p.major;

  const join = (k) => layers[k].join("");
  const sizes = Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, v.length]));

  const ts = `/**
 * Coroico, drawn. Generated by \`scripts/build-landing-map.mjs\`; do not edit.
 *
 * Map data (c) OpenStreetMap contributors, ODbL. ${WIDTH_M} m across, centred
 * on ${CENTER.lat}, ${CENTER.lon}, in an ${W} by ${H} plan. Features per layer:
 * ${JSON.stringify(sizes)}.
 *
 * The poles are invented and placed along the real streets; see the script.
 */

export const PLAN = { w: ${W}, h: ${H}, lat: ${CENTER.lat}, lon: ${CENTER.lon} } as const;

export const LAYERS = {
${Object.keys(layers)
  .map((k) => `  ${k}: ${JSON.stringify(join(k))},`)
  .join("\n")}
} as const;

export type PoleState = "crit" | "warn" | "ok" | "idle";

export const POLES: readonly { x: number; y: number; s: PoleState }[] = ${JSON.stringify(poles)};

/** Index in \`POLES\` of the pole the showcase follows. */
export const FLAGGED = ${flagged};
`;

  await fs.writeFile(OUT, ts);
  console.log(`wrote ${OUT}: ${(ts.length / 1024).toFixed(1)} KB, ${poles.length} poles`, sizes);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
