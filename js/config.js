// Central tuning + constants. Single place for "magic numbers".
// JS concept vs Python: `export const` makes a binding importable from other
// files (like Python `from config import X`, but explicit and static).
export const VIEW_W = 960;
export const VIEW_H = 540;
// Internal pixel-art resolution of one fighter sprite (before upscale).
export const SPRITE_W = 36;
export const SPRITE_H = 52;
export const SPRITE_SCALE = 3; // 36x52 -> ~108x156 on screen. Crisp via smoothing off.
export const ARENA_W = 1600;   // world is wider than the camera view (parallax demo)
export const GROUND_Y = 452;   // gameplay plane in world/camera space
export const WALK_PREVIEW_SPEED = 220; // legacy M1 constant (kept, unused by M2 machine)

// --- M2 movement tuning. One place for all feel numbers. M7 will add
// per-character multipliers on top of these base values (no magic numbers
// scattered in fighter logic).
export const MOVE = Object.freeze({
  WALK_SPEED: 240,     // px/sec, grounded walk
  SNEAK_SPEED: 95,     // px/sec, crouch-walk (slower by design)
  AIR_CONTROL: 175,    // px/sec, horizontal drift while airborne
  JUMP_VEL: 720,       // px/sec upward at takeoff (canvas y grows downward)
  GRAVITY: 2100,       // px/sec^2, pulls airborne fighters down
  JUMP_STARTUP: 0.07,  // sec crouched on ground before leaving it (cancellable? no)
  LAND_LAG: 0.12,      // sec recovery on landing (no actions, M2 keeps it simple)
  DASH_TIME: 0.18,     // sec per dash
  DASH_FWD_SPEED: 560, // px/sec toward opponent
  DASH_BACK_SPEED: 470,// px/sec away from opponent
  TAP_WINDOW: 0.28,    // sec max gap between taps for AA / DD dash
  GUARD_RANGE: 260,    // px: holding AWAY guards inside this range, walks back
                       // outside it (max melee reach is ~145px, so no attack
                       // can land unblocked; ranged specials in M11 revisit)
  BODY_DIST: 70,       // min world px between fighters (soft pushbox, no overlap)
  ARENA_MARGIN: 60,    // wall distance from arena edges
});

export const STATE = Object.freeze({
  MENU: "MENU",
  CHAR_SELECT: "CHAR_SELECT",
  MAP_SELECT: "MAP_SELECT",
  FIGHT: "FIGHT",
});
