// M10 Wesker special implementations (M11 adds Homelander's here).
// Each special is a small scripted machine on f.special scratch:
// { phase, t, i, struck, struckThis, acc, frame, }. Frames are assigned as
// canvases every tick; fighter.currentFrame just shows f.special.frame.
// Camera trauma goes out through f.camKick (main.js drains it like contact).
import { WESKER_SPECIALS, HOMELANDER_SPECIALS } from "./data.js";
import { resolveStrike, Hitstop } from "./combat.js";
import { clampArena } from "../physics.js";
import { Sparks, Clones, Beams, Missiles } from "../effects.js";
import { AudioFX } from "../audio.js";
import { GROUND_Y } from "../config.js";
import { arena } from "../arena.js";

function endSpecial(f) {
  // Homelander's rage flight leaves y; snap exact ground on exit.
  if (f.special && f.special.airborne) {
    f.y = GROUND_Y;
    f.vy = 0;
    f.grounded = true;
  }
  f.state = "IDLE";
  f.specialId = null;
  f.special = null;
}

// Shared burst entry: EVERY super fires INSTANTLY from (almost) any state —
// mid-swing, mid-dash, mid-jump, guard, sneak, grounded stun. Only refused:
// KO'd, already mid-super, or physically held/holding (GRAB/THROWN — a
// body lock beats meter). Costs + range leash still apply: out-of-range
// presses fizzle WITHOUT spending. Air activations snap to the ground first
// (supers are grounded cinematics; SPECIAL skips gravity, so this avoids a
// hang-in-air bug). Normal-attack and stun leftovers are scrubbed, and entry
// i-frames make it a true burst. Returns the spec on success, null on refusal.
function beginSpecial(f, foe, table, id) {
  const spec = table[id];
  if (!spec || f.hp <= 0) return null;
  if (f.state === "SPECIAL" || f.state === "KO" || f.state === "GRAB" || f.state === "THROWN") return null;
  if (f.rageLevel < spec.cost) return null;
  if (Math.abs(foe.x - f.x) > spec.maxRange) return null;
  if (!f.spendRage(spec.cost)) return null;
  // Land first: an air super becomes a grounded one on the spot.
  f.y = GROUND_Y;
  f.vy = 0;
  f.grounded = true;
  // Scrub whatever we interrupt: swings, chains, stun slides.
  f.attackId = null;
  f.phase = null;
  f.chainQueued = false;
  f.rayFired = false;
  f.hasHit = false;
  f.knockVX = 0;
  f.stateT = 0;
  f.attackDir = f.facing;
  f.state = "SPECIAL";
  f.specialId = id;
  f.special = { phase: null, t: 0, i: 0, struck: false, struckThis: false, acc: 0, frame: null };
  f.invulnT = Math.max(f.invulnT, 0.35); // burst i-frames on entry
  return spec;
}

// Entry gates: Wesker-only (M10), rage paid up front, and a maxRange leash.
// State is NOT gated — neutral, guard, dash, sneak, jump, stun, mid-swing
// all fire (see beginSpecial); out-of-range presses fizzle WITHOUT spending.
export function tryWeskerSpecial(f, id, foe) {
  if (f.kind !== "wesker") return false;
  const spec = beginSpecial(f, foe, WESKER_SPECIALS, id);
  if (!spec) return false;
  f.attackDir = f.facing;
  f.state = "SPECIAL";
  f.specialId = id;
  const first = id === "jaguar" ? "startup" : id === "phantom" ? "open" : "transform";
  const t0 = id === "jaguar" ? spec.startup : id === "phantom" ? spec.openTime : spec.transform;
  f.special = { phase: first, t: t0, i: 0, struck: false, struckThis: false, acc: 0, frame: null };
  if (id === "ragemode") AudioFX.powerup(); // transformation sting on entry
  return true;
}

export function updateSpecial(f, foe, dt) {
  if (f.kind === "wesker" && f.specialId) {
    if (f.specialId === "jaguar") updateJaguar(f, foe, dt);
    else if (f.specialId === "phantom") updatePhantom(f, foe, dt);
    else updateRageMode(f, foe, dt);
    return;
  }
  if (f.kind === "homelander" && f.specialId) {
    if (f.specialId === "laser") updateLaser(f, foe, dt);
    else if (f.specialId === "scream") updateScream(f, foe, dt);
    else updateHRage(f, foe, dt);
    return;
  }
  endSpecial(f); // unknown kit: never strand in SPECIAL
}

// --- Jaguar Charge: coil, then an invulnerable driving tackle ---------------
function jaguarMove(spec) {
  return {
    damage: spec.damage, hitstun: spec.hitstun, knockback: spec.knockback,
    hitstop: spec.hitstop, level: "mid", blockstun: spec.blockstun,
    blockPush: spec.blockPush, chip: spec.chip, hit: spec.hit,
  };
}

function updateJaguar(f, foe, dt) {
  const spec = WESKER_SPECIALS.jaguar;
  const s = f.special;
  const A = f.sprites;
  s.t -= dt;
  if (s.phase === "startup") {
    s.frame = A.attack[4]; // coiled windup (hittable — stuff it here)
    if (s.t <= 0) {
      s.phase = "dash";
      s.t = spec.dashTime;
      s.struckThis = false;
      // Exact-px travel budget (M7 lunge precedent): frame quantization must
      // never extend a super's reach past its nominal 262.5px.
      s.distLeft = spec.dashSpeed * spec.dashTime;
      s.acc = 0; // violet trail timer (see dash branch)
      f.invulnT = spec.dashTime + 0.05; // untouchable once driving
      AudioFX.whoosh();
      Sparks.puff(f.x, f.y - 60);
      Clones.spawn(f.currentFrame(), f.x, f.y, f.facing, 0.3);
    }
  } else if (s.phase === "dash") {
    s.frame = A.special[0]; // tackle (dedicated M10 art)
    const want = Math.min(spec.dashSpeed * dt, s.distLeft);
    f.x += f.attackDir * want;
    s.distLeft -= want;
    clampArena(f);
    // Purple phantom-flame trail while driving.
    s.acc += dt;
    while (s.acc >= 0.04) {
      s.acc -= 0.04;
      Sparks.violet(f.x - f.attackDir * 30, f.y - 40 - Math.random() * 60);
    }
    if (!s.struckThis) {
      const contact = resolveStrike(f, foe, jaguarMove(spec));
      if (contact) {
        s.struckThis = true;
        f.camKick = Math.max(f.camKick, 0.35);
      }
    }
    if (s.t <= 0) {
      s.phase = "recover";
      s.t = spec.recover;
      f.invulnT = Math.min(f.invulnT, 0.05);
      Sparks.puff(f.x, f.y - 40);
    }
  } else {
    s.frame = A.dash[0]; // skate-out follow-through
    if (s.t <= 0) endSpecial(f);
  }
}

// --- Phantom Combo: five teleport strikes, alternating sides ----------------
function phantomMove(spec, i) {
  const h = spec.hits[i];
  return {
    damage: h.damage, hitstun: h.stun, knockback: h.knock, hitstop: h.stop,
    // Short guard lock (0.15) vs the 0.24 strike rhythm: a held guard
    // recovers between teleport hits, so blocking the super costs chip,
    // not the full combo. Dropping guard mid-string still gets opened.
    level: "mid", blockstun: 0.15, blockPush: 200, chip: h.chip, hit: spec.hit,
  };
}

function phantomBlink(f, foe, i) {
  const spec = WESKER_SPECIALS.phantom;
  // Afterimage stays where we stood; violet fire marks where we arrive.
  Clones.spawn(f.currentFrame(), f.x, f.y, f.facing, 0.35);
  Sparks.puff(f.x, f.y - 80); // vanish...
  AudioFX.whoosh(); // M14: each blink has a rush
  f.x = foe.x + spec.sides[i] * 58;
  clampArena(f);
  f.attackDir = foe.x >= f.x ? 1 : -1;
  f.facing = f.attackDir;
  Sparks.puff(f.x, f.y - 80); // ...reappear striking
  for (let k = 0; k < 3; k++) Sparks.violet(f.x + (Math.random() - 0.5) * 40, f.y - 40 - Math.random() * 60);
  f.special.frame = f.sprites.attack[spec.frames[i]];
  f.special.struckThis = false;
}

function updatePhantom(f, foe, dt) {
  const spec = WESKER_SPECIALS.phantom;
  const s = f.special;
  s.t -= dt;
  if (s.phase === "open") {
    s.frame = f.sprites.attack[4];
    f.invulnT = 1.9; // whole sequence is untouchable (paid 2 bars)
    if (s.t <= 0) {
      s.i = 0;
      phantomBlink(f, foe, 0);
      s.phase = "strike";
      s.t = spec.strikeTime;
    }
  } else if (s.phase === "strike") {
    if (!s.struckThis) {
      const contact = resolveStrike(f, foe, phantomMove(spec, s.i));
      if (contact) {
        s.struckThis = true;
        s.struck = true;
        const last = s.i === spec.hits.length - 1;
        if (last) {
          // Finale launches (clean hits only — guards just shove).
          if (contact.type === "hit" && foe.hp > 0) {
            foe.vy = -spec.hits[s.i].launch;
            foe.grounded = false;
          }
          f.camKick = Math.max(f.camKick, 0.6);
        }
      }
    }
    if (s.t <= 0) {
      if (s.i === 0 && !s.struck) {
        s.phase = "recover"; // opening whiffed: abort the super, eat recovery
        s.t = spec.recover;
      } else if (s.i >= spec.hits.length - 1) {
        s.phase = "recover";
        s.t = spec.recover;
      } else {
        s.phase = "gap";
        s.t = spec.gapTime;
      }
    }
  } else if (s.phase === "gap") {
    if (s.t <= 0) {
      s.i += 1;
      phantomBlink(f, foe, s.i);
      s.phase = "strike";
      s.t = spec.strikeTime;
    }
  } else {
    s.frame = f.sprites.attack[spec.frames[Math.min(s.i, spec.frames.length - 1)]];
    if (s.t <= 0) endSpecial(f);
  }
}

// --- Rage Mode REWORK: unmask (1s) -> six black-afterimage frenzy passes
// (5 each, guardable) -> skyward leap -> 30-ton missile dive (35). ~4s,
// ~65 total, invulnerable throughout. Blocking the frenzy (6 chip) buys
// the space to dash clear of the locked missile target — eat it standing
// and the crater is yours.
function rageFrenzyMove(spec) {
  const h = spec.frenzy;
  return {
    damage: h.damage, hitstun: h.stun, knockback: h.knock, hitstop: h.stop,
    // Short guard lock vs the 0.22 strike rhythm (phantom lesson): held
    // guard recovers between passes instead of stun-trapping into full.
    level: "mid", blockstun: 0.15, blockPush: 200, chip: h.chip, hit: spec.hit,
  };
}

function rageMissileMove(spec) {
  return {
    damage: spec.missile, hitstun: spec.missileStun, knockback: spec.missileKnock,
    hitstop: spec.missileStop, level: "mid", blockstun: 0.50, blockPush: 600,
    chip: spec.missileChip, hit: { w: 120, top: 140, h: 100 },
  };
}

function rageBlink(f, foe, i) {
  const spec = WESKER_SPECIALS.ragemode;
  // Black silhouette stays where he stood; red fire marks where he arrives.
  Clones.spawn(f.currentFrame(), f.x, f.y, f.facing, 0.45, "shadow");
  Sparks.puff(f.x, f.y - 80);
  f.x = foe.x + spec.sides[i] * 62;
  clampArena(f);
  f.attackDir = foe.x >= f.x ? 1 : -1;
  f.facing = f.attackDir;
  Sparks.puff(f.x, f.y - 80);
  Sparks.ember(f.x, f.y - 60);
  Sparks.ember(f.x, f.y - 100);
  f.special.frame = f.sprites.attack[spec.frames[i]];
  f.special.struckThis = false;
}

function updateRageMode(f, foe, dt) {
  const spec = WESKER_SPECIALS.ragemode;
  const s = f.special;
  const A = f.sprites;
  s.t -= dt;
  if (s.phase === "transform") {
    s.frame = A.special[1]; // unmasked, burning eyes
    f.invulnT = 5.2; // whole apotheosis (~4s) is untouchable (paid 3 bars)
    Sparks.ember(f.x + (Math.random() - 0.5) * 60, f.y - Math.random() * 120);
    Sparks.ember(f.x + (Math.random() - 0.5) * 60, f.y - Math.random() * 120);
    s.acc += dt;
    if (s.acc >= 0.22) {
      s.acc = 0;
      Sparks.puff(f.x, f.y - 80);
      f.camKick = Math.max(f.camKick, 0.3);
    }
    if (s.t <= 0) {
      s.i = 0;
      rageBlink(f, foe, 0);
      s.phase = "strike";
      s.t = spec.strikeTime;
    }
  } else if (s.phase === "strike") {
    if (!s.struckThis) {
      const contact = resolveStrike(f, foe, rageFrenzyMove(spec));
      if (contact) {
        s.struckThis = true;
        s.struck = true;
      }
    }
    if (s.t <= 0) {
      if (s.i === 0 && !s.struck) {
        s.phase = "recover"; // opening whiffed: abort, eat recovery
        s.t = spec.recoverAbort;
      } else if (s.i >= spec.frames.length - 1) {
        s.phase = "rise"; // frenzy done: LEAP for the missile run
        s.t = spec.rise;
        AudioFX.powerup();
        Clones.spawn(f.currentFrame(), f.x, f.y, f.facing, 0.5, "shadow");
      } else {
        s.phase = "gap";
        s.t = spec.gapTime;
      }
    }
  } else if (s.phase === "gap") {
    if (s.t <= 0) {
      s.i += 1;
      rageBlink(f, foe, s.i);
      s.phase = "strike";
      s.t = spec.strikeTime;
    }
  } else if (s.phase === "rise") {
    // Skyward leap with a black clone left at liftoff.
    const k = 1 - Math.max(0, s.t) / spec.rise;
    f.y = GROUND_Y - 280 * k;
    s.frame = A.jump[0];
    f.invulnT = Math.max(f.invulnT, 0.3);
    if (s.t <= 0) {
      s.phase = "aim";
      s.t = spec.aim;
      s.tx = foe.x; // missile target LOCKED (leave and it misses!)
      // Flight spans aim+drop so the crater blooms exactly on impact.
      Missiles.launch(s.tx, GROUND_Y, spec.aim + spec.drop);
      AudioFX.whoosh();
      s.frame = A.attack[3]; // arm raised, calling it down
    }
  } else if (s.phase === "aim") {
    // Hang at apex, tracking nothing — the missile already knows.
    f.y = GROUND_Y - 280 + Math.sin(s.t * 18) * 6;
    s.frame = A.attack[3];
    f.invulnT = Math.max(f.invulnT, 0.3);
    if (s.t <= 0) {
      s.phase = "drop";
      s.t = spec.drop;
    }
  } else if (s.phase === "drop") {
    // Dive WITH the missile: plummet home in the tackle pose.
    const k = 1 - Math.max(0, s.t) / spec.drop;
    f.y = GROUND_Y - 280 + 280 * k;
    s.frame = A.special[0];
    f.invulnT = Math.max(f.invulnT, 0.3);
    Sparks.ember(f.x, f.y - 60);
    if (s.t <= 0) {
      // IMPACT on the locked target — boxed, so guards and dodges count.
      f.y = GROUND_Y;
      const box = { x: s.tx - 60, y: GROUND_Y - 140, w: 120, h: 140 };
      const contact = resolveStrike(f, foe, rageMissileMove(spec), box);
      if (contact && contact.type === "hit" && foe.hp > 0) {
        foe.vy = spec.missileDown; // crater bounce: slammed THROUGH the floor
        foe.grounded = false;
      }
      AudioFX.hit();
      AudioFX.boom(); // M14.5: the crater gets its own body
      f.camKick = Math.max(f.camKick, 1.0);
      Sparks.puff(s.tx, GROUND_Y - 40);
      // M14.5 bigger crater FX: wide primary shockwave + second higher wave,
      // twin hit stars, gore only on a clean hit, denser ember column.
      Sparks.ring(s.tx, GROUND_Y - 60, 260);
      Sparks.ring(s.tx, GROUND_Y - 110, 170);
      Sparks.hit(s.tx, GROUND_Y - 90, 1);
      Sparks.hit(s.tx, GROUND_Y - 90, -1);
      if (contact && contact.type === "hit") Sparks.blood(s.tx, GROUND_Y - 80);
      for (let e = 0; e < 14; e++) Sparks.ember(s.tx + (Math.random() - 0.5) * 120, GROUND_Y - Math.random() * 80);
      s.phase = "recover";
      s.t = spec.recover;
    }
  } else {
    s.frame = A.idle[0];
    f.y = GROUND_Y;
    if (s.t <= 0) endSpecial(f);
  }
}

// --- Homelander: Quick Laser / Sonic Scream / Rage Mode ---------------------
// Slot mapping lives in fighter.trySpecial (Space/F/O == s1/s2/s3 for both
// kits); here the ids are Homelander's own: laser / scream / ragemode.
export function tryHomelanderSpecial(f, id, foe) {
  if (f.kind !== "homelander") return false;
  if (id === "ragemode" && (!foe.grounded || foe.hp <= 0)) return false;
  const spec = beginSpecial(f, foe, HOMELANDER_SPECIALS, id);
  if (!spec) return false;
  f.attackDir = f.facing;
  f.state = "SPECIAL";
  f.specialId = id;
  const first = id === "laser" ? "startup" : id === "scream" ? "startup" : "ascend";
  const t0 = id === "laser" ? spec.startup : id === "scream" ? spec.startup : spec.ascend;
  f.special = { phase: first, t: t0, i: 0, struck: false, struckThis: false, acc: 0, tickAcc: 0, tickN: 0, frame: null };
  if (id === "ragemode") {
    // Cinematic seize: an unblockable 3-bar grab — the victim is flown.
    f.special.airborne = true;
    foe.takeGrabbed(f);
    foe.holdT = 3.0;
    foe.x = f.x + f.attackDir * 50;
    f.invulnT = 3.0;
    AudioFX.powerup();
  }
  return true;
}

function laserMove(spec) {
  return {
    damage: spec.damage, hitstun: spec.hitstun, knockback: spec.knockback,
    hitstop: spec.hitstop, level: spec.level, blockstun: spec.blockstun,
    blockPush: spec.blockPush, chip: spec.chip, hit: { w: 0, top: 0, h: 0 },
  };
}

function updateLaser(f, foe, dt) {
  const spec = HOMELANDER_SPECIALS.laser;
  const s = f.special;
  const A = f.sprites;
  s.t -= dt;
  if (s.phase === "startup") {
    s.frame = A.special[2]; // eyes kindling (vulnerable — stuff the laser)
    if (s.t <= 0) {
      s.phase = "fire";
      s.t = spec.fire;
      s.struckThis = false;
      const eyeY = f.y - 130;
      const x1 = f.x + f.attackDir * 12;
      const x2 = Math.max(0, Math.min(arena.width, f.x + f.attackDir * spec.beamLen));
      Beams.spawn(x1, eyeY, x2, eyeY, spec.fire + 0.02);
      AudioFX.zap();
      f.camKick = Math.max(f.camKick, 0.2);
    }
  } else if (s.phase === "fire") {
    s.frame = A.special[2];
    if (!s.struckThis) {
      // Hitscan ray at head height: thin + high, so crouchers duck under it.
      const eyeY = f.y - 130;
      const x1 = f.x + f.attackDir * 12;
      const x2 = Math.max(0, Math.min(arena.width, f.x + f.attackDir * spec.beamLen));
      const ray = { x: Math.min(x1, x2), y: eyeY - spec.beamH / 2, w: Math.abs(x2 - x1), h: spec.beamH };
      const contact = resolveStrike(f, foe, laserMove(spec), ray);
      if (contact) {
        s.struckThis = true;
        if (contact.type === "hit") Sparks.blood(foe.x, eyeY);
      }
    }
    if (s.t <= 0) {
      s.phase = "recover";
      s.t = spec.recover;
    }
  } else {
    s.frame = A.idle[0];
    if (s.t <= 0) endSpecial(f);
  }
}

function screamMove(spec) {
  return {
    damage: spec.damage, hitstun: spec.hitstun, knockback: spec.knockback,
    hitstop: spec.hitstop, level: spec.level, blockstun: spec.blockstun,
    blockPush: spec.blockPush, chip: spec.chip, hit: { w: 0, top: 0, h: 0 },
  };
}

function updateScream(f, foe, dt) {
  const spec = HOMELANDER_SPECIALS.scream;
  const s = f.special;
  const A = f.sprites;
  s.t -= dt;
  if (s.phase === "startup") {
    s.frame = A.special[3]; // chest swells, head back (interrupt me here)
    if (s.t <= 0) {
      s.phase = "active";
      s.t = spec.active;
      s.struckThis = false;
      AudioFX.roar();
      Sparks.ring(f.x, f.y - 80, spec.radius);
      f.camKick = Math.max(f.camKick, 0.5);
    }
  } else if (s.phase === "active") {
    s.frame = A.special[3];
    if (!s.struckThis) {
      // Omnidirectional burst: shove direction is AWAY from Homelander,
      // so attackDir tracks this hit (facing stays put — the scream has
      // no "front").
      const dir = foe.x >= f.x ? 1 : -1;
      f.attackDir = foe.x === f.x ? f.attackDir : dir;
      const zone = { x: f.x - spec.radius, y: f.y - spec.top, w: spec.radius * 2, h: spec.top };
      const contact = resolveStrike(f, foe, screamMove(spec), zone);
      if (contact) {
        s.struckThis = true;
        Sparks.ring(f.x, f.y - 80, spec.radius * 0.6);
      }
    }
    if (s.t <= 0) {
      s.phase = "recover";
      s.t = spec.recover;
    }
  } else {
    s.frame = A.idle[0];
    if (s.t <= 0) endSpecial(f);
  }
}

function updateHRage(f, foe, dt) {
  const spec = HOMELANDER_SPECIALS.ragemode;
  const s = f.special;
  const A = f.sprites;
  s.t -= dt;
  if (s.phase === "ascend") {
    // Rise with the victim dangling in front (shadow stays grounded).
    const k = 1 - Math.max(0, s.t) / spec.ascend;
    f.y = GROUND_Y - 110 * k;
    foe.x = f.x + f.attackDir * 50;
    foe.y = f.y - 10;
    s.frame = A.special[2]; // eyes ignite
    f.invulnT = Math.max(f.invulnT, 0.3);
    foe.holdT = Math.max(foe.holdT, 0.5);
    if (s.t <= 0) {
      s.phase = "carry";
      s.t = spec.carry;
      AudioFX.powerup();
    }
  } else if (s.phase === "carry") {
    // Hover, bobbing, while the beam charges.
    f.y = GROUND_Y - 110 + Math.sin(s.t * 20) * 5;
    foe.x = f.x + f.attackDir * 50;
    foe.y = f.y - 10;
    s.frame = A.special[2];
    f.invulnT = Math.max(f.invulnT, 0.3);
    foe.holdT = Math.max(foe.holdT, 0.5);
    Sparks.ember(f.x - f.attackDir * 20, f.y - 120);
    if (s.t <= 0) {
      s.phase = "lase";
      s.t = spec.lase;
      s.tickAcc = 0;
      s.tickN = 0;
    }
  } else if (s.phase === "lase") {
    // Flickering beam + bleeding ticks straight into the held victim.
    foe.x = f.x + f.attackDir * 50;
    foe.y = f.y - 10;
    s.frame = A.special[2];
    f.invulnT = Math.max(f.invulnT, 0.3);
    foe.holdT = Math.max(foe.holdT, 0.5);
    // Tick schedule on phase-elapsed time (not an accumulator): all four
    // ticks land inside the window even with frame quantization.
    const elapsed = spec.lase - Math.max(0, s.t);
    if (s.tickN < spec.ticks && elapsed + 1e-9 >= (s.tickN + 1) * (spec.lase / spec.ticks)) {
      const eyeY = f.y - 130;
      Beams.spawn(f.x + f.attackDir * 12, eyeY, foe.x, foe.y - 100, 0.18);
      AudioFX.zap();
      f.camKick = Math.max(f.camKick, 0.15);
      if (foe.hp > 0) {
        foe.hp = Math.max(0, foe.hp - spec.tick);
        Sparks.blood(foe.x, foe.y - 100);
        if (foe.hp <= 0) foe.state = "KO";
        else Hitstop.t = Math.max(Hitstop.t, 0.03);
      }
      s.tickN += 1;
    }
    if (s.t <= 0) {
      s.phase = "slam";
      s.t = 0.12;
      s.struckThis = false;
    }
  } else if (s.phase === "slam") {
    s.frame = A.special[3]; // hurl-down with the whole body
    if (!s.struckThis) {
      s.struckThis = true;
      const dir = foe.x >= f.x ? 1 : -1;
      foe.takeHit({ damage: spec.finale, hitstun: 0.7, knockback: 300 }, dir);
      foe.vy = spec.launchDown; // straight down: crater landing
      foe.grounded = false;
      AudioFX.hit();
      f.camKick = Math.max(f.camKick, 0.8);
      Sparks.puff(foe.x, GROUND_Y - 20);
    }
    if (s.t <= 0) {
      s.phase = "recover";
      s.t = spec.recover;
    }
  } else {
    // Settle back to the ground as the mode ends.
    f.y += (GROUND_Y - f.y) * Math.min(1, dt * 6);
    s.frame = A.idle[0];
    if (s.t <= 0) endSpecial(f);
  }
}
