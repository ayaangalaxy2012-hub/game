// Combat resolution: hurtboxes, hitboxes, guard checks, hitstop clock.
// Pure functions over fighter objects (duck-typed: only x, y, facing,
// attackDir, blockLow, isLow, hp, takeHit/takeBlocked are touched).
// Deliberately imports nothing from fighter.js to avoid a module cycle.
//
// JS concept vs Python: `export const Hitstop = { t: 0 }` is a shared
// MUTABLE singleton (like a module-level dict in Python). Main loop and
// fighters both read/write `Hitstop.t` — no globals keyword needed.
import { AudioFX } from "../audio.js";
import { RAGE } from "./data.js";

export const Hitstop = { t: 0 };

// Body box. Crouchers/sneakers/low-guard are shorter (M2 `isLow` flag).
export function hurtboxOf(f) {
  const h = f.isLow ? 92 : 148;
  const w = f.isLow ? 56 : 52;
  return { x: f.x - w / 2, y: f.y - h, w, h };
}

// Attack box: sits in front of the attacker along the locked attackDir.
// Moves with a `ray` (Samurai Edge bullet) are hitscan bands instead:
// they start at the shooter's center and run ray.len outward at torso
// height — longer than any melee, still blockable, still box-tested.
export function hitboxOf(att, move) {
  if (move.ray) {
    const { len, top, h } = move.ray;
    const x = att.attackDir === 1 ? att.x : att.x - len;
    return { x, y: att.y - top, w: len, h };
  }
  const { w, top, h } = move.hit;
  const cx = att.x + att.attackDir * (26 + w / 2 - 8);
  return { x: cx - w / 2, y: att.y - top, w, h };
}

export function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// M6 seizure test. Note what is NOT consulted: guard state, attack level,
// blockstun — grabs bypass all of it (grab beats block). Refused only vs
// airborne, KO'd, already-held, out-of-range, or behind the grabber.
export function grabCheck(att, def, range) {
  if (att === def || def.hp <= 0 || !def.grounded || def.invulnT > 0) return false;
  if (def.state === "THROWN" || def.state === "KO") return false;
  const dx = def.x - att.x;
  if (Math.abs(dx) > range) return false;
  if (dx !== 0 && Math.sign(dx) !== att.attackDir) return false;
  return true;
}

// Directional guard rules (M4):
// - Only a grounded BLOCK stance in the correct height guards.
// - Defender must face the threat (no cross-up blocks from behind).
// - high loses to... is stopped ONLY by stand guard; low ONLY by crouch
//   guard; mid by either. Grabs (M6) will bypass this entirely.
function isGuarding(def, att, move) {
  if (def.state !== "BLOCK" || !def.grounded) return false;
  const toward = att.x >= def.x ? 1 : -1;
  if (def.facing !== toward) return false;
  if (move.level === "low") return def.blockLow === true;
  if (move.level === "high") return def.blockLow === false;
  return true;
}

// Called once per attack while its active frames are live. Returns a contact
// report ({ type: "hit" | "block", x, y }) or null on whiff. The attacker
// stores it as lastContact so main.js can spawn impact feedback.
// Invulnerable defenders (mid-super) can't be touched at all — not even chipped.
// boxOverride replaces the melee hitbox for exotic shapes (laser rays, AoE);
// guard levels, rage, sound, and hitstop all still apply through one path.
export function resolveStrike(att, def, move, boxOverride = null) {
  if (att === def || def.hp <= 0 || def.invulnT > 0) return null;
  const box = boxOverride || hitboxOf(att, move);
  if (!overlap(box, hurtboxOf(def))) return null;
  // weight = move damage: main.js scales camera shake off it (M14).
  const contact = { x: def.x - att.attackDir * 26, y: def.y - 110, weight: move.damage ?? 5 };
  if (move.hitstop > Hitstop.t) Hitstop.t = move.hitstop;
  if (isGuarding(def, att, move)) {
    def.takeBlocked(move, att.attackDir);
    att.addRage(RAGE.onDealBlock);
    def.addRage(RAGE.onTakeBlock);
    AudioFX.block();
    att.lastContact = { type: "block", ...contact };
  } else {
    def.takeHit(move, att.attackDir);
    att.addRage(RAGE.onDealHit);
    def.addRage(RAGE.onTakeHit);
    AudioFX.hit();
    att.lastContact = { type: "hit", ...contact };
  }
  return att.lastContact;
}
