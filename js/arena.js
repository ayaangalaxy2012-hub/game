// M13 runtime arena: the ACTIVE collision bounds fighters and the camera
// clamp against. Maps own their width; enterFight() installs it here.
// Python analog: a module-level dict you mutate (`arena["width"] = w`),
// NOT a frozen const — every consumer reads the live value each frame.
// GROUND_Y stays global on purpose: all three map painters draw their
// floor on that one shared gameplay plane.
import { ARENA_W, GROUND_Y } from "./config.js";

export const arena = { width: ARENA_W, groundY: GROUND_Y };

export function setArena(width = ARENA_W) {
  arena.width = width;
}

export function arenaCenter() {
  return arena.width / 2;
}
