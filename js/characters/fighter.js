// M3 fighter: movement machine (M2) + combat layer.
// Attacks run startup -> active -> recovery; lights chain; hits cause
// HITSTUN + knockback; hp 0 means KO (minimal fall-over; presentation M15).
import { SPRITE_SCALE, MOVE, GROUND_Y } from "../config.js";
import { buildSprites, FEET_PAD } from "../render/sprites.js";
import { flipped } from "../render/pixel.js";
import { integrateAir, clampArena } from "../physics.js";
import { BASE_HP, FRAME_FOR, movesFor, GRAB, RAGE } from "../combat/data.js";
import { resolveStrike, grabCheck } from "../combat/combat.js";
import { tryWeskerSpecial, tryHomelanderSpecial, updateSpecial } from "../combat/specials.js";
import { AudioFX } from "../audio.js";
import { Sparks } from "../effects.js";
import { CHARACTERS } from "./data.js";

// Samurai Edge i-frames (sec): untouchable through the draw and into the
// shot — same burst convention as the specials (cf. specials.js 0.3s pops).
const EDGE_IFRAMES = 0.25;

export const FState = Object.freeze({
  IDLE: "IDLE",
  WALK: "WALK",
  CROUCH: "CROUCH",
  SNEAK: "SNEAK",
  JUMP: "JUMP",
  FALL: "FALL",
  LAND: "LAND",
  DASH: "DASH",
  BACKDASH: "BACKDASH",
  ATTACK: "ATTACK",   // startup / active / recovery sub-phases (this.phase)
  SPECIAL: "SPECIAL", // scripted super (see combat/specials.js, this.special)
  GRAB: "GRAB",       // startup / active / carry / toss|recover (this.phase)
  THROWN: "THROWN",   // seized: grabber positions us until the toss
  BLOCK: "BLOCK",     // directional guard: hold AWAY (S+AWAY = crouch guard)
  HITSTUN: "HITSTUN", // control lost; knockback slide
  BLOCKSTUN: "BLOCKSTUN", // guarded hit: no damage, pushback slide, chip later
  KO: "KO",           // minimal M3 fall-over; rounds/presentation are M15
});

export class Fighter {
  constructor(kind, x, y) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.vy = 0;
    this.grounded = true;
    this.facing = 1;
    this.state = FState.IDLE;
    this.stateT = 0;
    this.dashDir = 1;
    this.animTime = Math.random() * 10;
    // Movement intents (main.js):
    this.moving = 0;
    this.crouchHeld = false;
    this.blockHeld = false; // edge-free hold: AWAY from opponent (computed in drive)
    this.blockLow = false;  // true while crouch-guarding (S + AWAY)
    this.jumpQueued = false;
    this.dashQueued = 0;
    this.lastContact = null; // combat report for main.js feedback ({type,x,y})
    // Combat:
    // M7 stats: health sizes the bar; moveSpeed pre-scales every locomotion
    // speed into one table (jump arc, gravity, and feel-timings stay shared
    // on purpose — both fighters jump identically). Attack tempo + damage
    // arrive already scaled inside movesFor(); grabs stay unscaled for both.
    const st = CHARACTERS[kind].stats;
    this.maxHp = Math.round(BASE_HP * st.health);
    this.hp = this.maxHp;
    this.moves = movesFor(kind);
    this.speeds = {
      walk: MOVE.WALK_SPEED * st.moveSpeed,
      sneak: MOVE.SNEAK_SPEED * st.moveSpeed,
      air: MOVE.AIR_CONTROL * st.moveSpeed,
      dashFwd: MOVE.DASH_FWD_SPEED * st.moveSpeed,
      dashBack: MOVE.DASH_BACK_SPEED * st.moveSpeed,
    };
    this.attackId = null;
    this.phase = null; // "startup" | "active" | "recovery"
    this.phaseT = 0;
    this.attackDir = 1; // facing locked at attack start (no mid-swing turns)
    this.hasHit = false;
    this.chainQueued = false; // buffered light press for the combo chain
    this.knockVX = 0;
    this.victim = null; // seized foe during GRAB carry (positioned each frame)
    this.heldBy = null; // grabber holding us during THROWN (safety-checked)
    this.holdT = 0;     // THROWN safety timeout — never stuck if hold breaks
    // M9 rage: starts empty (0/300), three levels of 100. M10/M11 abilities
    // spend levels through spendRage(); gains arrive via addRage() from
    // strikes, blocks, and throws (see combat.js + GRAB toss below).
    this.rage = 0;
    this.rageFlash = 0; // level-up celebration timer (HUD reads it)
    // M10 specials: scripted state (id + per-use scratch in this.special),
    // brief invulnerability windows, and a camera-kick outbox for main.js.
    this.specialId = null;
    this.special = null;
    this.invulnT = 0;
    this.camKick = 0;
    this.sprites = buildSprites(kind);
  }

  get w() { return 36 * SPRITE_SCALE; }
  get h() { return 52 * SPRITE_SCALE; }

  get isLow() {
    if (this.state === FState.CROUCH || this.state === FState.SNEAK) return true;
    if (this.state === FState.BLOCK) return this.blockLow; // low guard ducks too
    return false;
  }

  // Proximity guard: holding AWAY only raises guard at fighting range —
  // farther out the same hold walks back (retreat footwork). Blocking stays
  // directional (AWAY must be held); range just decides guard vs walk.
  nearFoe(other) {
    return Math.abs(other.x - this.x) <= MOVE.GUARD_RANGE;
  }

  get attackMove() { return this.attackId ? this.moves[this.attackId] : null; }

  get rageLevel() {
    return Math.min(3, Math.floor(this.rage / RAGE.PER_LEVEL));
  }

  // Gain rage (clamped). Trips a HUD flash + M14 chime on a new level.
  addRage(n) {
    const before = this.rageLevel;
    this.rage = Math.max(0, Math.min(RAGE.MAX, this.rage + n));
    if (this.rageLevel > before) {
      this.rageFlash = 0.6;
      AudioFX.levelUp();
    }
    return this.rage;
  }

  // Pay `levels` of rage for a special ability. Returns false (and pays
  // nothing) when the meter is short — callers must check before firing.
  spendRage(levels) {
    if (this.rageLevel < levels) return false;
    this.rage = Math.max(0, this.rage - levels * RAGE.PER_LEVEL);
    return true;
  }

  faceOpponent(other) {
    this.facing = other.x >= this.x ? 1 : -1;
  }

  queueJump() { this.jumpQueued = true; }
  queueDash(screenDir) { this.dashQueued = screenDir; }

  // LMB-equivalent. From neutral starts light1; mid-combo buffers the chain.
  pressLight() {
    if (this.hp <= 0) return;
    if (this.state === FState.ATTACK) {
      const mv = this.attackMove;
      if (mv && mv.chainTo && (this.phase === "active" || this.phase === "recovery")) {
        this.chainQueued = true; // LMB+LMB(+LMB) chain, one stage per press
      }
      return;
    }
    if (this.grounded && (this.state === FState.IDLE || this.state === FState.WALK || this.state === FState.CROUCH)) {
      this.startAttack("light1");
    }
  }

  // RMB-equivalent. Wesker: Cobra Strike (fast lunging heavy). Homelander:
  // command throw — his RMB routes into the M6 grab system, so he has no
  // heavy strike at all (pressGrab carries the same neutral gates).
  pressHeavy() {
    if (this.hp <= 0) return;
    if (this.kind === "homelander") {
      this.pressGrab();
      return;
    }
    if (this.state !== FState.ATTACK && this.grounded &&
      (this.state === FState.IDLE || this.state === FState.WALK || this.state === FState.CROUCH)) {
      this.startAttack("heavy");
    }
  }

  // M6 grab. Same neutral gates as strikes (no grabbing from guard/stun/air)
  // but resolves through grabCheck, which ignores blocking entirely.
  pressGrab() {
    if (this.hp <= 0) return;
    if (this.grounded &&
      (this.state === FState.IDLE || this.state === FState.WALK || this.state === FState.CROUCH)) {
      this.attackDir = this.facing;
      this.state = FState.GRAB;
      this.phase = "startup";
      this.phaseT = GRAB.startup;
      this.lungeLeft = GRAB.lunge;
      this.victim = null;
    }
  }

  // SAMURAI EDGE — WESKER-ONLY firearm (E key, single press).
  // Identity gate FIRST and absolute: Homelander (or any future kind) can
  // never enter this path, so his E safely falls back to pressHeavy (grab).
  // Built to feel instant, like a 3-bar super:
  // - fires from grounded neutral (IDLE/WALK/CROUCH/SNEAK/LAND), from BLOCK
  //   (guard-cancel), from DASH/BACKDASH (dash-cancel), and as a BURST out
  //   of HITSTUN/BLOCKSTUN (grounded only — launched victims stay helpless);
  // - cancels ANY in-progress swing (any normal at any phase — mid-combo,
  //   mid-Cobra, anything that isn't the gun itself);
  // - grants i-frames through the draw (EDGE_IFRAMES), so it beats the thing
  //   that was about to hit you instead of trading with it.
  // Never restarts the gun itself (spam guard). Air, grabs, specials, KO:
  // refuse.
  trySamuraiEdge() {
    if (this.kind !== "wesker") return false; // WESKER-ONLY, first and absolute
    if (this.hp <= 0 || !this.grounded) return false;
    if (this.state === FState.ATTACK) {
      if (this.attackId === "gun") return false; // spam guard: never restart
      this.fireGun();
      return true;
    }
    switch (this.state) {
      case FState.IDLE:
      case FState.WALK:
      case FState.CROUCH:
      case FState.SNEAK:
      case FState.BLOCK: // guard-cancel: shoot straight out of a block
      case FState.DASH:
      case FState.BACKDASH:
      case FState.LAND:
      case FState.HITSTUN: // burst: break out of getting comboed
      case FState.BLOCKSTUN: // burst: break out of chip pressure
        this.fireGun();
        return true;
      default:
        return false;
    }
  }

  // Shared ignition: enters the gun, raises i-frames through the draw, and
  // cuts any inherited slide so a stun-burst truly breaks the combo instead
  // of sliding through its own shot.
  fireGun() {
    this.startAttack("gun");
    this.invulnT = Math.max(this.invulnT, EDGE_IFRAMES);
    this.knockVX = 0;
    this.chainQueued = false;
  }

  // Seized by a grabber: attack (if any) is interrupted, control is gone
  // until the toss converts us to airborne HITSTUN (or the safety times out).
  takeGrabbed(grabber) {
    this.attackId = null;
    this.phase = null;
    this.chainQueued = false;
    this.specialId = null;
    this.special = null;
    this.victim = null;
    this.knockVX = 0;
    this.state = FState.THROWN;
    this.heldBy = grabber;
    this.holdT = 0.8;
  }

  // M10/M11 special entry (Space/F/O slots; P2 mirror ;/'/P). Each kit maps
  // the shared slots to its own ids — Homelander's Space is a laser, not a
  // jaguar. Gates + rage payment live in specials.js.
  trySpecial(id, foe) {
    if (this.kind === "wesker") return tryWeskerSpecial(this, id, foe);
    if (this.kind === "homelander") {
      const map = { jaguar: "laser", phantom: "scream", ragemode: "ragemode" };
      return tryHomelanderSpecial(this, map[id] || id, foe);
    }
    return false;
  }

  startAttack(id) {
    this.attackId = id;
    this.attackDir = this.facing;
    this.state = FState.ATTACK;
    this.phase = "startup";
    this.phaseT = this.moves[id].startup;
    this.lungeLeft = this.moves[id].lunge; // exact-px travel budget (see below)
    this.hasHit = false;
    this.rayFired = false; // ray moves (gun) crack the muzzle once per shot
    this.chainQueued = false;
  }

  // Incoming hit. Interrupts everything (including our own attack) and pays
  // out damage / stun / knockback from the attack's frame data.
  takeHit(move, dir) {
    this.hp = Math.max(0, this.hp - move.damage);
    this.attackId = null;
    this.phase = null;
    this.chainQueued = false;
    this.specialId = null; // specials interrupt like strikes do
    this.special = null;
    this.victim = null;
    if (this.hp <= 0) {
      this.state = FState.KO;
      this.knockVX = 0;
      if (this.grounded) this.vy = 0;
      return;
    }
    this.state = FState.HITSTUN;
    this.stateT = move.hitstun;
    this.knockVX = dir * move.knockback;
  }

  // Guarded hit (M4): stance and height already verified by combat.js.
  // No damage from normals (chip reserved for specials, M10/M11), but the
  // defender is locked in BLOCKSTUN and shoved. Interrupts own attack too.
  takeBlocked(move, dir) {
    this.attackId = null;
    this.phase = null;
    this.chainQueued = false;
    this.specialId = null;
    this.special = null;
    this.victim = null;
    const chip = move.chip || 0;
    if (chip > 0) {
      this.hp = Math.max(0, this.hp - chip);
      if (this.hp <= 0) {
        this.state = FState.KO;
        this.knockVX = 0;
        if (this.grounded) this.vy = 0;
        return;
      }
    }
    this.state = FState.BLOCKSTUN;
    this.stateT = move.blockstun;
    this.knockVX = dir * move.blockPush;
  }

  land() {
    this.state = FState.LAND;
    this.stateT = MOVE.LAND_LAG;
    AudioFX.land(); // M14: boots-on-deck thud...
    Sparks.dust(this.x, GROUND_Y); // ...and the dirt it kicks up
  }

  update(dt, opponent) {
    // Committed states never turn mid-way (no mid-swing / mid-stun turns).
    // BLOCK tracks facing (a jump-over can cross you up); stuns, grabs,
    // victims, and specials don't (scripts set facing explicitly).
    if (
      this.state !== FState.ATTACK &&
      this.state !== FState.SPECIAL &&
      this.state !== FState.GRAB &&
      this.state !== FState.THROWN &&
      this.state !== FState.HITSTUN &&
      this.state !== FState.BLOCKSTUN &&
      this.state !== FState.KO
    ) {
      this.faceOpponent(opponent);
    }
    this.animTime += dt;
    if (this.rageFlash > 0) this.rageFlash -= dt;
    if (this.invulnT > 0) this.invulnT -= dt;
    const wantJump = this.jumpQueued;
    const wantDash = this.dashQueued;
    this.jumpQueued = false;
    this.dashQueued = 0;

    const startDash = () => {
      const toward = opponent.x >= this.x ? 1 : -1;
      if (wantDash === toward) {
        this.state = FState.DASH;
        this.dashDir = toward;
      } else {
        this.state = FState.BACKDASH;
        this.dashDir = -toward;
      }
      this.stateT = MOVE.DASH_TIME;
      AudioFX.whoosh(); // M14: burst off the line
      Sparks.dust(this.x, GROUND_Y);
    };

    switch (this.state) {
      case FState.ATTACK: {
        const mv = this.attackMove;
        this.phaseT -= dt;
        if (this.phase === "startup" || this.phase === "active") {
          // Forward lunge, spread over startup + active — clamped to the exact
          // px budget so faster tempos never gain extra reach from rounding.
          const want = (mv.lunge / (mv.startup + mv.active)) * dt;
          const step = Math.min(want, this.lungeLeft);
          this.x += this.attackDir * step;
          this.lungeLeft -= step;
          if (this.phase === "active" && mv.ray && !this.rayFired) {
            this.rayFired = true; // one crack per shot: muzzle flash + report
            AudioFX.shot();
            Sparks.muzzle(this.x + this.attackDir * 51, this.y - 130, this.attackDir);
          }
          if (this.phase === "active" && !this.hasHit) {
            const contact = resolveStrike(this, opponent, mv);
            if (contact) this.hasHit = true; // one swing, one touch (hit OR block)
          }
        }
        if (this.phaseT <= 0) {
          if (this.phase === "startup") {
            this.phase = "active";
            this.phaseT = mv.active;
          } else if (this.phase === "active") {
            if (!this.hasHit) AudioFX.whiff(); // M14: swung at nothing
            this.phase = "recovery";
            this.phaseT = mv.recovery;
          } else if (this.chainQueued && mv.chainTo) {
            this.startAttack(mv.chainTo); // seamless combo link
          } else {
            this.attackId = null;
            this.phase = null;
            this.state = FState.IDLE;
          }
        }
        break;
      }
      case FState.HITSTUN:
      case FState.BLOCKSTUN: {
        // Shared slide: friction on the ground, gravity carry in the air.
        // (Only grounded guards can block, so air BLOCKSTUN shouldn't happen
        // — the branch below handles it anyway instead of crashing.)
        this.stateT -= dt;
        this.x += this.knockVX * dt;
        if (this.grounded) {
          // Ground friction bleeds the slide (exponential damp).
          this.knockVX *= Math.exp(-8 * dt);
          if (Math.abs(this.knockVX) < 5) this.knockVX = 0;
        } else {
          integrateAir(this, dt); // launched mid-jump: keep falling
        }
        if (this.stateT <= 0) {
          this.knockVX = 0;
          if (!this.grounded) {
            // Expired mid-air -> keep falling as FALL.
            this.state = FState.FALL;
          } else if (this.blockHeld && this.nearFoe(opponent)) {
            // Still holding AWAY in range -> straight back to guard.
            this.state = FState.BLOCK;
            this.blockLow = this.crouchHeld;
          } else {
            this.state = FState.IDLE;
          }
        }
        break;
      }
      case FState.KO: {
        if (!this.grounded) integrateAir(this, dt); // crumple to the ground
        break;
      }
      case FState.SPECIAL: {
        updateSpecial(this, opponent, dt); // scripted super (specials.js)
        break;
      }
      case FState.GRAB: {
        // Startup (hittable) -> active seizure window -> carry the victim ->
        // toss (damage + launch) or whiff recovery. Direction locked throughout.
        this.phaseT -= dt;
        const grabStep = Math.min((GRAB.lunge / (GRAB.startup + GRAB.active)) * dt, this.lungeLeft);
        if (this.phase === "startup") {
          this.x += this.attackDir * grabStep;
          this.lungeLeft -= grabStep;
          if (this.phaseT <= 0) {
            this.phase = "active";
            this.phaseT = GRAB.active;
          }
        } else if (this.phase === "active") {
          this.x += this.attackDir * grabStep;
          this.lungeLeft -= grabStep;
          if (grabCheck(this, opponent, GRAB.range)) {
            this.victim = opponent;
            opponent.takeGrabbed(this);
            AudioFX.grab();
            this.phase = "carry";
            this.phaseT = GRAB.carry;
          } else if (this.phaseT <= 0) {
            this.phase = "recover"; // whiffed: stand there regretting it
            this.phaseT = GRAB.recover;
            AudioFX.whiff(); // M14: grabbed a ghost
          }
        } else if (this.phase === "carry") {
          // Drag the victim at arm's length, slightly lifted off the ground.
          if (this.victim) {
            this.victim.x = this.x + this.attackDir * 44;
            this.victim.y = Math.min(this.victim.y, GROUND_Y - 26);
          }
          if (this.phaseT <= 0) {
            // Toss: pay damage + launch through the stun/air pipeline.
            // Throws build rage like strikes (deal + take rates).
            if (this.victim) {
              const vx = this.victim.x, vy = this.victim.y - 90; // pre-toss pos
              this.victim.takeHit(
                { damage: GRAB.damage, hitstun: GRAB.stun, knockback: GRAB.knockback },
                this.attackDir
              );
              this.victim.vy = -GRAB.tossUp;
              this.victim.grounded = false;
              this.addRage(RAGE.onDealHit);
              this.victim.addRage(RAGE.onTakeHit);
              Sparks.blood(vx, vy); // M14: the throw lands with a spray
              this.victim = null;
            }
            AudioFX.hit();
            this.camKick = Math.max(this.camKick, 0.3); // M14: toss shakes cam
            this.phase = "toss";
            this.phaseT = GRAB.toss;
          }
        } else { // "toss" follow-through / "recover" whiff — both committed
          if (this.phaseT <= 0) {
            this.phase = null;
            this.victim = null;
            this.state = FState.IDLE;
          }
        }
        break;
      }
      case FState.THROWN: {
        // Positioned by the grabber each frame; the safety below guarantees
        // we can never be stuck here if the hold breaks unexpectedly.
        // (Cinematic supers hold through SPECIAL too — see M11 rage modes.)
        this.holdT -= dt;
        if (this.holdT <= 0 || !this.heldBy ||
          (this.heldBy.state !== FState.GRAB && this.heldBy.state !== FState.SPECIAL)) {
          this.heldBy = null;
          this.state = FState.IDLE;
        }
        break;
      }
      case FState.BLOCK: {
        // Guard stance: height follows S every frame (stand <-> crouch guard).
        // Jump and dash can cancel guard. Releasing AWAY — or leaving guard
        // range — drops guard and routes to neutral on the spot (no flicker).
        this.blockLow = this.crouchHeld;
        if (wantJump) {
          this.state = FState.JUMP;
          this.stateT = MOVE.JUMP_STARTUP;
        } else if (wantDash) {
          startDash();
        } else if (!this.grounded || !this.blockHeld || !this.nearFoe(opponent)) {
          if (this.crouchHeld) {
            this.state = this.moving !== 0 ? FState.SNEAK : FState.CROUCH;
          } else {
            this.state = this.moving !== 0 ? FState.WALK : FState.IDLE;
          }
        }
        break;
      }
      case FState.JUMP: {
        if (this.grounded) {
          this.stateT -= dt;
          if (wantDash) startDash();
          else if (this.stateT <= 0) {
            this.vy = -MOVE.JUMP_VEL;
            this.grounded = false;
            Sparks.dust(this.x, GROUND_Y); // M14: takeoff kick-up
          }
        } else {
          if (this.moving !== 0) this.x += this.moving * this.speeds.air * dt;
          integrateAir(this, dt);
          if (this.vy >= 0) this.state = FState.FALL;
          if (this.grounded) this.land();
        }
        break;
      }
      case FState.FALL: {
        if (this.moving !== 0) this.x += this.moving * this.speeds.air * dt;
        integrateAir(this, dt);
        if (this.grounded) this.land();
        break;
      }
      case FState.LAND: {
        this.stateT -= dt;
        if (this.stateT <= 0) this.state = FState.IDLE;
        break;
      }
      case FState.DASH:
      case FState.BACKDASH: {
        const speed = this.state === FState.DASH ? this.speeds.dashFwd : this.speeds.dashBack;
        this.x += this.dashDir * speed * dt;
        this.stateT -= dt;
        if (this.stateT <= 0) this.state = FState.IDLE;
        break;
      }
      default: {
        if (wantJump) {
          this.state = FState.JUMP;
          this.stateT = MOVE.JUMP_STARTUP;
        } else if (wantDash) {
          startDash();
        } else if (this.blockHeld && this.nearFoe(opponent)) {
          // Holding AWAY at fighting range guards (out of range the same
          // hold walks back instead — see nearFoe).
          this.state = FState.BLOCK;
          this.blockLow = this.crouchHeld;
        } else if (this.crouchHeld) {
          if (this.moving !== 0) {
            this.state = FState.SNEAK;
            this.x += this.moving * this.speeds.sneak * dt;
          } else {
            this.state = FState.CROUCH;
          }
        } else if (this.moving !== 0) {
          this.state = FState.WALK;
          this.x += this.moving * this.speeds.walk * dt;
        } else {
          this.state = FState.IDLE;
        }
        break;
      }
    }
    clampArena(this);
  }

  currentFrame() {
    const s = this.sprites;
    switch (this.state) {
      case FState.ATTACK: {
        // Phase-driven animation from the fighter's own kit table (M8).
        const kit = FRAME_FOR[this.kind] ?? FRAME_FOR.wesker;
        const fr = kit[this.attackId] ?? kit.light1;
        const idx = this.phase === "startup" ? fr.startup
          : this.phase === "active" ? fr.active : fr.recovery;
        return s.attack[idx];
      }
      case FState.WALK:
        return s.walk[Math.floor(this.animTime * 8) % s.walk.length];
      case FState.CROUCH:
        return s.crouch[Math.floor(this.animTime * 3) % s.crouch.length];
      case FState.SNEAK:
        return s.sneak[Math.floor(this.animTime * 6) % s.sneak.length];
      case FState.JUMP:
        return this.grounded ? s.crouch[0] : s.jump[0];
      case FState.FALL:
        return s.jump[1];
      case FState.LAND:
        return s.crouch[0];
      case FState.HITSTUN:
        return s.jump[1]; // reeling (judder + sparks sell the hit)
      case FState.SPECIAL:
        // Assigned per-tick by the running script (specials.js).
        return (this.special && this.special.frame) || s.idle[0];
      case FState.GRAB:
        // Reach through seizure + carry; toss effort per fighter.
        if (this.phase === "toss") {
          return this.kind === "homelander" ? s.strain[0] : s.attack[5];
        }
        return s.grab[0];
      case FState.THROWN:
        return s.jump[0]; // tucked: hoisted off the ground
      case FState.BLOCK:
      case FState.BLOCKSTUN:
        return s.block[this.blockLow ? 1 : 0]; // guard held through the shove
      case FState.KO:
        return s.crouch[1]; // crumpled (full KO presentation is M15)
      case FState.DASH:
      case FState.BACKDASH:
        return s.dash[Math.floor(this.animTime * 16) % s.dash.length];
      default:
        return s.idle[Math.floor(this.animTime * 3) % s.idle.length];
    }
  }

  draw(ctx, camX) {
    const frame = this.currentFrame();
    const img = this.facing === 1 ? frame : flipped(frame);
    // Impact judder while stunned: sells the hit/block without new sprites.
    const stunned = this.state === FState.HITSTUN || this.state === FState.BLOCKSTUN;
    const judder = stunned ? Math.round(Math.sin(this.animTime * 90) * 2) : 0;
    const dx = Math.round(this.x - camX - this.w / 2) + judder;
    const dy = Math.round(this.y - this.h + FEET_PAD * SPRITE_SCALE);
    ctx.drawImage(img, dx, dy, this.w, this.h);
  }
}
