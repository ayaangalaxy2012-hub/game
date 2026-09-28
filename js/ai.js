// M12 AI: a CPU opponent that plays the game's systems — spacing, guard
// heights, the strike/throw/guard triangle, whiff punishes, rage economy.
// Difficulty is honesty-graded: reaction speed, guard correctness, mistake
// rate, and plan sophistication. NEVER stats (same Fighter, same tables).
//
// Structure: think() runs on a per-difficulty clock and writes a standing
// order { move, crouch, guard }; update() applies the order every frame and
// fires one-shot events immediately. rng is injectable for headless tests.
// (M5 dodge doesn't exist yet, so Medium/Extreme evade with dashes, jumps,
// and ducks instead — see the Jaguar/laser reactions below.)

const THINK = Object.freeze({ easy: 0.38, medium: 0.20, extreme: 0.09 });
const MISTAKE = Object.freeze({ easy: 0.22, medium: 0.07, extreme: 0.015 });
const LINK = Object.freeze({ easy: 0.4, medium: 0.8, extreme: 0.95 });
const GUARD = Object.freeze({ easy: 0.30, medium: 0.65, extreme: 0.88 });

// States where no new decision is possible (committed/helpless).
const BUSY = Object.freeze(["GRAB", "THROWN", "HITSTUN", "KO", "SPECIAL"]);

// Foe is punishable: attack/grab/super recoveries + landing lag.
function foeCommitted(foe) {
  if (foe.state === "ATTACK" && foe.phase === "recovery") return true;
  if (foe.state === "GRAB" && (foe.phase === "recover" || foe.phase === "toss")) return true;
  if (foe.state === "SPECIAL" && foe.special && foe.special.phase === "recover") return true;
  if (foe.state === "LAND") return true;
  return false;
}

export class AIController {
  constructor(diff = "medium", rng = Math.random) {
    this.diff = diff;
    this.rng = rng;
    this.thinkT = 0;
    this.dashCD = 0;
    this.jumpCD = 0;
    this.specialCD = 0;
    this.foeGuardStreak = 0; // consecutive seconds foe holds guard (turtle read)
    this.order = { move: 0, crouch: false, guard: false };
  }

  get reaction() {
    return THINK[this.diff] ?? THINK.medium;
  }

  update(dt, me, foe) {
    if (me.hp <= 0 || foe.hp <= 0) {
      // Someone's done: hands off the corpse (no corpse-beating).
      me.moving = 0; me.crouchHeld = false; me.blockHeld = false;
      return;
    }
    this.thinkT -= dt;
    this.dashCD -= dt;
    this.jumpCD -= dt;
    this.specialCD -= dt;
    if (foe.state === "BLOCK") this.foeGuardStreak += dt;
    else this.foeGuardStreak = 0;
    if (this.thinkT <= 0) {
      // Reaction jitter: even Extreme doesn't tick like a metronome.
      this.thinkT = this.reaction * (0.8 + this.rng() * 0.4);
      this.think(me, foe);
    }
    me.moving = this.order.move;
    me.crouchHeld = this.order.crouch;
    me.blockHeld = this.order.guard;
  }

  think(me, foe) {
    if (BUSY.includes(me.state)) return; // keep last order while committed
    const gap = Math.abs(foe.x - me.x);
    const toFoe = foe.x >= me.x ? 1 : -1;
    const R = this.rng;
    let move = 0, crouch = false, guard = false;

    // --- 1. Danger: reactable foe offense (startup = the honest tell) ---
    const foeSwing = foe.state === "ATTACK" && foe.phase === "startup" && foe.grounded;
    const foeCharging = foe.state === "SPECIAL" && gap < 420;
    if ((foeSwing && gap < 320) || foeCharging) {
      const incomingLaser = foe.state === "SPECIAL" && foe.specialId === "laser" &&
        foe.special && foe.special.phase === "startup";
      if (incomingLaser && this.diff === "extreme" && R() < 0.8) {
        crouch = true; // hard duck: the beam sails over (no chip, no block needed)
      } else if (R() < GUARD[this.diff]) {
        guard = true;
        // Correct height (attack level is visible in the windup pose).
        const lvl = foe.state === "ATTACK" ? foe.attackMove && foe.attackMove.level : "mid";
        crouch = lvl === "low";
      } else if (R() < 0.5) {
        guard = true; // panicked guard, height coin-flip (still stops mids)
        crouch = R() < 0.5;
      }
      // Jaguar already driving at us? Leave the ground instead of guarding.
      const tackleIn = foe.state === "SPECIAL" && foe.specialId === "jaguar" &&
        foe.special && foe.special.phase === "dash" && gap < 220;
      const jumpP = this.diff === "extreme" ? 0.7 : this.diff === "medium" ? 0.25 : 0.05;
      if (tackleIn && this.jumpCD <= 0 && R() < jumpP) {
        me.queueJump();
        this.jumpCD = 1.0;
        guard = false;
        crouch = false;
      }
    } else if (foeCommitted(foe) || foe.state === "HITSTUN" || foe.state === "BLOCKSTUN") {
      // --- 2. Punish / pressure: foe can't answer right now ---
      this.strike(me, foe, gap, toFoe, R, true);
      move = gap > 140 ? toFoe : 0;
    } else {
      // --- 3. Neutral: spacing, offense, specials ---
      // Decisive supers FIRST: a kill confirm must never wait behind a jab
      // (a poke pressed first would lock us in ATTACK and gate the super).
      if (this.openerSuper(me, foe, gap)) {
        this.order = { move: 0, crouch: false, guard: false };
      } else {
        if (gap > 320) {
          move = toFoe; // march in; dash to close real distance
          const dashP = this.diff === "extreme" ? 0.5 : this.diff === "medium" ? 0.25 : 0.05;
          if (this.dashCD <= 0 && R() < dashP) {
            me.queueDash(toFoe);
            this.dashCD = 1.2;
          }
        } else if (gap > 150) {
          move = toFoe;
        } else if (gap < 85) {
          // Chest-to-chest: make space or make contact.
          const backP = this.diff === "extreme" ? 0.3 : this.diff === "medium" ? 0.15 : 0.05;
          if (this.dashCD <= 0 && R() < backP) {
            me.queueDash(-toFoe);
            this.dashCD = 1.2;
          } else {
            move = toFoe;
          }
        }
        if (gap < 150) this.strike(me, foe, gap, toFoe, R, false);
        else if (me.kind === "wesker" && gap < 260 && R() < (this.diff === "easy" ? 0.03 : 0.12)) {
          me.pressHeavy(); // cobra poke from its long reach (whiffs safely far)
        } else if (me.kind === "homelander" && gap < 300 && gap > 150 && this.dashCD <= 0 &&
          R() < (this.diff === "easy" ? 0.03 : 0.15)) {
          me.queueDash(toFoe); // lumber into range
          this.dashCD = 1.2;
        }
        this.specials(me, foe, gap, R);
        }
      } // end neutral else (105): pokes done, fall through to mistakes+order

    // --- Easy mistakes (all diffs, weighted): the human texture ---
    if (R() < MISTAKE[this.diff]) {
      const m = R();
      if (m < 0.3) { guard = false; crouch = false; } // drops guard cold
      else if (m < 0.5) { move = -toFoe; } // backs off for nothing
      else if (m < 0.7 && this.jumpCD <= 0) { me.queueJump(); this.jumpCD = 1; } // random hop
      else if (m < 0.9 && gap > 250) { me.pressLight(); } // whiffs from downtown
      else { move = 0; } // deer in headlights
    }

    this.order = { move, crouch, guard };
  }

  // In-range offense: chain links, turtle-cracking grabs, cobra pokes.
  strike(me, foe, gap, toFoe, R, punish) {
    if (me.state === "ATTACK") {
      if (me.attackMove && me.attackMove.chainTo &&
        (me.phase === "active" || me.phase === "recovery") && R() < LINK[this.diff]) {
        me.pressLight(); // combo link (the chain game, all levels attempt it)
      }
      return;
    }
    if (me.state !== "IDLE" && me.state !== "WALK" && me.state !== "CROUCH" && me.state !== "BLOCK") return;
    const foeTurtling = foe.state === "BLOCK" || foe.state === "BLOCKSTUN" || this.foeGuardStreak > 0.5;
    const grabP = (this.diff === "easy" ? 0.05 : this.diff === "medium" ? 0.15 : 0.22) +
      (foeTurtling ? 0.35 : 0);
    if (gap < 100 && R() < grabP) {
      me.pressGrab(); // the triangle answer to holding back
      return;
    }
    if (gap > 150 && !punish) return; // out of jab range, nothing dumb
    if (punish && me.kind === "wesker" && gap >= 150 && gap < 260 && R() < 0.5) {
      me.pressHeavy(); // cobra reaches where jabs can't
      return;
    }
    // Unpredictable mix on purpose: mostly jab, sometimes grab/heavy.
    const mix = R();
    if (mix < 0.12 && gap < 100) me.pressGrab();
    else if (mix < 0.22 && me.kind === "wesker") me.pressHeavy();
    else me.pressLight();
  }

  // Decisive supers: kill confirm + long-range snipe. Unconditional attempts
  // (no rng gate) so a poke can never starve them. Returns true if fired.
  openerSuper(me, foe, gap) {
    if (this.specialCD > 0 || me.rageLevel < 1) return false;
    const lvl = me.rageLevel;
    if (foe.hp <= 32 && lvl >= 3 && gap < 380 && me.trySpecial("ragemode", foe)) {
      this.specialCD = 1.0;
      return true;
    }
    if (foe.hp <= 20 && lvl >= 1 && gap < 380 && gap > 150 && me.trySpecial("jaguar", foe)) {
      this.specialCD = 1.0;
      return true;
    }
    return false;
  }

  // Rage economy: easy wastes it, medium spends it, extreme invests it.
  // (Slot ids map per kit in trySpecial — "jaguar" is Homelander's laser.)
  specials(me, foe, gap, R) {
    if (this.specialCD > 0 || me.rageLevel < 1) return;
    const lvl = me.rageLevel;
    const fire = (id) => {
      if (me.trySpecial(id, foe)) { this.specialCD = 1.0; return true; }
      return false;
    };
    const rate = this.diff === "extreme" ? 0.4 : this.diff === "medium" ? 0.25 : 0.05;
    if (lvl >= 2 && gap < 220 && R() < rate) { fire("phantom"); return; } // close pressure
    if (lvl >= 1 && gap >= 150 && gap < 420 && R() < rate) { fire("jaguar"); return; } // poke/whiff-punish
    if (this.diff === "easy" && lvl >= 1 && gap < 220 && R() < 0.1) fire("jaguar"); // wastes meter, on brand
  }
}
