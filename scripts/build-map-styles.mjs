/**
 * Regenerates the two map styles in `public/map-styles/`.
 *
 *   node scripts/build-map-styles.mjs
 *
 * This is a maintenance tool, not a build step: it needs the network, and its
 * output is committed. Run it to pull a newer upstream style or to change the
 * dark palette, then commit the regenerated JSON.
 *
 * ## Why we ship the styles instead of linking them
 *
 * OpenFreeMap hosts the tiles and a handful of ready-made styles, but not this
 * one — and the dark twin does not exist anywhere, because every free style for
 * this tile schema is either monochrome (dark-matter) or too light to sit in a
 * dark panel (fiord). So the styles live here. They are 16 KB each, ~2 KB over
 * the wire, and the tiles still come from OpenFreeMap.
 *
 * ## Licence
 *
 * MapTiler Basic is BSD-3 (code) plus CC-BY 4.0 (design); see
 * `public/map-styles/LICENSE.md`, which travels with the styles. Nothing here
 * changes that: the dark twin only rewrites colours. Both required credits —
 * OpenMapTiles and OpenStreetMap — are rendered on the map itself, inherited
 * from the tile source's own attribution.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "map-styles");

const UPSTREAM = "https://raw.githubusercontent.com/openmaptiles/maptiler-basic-gl-style/master/style.json";
const TILES = "https://tiles.openfreemap.org/planet";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

const COPYRIGHT =
  "MapTiler Basic (c) MapTiler.com & OpenMapTiles contributors, (c) 2014 Mapbox. " +
  "Code BSD-3-Clause, design CC-BY 4.0. Recoloured for Osefi; see LICENSE.md.";

/**
 * The dark palette. Each feature keeps its hue and gets its lightness inverted,
 * so vegetation stays green and water stays blue instead of collapsing into the
 * grey that made the old dark-matter style unreadable.
 *
 * Two numbers are deliberate rather than aesthetic. The ground is dark enough to
 * sit inside the dashboard's dark panel without glowing — the reason the
 * off-the-shelf `fiord` was rejected. And the water blue is kept well away from
 * the pole marker's #596BAB, so a river never reads as a row of poles.
 */
const DARK = {
  ground: "hsl(220, 14%, 11%)",
  residential: "hsl(220, 12%, 15%)",
  landuse: "hsl(30, 10%, 16%)",
  vegetation: "hsl(126, 26%, 21%)",
  park: "hsl(98, 28%, 23%)",
  sand: "hsl(45, 22%, 24%)",
  glacier: "hsl(220, 12%, 22%)",
  water: "hsl(203, 48%, 21%)",
  waterLine: "hsl(203, 45%, 32%)",
  building: "hsl(220, 10%, 18%)",
  buildingEdge: "hsl(220, 10%, 26%)",
  rail: "hsl(220, 8%, 30%)",
  roadMinor: "hsl(220, 8%, 25%)",
  roadTunnel: "hsl(220, 8%, 20%)",
  roadMajor: "hsl(220, 9%, 36%)",
  roadMotorway: "hsl(220, 10%, 44%)",
  bridgeCase: "hsl(220, 10%, 14%)",
  admin: "hsla(0, 0%, 62%, 0.5)",
  label: "hsl(220, 14%, 78%)",
  labelStrong: "hsl(220, 16%, 92%)",
  labelDim: "hsl(220, 10%, 55%)",
  halo: "hsla(220, 16%, 8%, 0.85)",
};

/** Layer id -> the paint properties the dark twin overwrites. */
const RECOLOUR = {
  "background": { "background-color": DARK.ground },
  "landuse-residential": { "fill-color": DARK.residential },
  "landcover_grass": { "fill-color": DARK.vegetation },
  "landcover_wood": { "fill-color": DARK.vegetation },
  "water": { "fill-color": DARK.water },
  "water_intermittent": { "fill-color": DARK.water },
  "landcover-ice-shelf": { "fill-color": DARK.glacier },
  "landcover-glacier": { "fill-color": DARK.glacier },
  "landcover_sand": { "fill-color": DARK.sand },
  "landuse": { "fill-color": DARK.landuse },
  "landuse_overlay_national_park": { "fill-color": DARK.park },
  "waterway-tunnel": { "line-color": DARK.waterLine },
  "waterway": { "line-color": DARK.waterLine },
  "waterway_intermittent": { "line-color": DARK.waterLine },
  "tunnel_railway_transit": { "line-color": DARK.rail },
  "building": {
    "fill-color": DARK.building,
    "fill-outline-color": { stops: [[15, "hsla(220, 10%, 26%, 0)"], [16, DARK.buildingEdge]] },
  },
  "housenumber": { "text-color": DARK.labelDim },
  "road_area_pier": { "fill-color": DARK.ground },
  "road_pier": { "line-color": DARK.ground },
  "road_bridge_area": { "fill-color": DARK.ground },
  "road_path": { "line-color": DARK.roadMinor },
  "road_minor": { "line-color": DARK.roadMinor },
  "tunnel_minor": { "line-color": DARK.roadTunnel },
  "tunnel_major": { "line-color": DARK.roadMajor },
  "aeroway-area": { "fill-color": DARK.roadMajor },
  "aeroway-taxiway": { "line-color": DARK.roadMajor },
  "aeroway-runway": { "line-color": DARK.roadMajor },
  "road_trunk_primary": { "line-color": DARK.roadMajor },
  "road_secondary_tertiary": { "line-color": DARK.roadMajor },
  "road_major_motorway": { "line-color": DARK.roadMotorway },
  "railway-transit": { "line-color": DARK.rail },
  "railway": { "line-color": DARK.rail },
  "waterway-bridge-case": { "line-color": DARK.bridgeCase },
  "waterway-bridge": { "line-color": DARK.waterLine },
  "bridge_minor case": { "line-color": DARK.bridgeCase },
  "bridge_major case": { "line-color": DARK.bridgeCase },
  "bridge_minor": { "line-color": DARK.roadMinor },
  "bridge_major": { "line-color": DARK.roadMajor },
  "admin_sub": { "line-color": DARK.admin },
  "admin_country_z0-4": { "line-color": DARK.admin },
  "admin_country_z5-": { "line-color": DARK.admin },
  "poi_label": { "text-color": DARK.labelDim, "text-halo-color": DARK.halo },
  "airport-label": { "text-color": DARK.labelDim, "text-halo-color": DARK.halo },
  "road_major_label": { "text-color": DARK.label, "text-halo-color": DARK.halo },
  "place_label_other": { "text-color": DARK.label, "text-halo-color": DARK.halo },
  "place_label_city": { "text-color": DARK.labelStrong, "text-halo-color": DARK.halo },
  "country_label-other": { "text-color": DARK.labelStrong, "text-halo-color": DARK.halo },
  "country_label": { "text-color": DARK.labelStrong, "text-halo-color": DARK.halo },
};

const res = await fetch(UPSTREAM);
if (!res.ok) throw new Error(`No se pudo descargar el estilo original: HTTP ${res.status}`);
const upstream = await res.json();

/** The light style: upstream, pointed at tiles nobody needs a key for. */
function light() {
  const style = structuredClone(upstream);
  style.name = "Osefi Basic";
  style.metadata = { ...style.metadata, "osefi:copyright": COPYRIGHT };
  style.sources.openmaptiles = { type: "vector", url: TILES };
  style.glyphs = GLYPHS;
  // Upstream points `sprite` at a GitHub Pages site, and not one layer in this
  // style uses an icon. Dropping it removes a third-party dependency and a
  // request per map.
  delete style.sprite;
  return style;
}

/** The dark style: the light one with its colours rewritten, nothing else. */
function dark(base) {
  const style = structuredClone(base);
  style.name = "Osefi Basic Dark";

  const seen = new Set();
  for (const layer of style.layers) {
    const patch = RECOLOUR[layer.id];
    if (!patch) continue;
    seen.add(layer.id);
    layer.paint = { ...layer.paint, ...patch };
  }

  // Upstream drift is the failure that would ship silently: a renamed layer
  // leaves a light-coloured shape on a dark map, and nothing errors. Both
  // directions are checked — colours we map that no longer exist, and drawing
  // layers that appeared and have no colour of ours.
  const orphaned = Object.keys(RECOLOUR).filter((id) => !seen.has(id));
  const uncoloured = style.layers
    .filter((l) => !seen.has(l.id) && l.type !== "symbol")
    .map((l) => l.id);
  if (orphaned.length || uncoloured.length) {
    throw new Error(
      "El estilo original ha cambiado y la paleta oscura ya no le encaja.\n" +
        `  Capas del mapeo que ya no existen: ${orphaned.join(", ") || "ninguna"}\n` +
        `  Capas de dibujo sin color propio: ${uncoloured.join(", ") || "ninguna"}`,
    );
  }
  return style;
}

const styles = { "basic.json": light() };
styles["basic-dark.json"] = dark(styles["basic.json"]);

await fs.mkdir(OUT_DIR, { recursive: true });
for (const [name, style] of Object.entries(styles)) {
  const file = path.join(OUT_DIR, name);
  await fs.writeFile(file, `${JSON.stringify(style, null, 2)}\n`);
  console.log(`${name}: ${style.layers.length} capas`);
}
console.log(`Escritos en ${OUT_DIR}`);
