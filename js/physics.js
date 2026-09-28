// Physics helpers shared by all fighters (M2).
// Kept separate from character logic so M3+ hit reactions and knockback can
// reuse the same integrators instead of copy-pasting them per character.
// JS concept vs Python: `f` is a mutable object reference — like passing a
// Python object, mutations inside these functions are visible to the caller.
import { GROUND_Y, MOVE } from "./config.js";
import { arena } from "./arena.js";

// Vertical integration for one step. Handles takeoff velocity, gravity pull,
// and ground collision + landing flag in one place.
export function integrateAir(f, dt) {
  f.y += f.vy * dt;
  f.vy += MOVE.GRAVITY * dt;
  if (f.y >= GROUND_Y) {
    f.y = GROUND_Y;
    f.vy = 0;
    f.grounded = true;
  }
}

// Hard arena walls. Called after every horizontal move. Width is the live
// per-map value (M13) — lab walls bite sooner than city walls.
export function clampArena(f) {
  f.x = Math.max(MOVE.ARENA_MARGIN, Math.min(arena.width - MOVE.ARENA_MARGIN, f.x));
}

// Soft body push: fighters can't stand inside each other. Split the overlap
// evenly so neither gets an advantage. This is positioning, not combat.
export function separate(a, b) {
  const dx = b.x - a.x;
  const overlap = MOVE.BODY_DIST - Math.abs(dx);
  if (overlap <= 0) return;
  const push = overlap / 2;
  const dir = dx >= 0 ? 1 : -1;
  a.x -= push * dir;
  b.x += push * dir;
  clampArena(a);
  clampArena(b);
}
