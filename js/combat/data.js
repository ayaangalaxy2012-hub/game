// M3 frame data: every attack's startup / active / recovery, damage, stun,
// hitstop, knockback, reach, and combo routing live HERE — never scattered
// as magic numbers in fighter logic. M7 adds per-character damage/speed
// multipliers on top; M8 re-maps animations and adds specials.
import { CHARACTERS } from "../characters/data.js";

export const BASE_HP = 100;

const base = (o) => Object.freeze({
  startup: 0.10,   // sec before the hitbox turns on (whiffable, punishable)
  active: 0.08,    // sec the hitbox is live (one hit per attack, first touch)
  recovery: 0.16,  // sec cooldown after active (whiff recovery / chain window)
  damage: 5,
  hitstun: 0.35,   // sec defender is stunned
  hitstop: 0.05,   // sec both fighters freeze on connect (impact feel)
  knockback: 260,  // px/sec initial push given to the defender
  lunge: 26,       // px attacker travels forward across startup + active
  chainTo: null,   // light-combo routing: attack id buffered into next, or null
  level: "mid",    // high | mid | low — decides which guard height stops it:
                   // stand guard stops high+mid, crouch guard stops mid+low
  blockstun: 0.25, // sec the defender is locked in BLOCKSTUN on a block
  blockPush: 320,  // px/sec shove on block (space gained, no damage)
  chip: 0,         // normals never deal chip (specials may, M10/M11)
  hit: Object.freeze({ w: 78, top: 120, h: 70 }), // hitbox size (px, above feet)
  ...o,
});

// M8 per-character normals. Wesker is a rushdown kit: quicker hands, a high
// backfist ender (cracks crouch-block), and Cobra Strike — a long lunging
// knife-hand thrust — on RMB. Homelander is a brawler: slower, heavier hits
// with a low sweep ender (cracks stand-block); his RMB is a command throw
// (the M6 grab system), so he has no heavy strike at all.
export const WESKER_BASE = Object.freeze({
  light1: base({
    startup: 0.09, active: 0.07, recovery: 0.14, damage: 5,
    hitstun: 0.32, hitstop: 0.05, knockback: 240, lunge: 24, chainTo: "light2",
    blockstun: 0.20, blockPush: 280,
  }),
  light2: base({
    startup: 0.11, active: 0.07, recovery: 0.18, damage: 6,
    hitstun: 0.38, hitstop: 0.06, knockback: 280, lunge: 28, chainTo: "light3",
    blockstun: 0.24, blockPush: 320,
  }),
  light3: base({
    startup: 0.13, active: 0.09, recovery: 0.26, damage: 8,
    hitstun: 0.48, hitstop: 0.07, knockback: 400, lunge: 32,
    level: "high", blockstun: 0.32, blockPush: 420, // backfist: stand-guard it
  }),
  heavy: base({
    startup: 0.18, active: 0.08, recovery: 0.36, damage: 15,
    hitstun: 0.62, hitstop: 0.11, knockback: 640, lunge: 55,
    level: "mid", blockstun: 0.50, blockPush: 600, // COBRA STRIKE: speed+reach
    hit: Object.freeze({ w: 88, top: 120, h: 70 }),
  }),
  // SAMURAI EDGE (E key, single press — Wesker-only): instant guard-cancel
  // / combo-burst pistol shot. Free (no rage) with i-frames through the
  // 0.14 draw, paid for with 0.40 whiff recovery. The bullet band rides HIGH
  // (ray top 150, h 40): standing foes eat it, but SNEAKERS and crouchers
  // duck clean under it — same duck-under rule as Homelander's laser, so
  // holding S beats the gun and the gun beats approaches. `ray` makes
  // hitboxOf build a hitscan band instead of a melee box (see combat.js).
  gun: base({
    startup: 0.14, active: 0.08, recovery: 0.40, damage: 7,
    hitstun: 0.45, hitstop: 0.07, knockback: 380, lunge: 0,
    level: "mid", blockstun: 0.30, blockPush: 420, chip: 2,
    ray: Object.freeze({ len: 550, top: 150, h: 40 }),
  }),
});

export const HOMELANDER_BASE = Object.freeze({
  light1: base({
    startup: 0.12, active: 0.08, recovery: 0.18, damage: 6,
    hitstun: 0.38, hitstop: 0.06, knockback: 300, lunge: 26, chainTo: "light2",
    blockstun: 0.24, blockPush: 340,
  }),
  light2: base({
    startup: 0.14, active: 0.08, recovery: 0.22, damage: 7,
    hitstun: 0.44, hitstop: 0.07, knockback: 360, lunge: 30, chainTo: "light3",
    blockstun: 0.28, blockPush: 400,
  }),
  light3: base({
    startup: 0.16, active: 0.10, recovery: 0.30, damage: 9,
    hitstun: 0.52, hitstop: 0.08, knockback: 460, lunge: 32,
    level: "low", blockstun: 0.30, blockPush: 440, // sweep: crouch-guard it
  }),
  // No heavy strike: RMB routes to the M6 grab/throw (see pressHeavy).
});

// Per-character moveset. M7 applies each fighter's tempo + power here, so
// fighter logic only ever reads finished numbers — never stat ratios.
// Stun, knockback, hitstop, reach, chain routing, and levels are identical
// for both (fairness); only the owner's frame durations and damage scale.
// Returns fresh copies so later rage/mode effects can't mutate shared data.
// JS concept vs Python: `{ ...v }` is dict unpacking (`{**v}`) — a shallow
// copy. We re-copy the nested `hit` dict too so it's fully independent.
export function movesFor(kind) {
  // M8: each fighter brings its own base table; M7 stat scaling applies over
  // whichever table the kind selects (tempo/power ratios are untouched).
  const table = kind === "homelander" ? HOMELANDER_BASE : WESKER_BASE;
  const st = CHARACTERS[kind].stats;
  const out = {};
  for (const [k, v] of Object.entries(table)) {
    out[k] = {
      ...v,
      hit: { ...v.hit },
      startup: v.startup / st.attackSpeed,
      active: v.active / st.attackSpeed,
      recovery: v.recovery / st.attackSpeed,
      damage: v.damage * st.damage,
    };
  }
  return out;
}

// Which sprite frame each attack shows per phase (windup / strike /
// follow-through). Per fighter now: indices into the painter's attack[]
// table (0 jab, 1 kick, 2 cross, 3 overhead-raise, 4 windup, 5 slam,
// 6 palm, 7 elbow, 8 backfist, 9 cobra, 10 hook, 11 sweep, 12 SAMURAI EDGE).
export const FRAME_FOR = Object.freeze({
  wesker: Object.freeze({
    light1: Object.freeze({ startup: 4, active: 6, recovery: 6 }),
    light2: Object.freeze({ startup: 4, active: 7, recovery: 7 }),
    light3: Object.freeze({ startup: 4, active: 8, recovery: 8 }),
    heavy: Object.freeze({ startup: 4, active: 9, recovery: 9 }),
    gun: Object.freeze({ startup: 4, active: 12, recovery: 12 }), // draw -> level
  }),
  homelander: Object.freeze({
    light1: Object.freeze({ startup: 4, active: 0, recovery: 0 }),
    light2: Object.freeze({ startup: 4, active: 10, recovery: 10 }),
    light3: Object.freeze({ startup: 4, active: 11, recovery: 11 }),
  }),
});

// M9 rage economy. Three levels (0-3), 100 points each. Gains are tuned so
// roughly seven landed strikes fill a level; blocking pays the defender a
// little extra (defense stays viable); whiffs pay nothing. M10/M11 abilities
// spend levels through fighter.spendRage() — costs live with each ability.
export const RAGE = Object.freeze({
  MAX: 300,
  PER_LEVEL: 100,
  onDealHit: 14,   // attacker lands a strike
  onTakeHit: 10,   // defender eats a strike
  onDealBlock: 8,  // attacker gets guarded
  onTakeBlock: 12, // defender guards successfully
});
// M6 grab/throw data. Timing IS the triangle: grab startup (0.12) is slower
// than jab startup (0.10), so a strike started together lands first and
// stuffs the grab (attack beats grab). The grab itself never consults guard
// (grab beats block). Homelander's RMB throw (M8) will reuse this system.
export const GRAB = Object.freeze({
  startup: 0.12,  // hittable wind-up (no armor — strikes interrupt it)
  active: 0.08,   // seizure window (checks every frame, forgiving)
  recover: 0.35,  // whiff recovery (long — punish the empty grab)
  carry: 0.28,    // victim held at arm's length before the toss
  toss: 0.18,     // follow-through after launch
  range: 95,      // px from attacker center (body gap is 70 — must exceed it)
  lunge: 14,      // small step-in across startup + active
  damage: 12,     // dealt at the toss, not the catch
  knockback: 520, // launch slide
  tossUp: 300,    // launch pop (victim goes airborne, lands in LAND)
  stun: 0.55,     // hitstun applied on launch
});

// M10 Wesker specials (Jaguar Charge / Phantom Combo / Rage Mode). Costs are
// rage LEVELS (paid through spendRage). maxRange gates the fire — no
// cross-screen supers; out-of-range presses fizzle without spending.
export const WESKER_SPECIALS = Object.freeze({
  jaguar: Object.freeze({
    cost: 1, maxRange: 500,
    startup: 0.22, dashTime: 0.25, dashSpeed: 1050, recover: 0.30,
    damage: 18, chip: 3, hitstun: 0.50, hitstop: 0.08, knockback: 650,
    blockstun: 0.40, blockPush: 550,
    hit: Object.freeze({ w: 80, top: 120, h: 72 }),
  }),
  phantom: Object.freeze({
    cost: 2, maxRange: 420,
    openTime: 0.12, strikeTime: 0.10, gapTime: 0.14, recover: 0.35,
    frames: Object.freeze([6, 7, 8, 9, 5]), // palm, elbow, backfist, cobra, slam
    sides: Object.freeze([1, -1, 1, -1, 1]), // teleport side per hit (vs foe)
    hit: Object.freeze({ w: 76, top: 125, h: 75 }),
    hits: Object.freeze([
      Object.freeze({ damage: 5, stun: 0.35, knock: 150, stop: 0.05, chip: 1 }),
      Object.freeze({ damage: 5, stun: 0.35, knock: 150, stop: 0.05, chip: 1 }),
      Object.freeze({ damage: 5, stun: 0.35, knock: 150, stop: 0.05, chip: 1 }),
      Object.freeze({ damage: 7, stun: 0.40, knock: 250, stop: 0.06, chip: 1 }),
      Object.freeze({ damage: 12, stun: 0.70, knock: 600, stop: 0.12, chip: 3, launch: 350 }),
    ]),
  }),
  ragemode: Object.freeze({
    cost: 3, maxRange: 500,
    // Rework: longer apotheosis. 1s unmasking, six black-afterimage frenzy
    // passes (5 each, guardable mids), then Wesker leaps skyward and calls
    // a 30-ton missile onto the victim's position (35, blockable for 8,
    // dashable while it falls). Total ~65 — the whole lifebar trembles.
    transform: 1.00, strikeTime: 0.10, gapTime: 0.12, recoverAbort: 0.35,
    frames: Object.freeze([6, 7, 8, 9, 6, 7]),
    sides: Object.freeze([1, -1, 1, -1, 1, -1]),
    hit: Object.freeze({ w: 76, top: 125, h: 75 }),
    frenzy: Object.freeze({ damage: 5, stun: 0.32, knock: 120, stop: 0.04, chip: 1 }),
    rise: 0.45, aim: 0.30, drop: 0.55, recover: 0.45,
    missile: 35, missileChip: 8, missileStun: 0.60, missileStop: 0.18,
    missileKnock: 500, missileDown: 700,
  }),
});

// M11 Homelander specials (Quick Laser / Sonic Scream / Rage Mode).
export const HOMELANDER_SPECIALS = Object.freeze({
  // Hitscan eye beam at head height: thin + high, so crouchers (even
  // crouch-guarding) duck clean under it — stand guard to stop it.
  laser: Object.freeze({
    cost: 1, maxRange: 900,
    startup: 0.18, fire: 0.12, recover: 0.35,
    damage: 14, chip: 4, hitstun: 0.50, hitstop: 0.08, knockback: 400,
    blockstun: 0.35, blockPush: 450, level: "high",
    beamTop: 140, beamH: 14, beamLen: 700,
  }),
  // Point-blank scream: hits BOTH sides, huge shove, tall enough to catch
  // jumpers — but a dash clears the 150px radius.
  scream: Object.freeze({
    cost: 2, maxRange: 300,
    startup: 0.30, active: 0.25, recover: 0.40,
    damage: 20, chip: 5, hitstun: 0.60, hitstop: 0.10, knockback: 700,
    blockstun: 0.45, blockPush: 600, level: "mid",
    radius: 150, top: 160,
  }),
  // Flying execution: unblockable cinematic seize (a 3-bar grab), lift,
  // four laser ticks (5 each) with bleeding, then a 10-dmg ground slam.
  ragemode: Object.freeze({
    cost: 3, maxRange: 400,
    ascend: 0.60, carry: 0.50, lase: 0.80, recover: 0.40,
    tick: 5, ticks: 4, finale: 10, launchDown: 900,
  }),
});
