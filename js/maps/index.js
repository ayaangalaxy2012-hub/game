// Map registry: single lookup for id -> map. M13: each map carries its own
// collision width, select-screen hint, and ambient particle config on top
// of the painter; the floor plane itself stays the shared GROUND_Y.
import { forest } from "./forest.js";
import { lab } from "./lab.js";
import { city } from "./city.js";

export const MAPS = Object.freeze({ forest, lab, city });
export const MAP_IDS = Object.freeze(Object.keys(MAPS));

export function pickMap(id) {
  if (id === "random") {
    const ids = MAP_IDS;
    return MAPS[ids[Math.floor(Math.random() * ids.length)]];
  }
  return MAPS[id] ?? MAPS.forest;
}
