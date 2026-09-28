// Procedural pixel-art sprites for Wesker + Homelander.
// No external assets: every frame is drawn 1px at a time on a tiny canvas
// (36x52) then upscaled with smoothing OFF => crisp pixel look.
// Frames: idle[4], walk[4], attack[13] (jab, kick, cross, overhead-raise,
// windup, slam, palm, elbow, backfist, cobra, hook, sweep, SAMURAI EDGE),
// crouch[2],
// sneak[4], jump[2] (rise/fall), dash[2],
// block[2] (stand guard, crouch guard), grab[1] (seize reach),
// special[4] (tackle, unmasked, lase gaze, shout),
// strain[1] (Homelander throw grimace).
// Attacks animate per phase: windup on startup, strike on active,
// follow-through on recovery (mapped in combat/data.js FRAME_FOR).
// JS concept vs Python: a `class`-free factory pattern — `buildSprites(kind)`
// returns a plain object of canvases. No inheritance needed yet.

import { makeCanvas, px } from "./pixel.js";
import { SPRITE_W, SPRITE_H } from "../config.js";

const OUT = "#06060c";

// Box with 1px outline: draws outline rect, then fill inset by 1 on left/right
// (keeps silhouette readable against any background — M1 requirement).
function box(ctx, x, y, w, h, fill, outline = OUT) {
  px(ctx, x - 1, y - 1, w + 2, h + 2, outline);
  px(ctx, x, y, w, h, fill);
}

function leg(ctx, x, yTop, h, main, dark, boot, bootHi) {
  const w = 5;
  px(ctx, x - 1, yTop - 1, w + 2, h + 3, OUT); // outline incl. boot
  px(ctx, x, yTop, w, h, main);                // leg
  px(ctx, x + 3, yTop, 2, h, dark);            // shade on inner side
  px(ctx, x, yTop + h - 2, w, 4, boot);        // boot
  px(ctx, x, yTop + h - 2, w, 1, bootHi);      // boot shine
}

function arm(ctx, x, y, w, h, sleeve, sleeveDark, fist) {
  px(ctx, x - 1, y - 1, w + 2, h + 2, OUT);
  px(ctx, x, y, w, h, sleeve);
  px(ctx, x, y, w, 1, sleeveDark); // top shade line (simple shading)
  px(ctx, x + (w > 6 ? w - 3 : 0), y + h - 3, 3, 3, fist); // fist at end
}

// ---- per-character painters ---------------------------------------------
function paintWesker(ctx, p) {
  const cx = 18;
  const bob = p.bob;
  const drop = (p.crouch ? 8 : 0) + (p.dip || 0); // crouch sink + slam fold-over
  const lean = (p.dash ? 2 : 0) + (p.wind || 0);   // dash drive + windup coil / slam drive
  // Back coat tails (behind legs) — long coat = Wesker silhouette.
  const sway = p.coatSway;
  px(ctx, cx - 8 + sway, 30 + bob + drop, 6, 14, "#101018");
  px(ctx, cx + 2 - sway, 30 + bob + drop, 6, 14, "#101018");
  px(ctx, cx - 8 + sway, 30 + bob + drop, 1, 14, "#33334d"); // rim light
  px(ctx, cx + 7 - sway, 30 + bob + drop, 1, 14, "#33334d");

  // Stance legs: stand / crouch-fold / air-tuck / dash-lunge.
  // Boot bottoms stay on row 48 in every grounded stance (see FEET_PAD).
  const LM = "#14141c", LD = "#08080d", BT = "#000000", BH = "#3a3a4d";
  if (p.crouch) {
    leg(ctx, cx - 9 + p.legL, 40 + bob, 6, LM, LD, BT, BH); // folded, wide base
    leg(ctx, cx + 4 + p.legR, 40 + bob, 6, LM, LD, BT, BH);
  } else if (p.air === 1) {
    leg(ctx, cx - 6 + p.legL, 37 + bob, 7, LM, LD, BT, BH); // knees tucked (rise)
    leg(ctx, cx + 1 + p.legR, 39 + bob, 5, LM, LD, BT, BH);
  } else if (p.air === 2) {
    leg(ctx, cx - 6 + p.legL, 34 + bob, 11, LM, LD, BT, BH); // reaching down (fall)
    leg(ctx, cx + 1 + p.legR, 35 + bob, 10, LM, LD, BT, BH);
  } else if (p.dash) {
    leg(ctx, cx - 10, 36 + bob, 10, LM, LD, BT, BH); // lunge stance
    leg(ctx, cx + 4, 36 + bob, 10, LM, LD, BT, BH);
  } else if (p.brace) {
    leg(ctx, cx - 9, 38 + bob, 8, LM, LD, BT, BH); // braced wide base for the slam
    leg(ctx, cx + 4, 38 + bob, 8, LM, LD, BT, BH);
  } else {
    leg(ctx, cx - 6 + p.legL, 34 + bob, 12, LM, LD, BT, BH);
    leg(ctx, cx + 1 + p.legR, 34 + bob, 12, LM, LD, BT, BH);
  }
  ctx.save();
  ctx.translate(lean, drop); // shift torso + head + arms together

  // Torso: dark coat, V shirt, buttons, high collar.
  box(ctx, cx - 6, 19 + bob, 12, 16, "#1b1b26");
  px(ctx, cx - 6, 19 + bob, 2, 16, "#33334d");   // left rim light
  px(ctx, cx + 4, 19 + bob, 2, 16, "#0c0c12");   // right shade
  px(ctx, cx - 2, 20 + bob, 4, 9, "#0a0a10");    // black shirt V
  px(ctx, cx - 1, 22 + bob, 2, 6, "#23232f");    // shirt fold
  px(ctx, cx - 6, 16 + bob, 12, 4, "#101018");   // high collar
  px(ctx, cx - 6, 16 + bob, 12, 1, "#3d3d5c");   // collar highlight
  // Coat front edges
  px(ctx, cx - 5, 24 + bob, 1, 11, "#3a3a55");
  px(ctx, cx + 4, 24 + bob, 1, 11, "#000000");

  // Head: skin + blond crop + sunglasses (signature).
  // NOTE: hy rides `bob` (body motion) PLUS headBob (relative nod). An old
  // revision used headBob alone, which opened a 1px neck gap on every
  // bob=1 frame (idle/walk bobbing) — the "floating head" bug.
  const hy = 7 + bob + (p.headBob || 0);
  box(ctx, cx - 5, hy, 10, 9, "#e6b48c");
  px(ctx, cx + 3, hy, 2, 9, "#b98a63");          // face shade (light from left)
  px(ctx, cx - 5, hy, 10, 3, "#c8a45e");        // short blond hair
  px(ctx, cx - 5, hy + 2, 2, 3, "#c8a45e");     // sideburns
  px(ctx, cx + 3, hy + 2, 2, 3, "#c8a45e");
  // Sunglasses bar + red glint (Wesker signature)
  if (p.unmasked) {
    // RAGE MODE: sunglasses torn away, Uroboros infection burning red.
    px(ctx, cx - 5, hy + 4, 10, 2, "#7a1010");     // inflamed eye band
    px(ctx, cx - 4, hy + 4, 3, 2, "#ff2a2a");      // burning eyes
    px(ctx, cx + 1, hy + 4, 3, 2, "#ff2a2a");
    px(ctx, cx - 4, hy + 4, 3, 1, "#ffd0d0");      // hot glints
    px(ctx, cx + 1, hy + 4, 3, 1, "#ffd0d0");
    px(ctx, cx - 5, hy + 7, 10, 1, "#5a0d0d");     // dark veins below
  } else {
    px(ctx, cx - 5, hy + 4, 10, 3, "#0b0b10");
    px(ctx, cx - 5, hy + 4, 10, 1, "#3a3a4d");
    px(ctx, cx + 1, hy + 5, 2, 1, "#ff3030");     // glint
  }
  px(ctx, cx - 3, hy + 8, 4, 1, "#a87c58");     // mouth shadow

  // Arms depend on pose.
  if (p.tackle) {
    // Jaguar Charge: shoulder dropped low, lead arm swept back for speed.
    px(ctx, cx + 0, 24 + bob, 12, 7, OUT);
    px(ctx, cx + 1, 25 + bob, 10, 5, "#1b1b26");
    px(ctx, cx + 1, 25 + bob, 10, 1, "#33334d");
    px(ctx, cx + 8, 25 + bob, 4, 5, "#4a3320");      // tucked fist
    px(ctx, cx - 8, 22 + bob, 8, 2, "#9fd4ff");      // back-swept speed lines
    px(ctx, cx - 10, 25 + bob, 10, 2, "#3a6a9f");
    arm(ctx, cx - 9, 21 + bob, 5, 10, "#1b1b26", "#0c0c12", "#4a3320");
  } else if (p.seize) {
    // Grab reach: both arms shot forward at chest height, deep lean-in.
    px(ctx, cx - 2, 21 + bob, 12, 4, OUT);
    px(ctx, cx - 1, 22 + bob, 10, 2, "#1b1b26");
    px(ctx, cx + 7, 21 + bob, 4, 4, "#4a3320");    // open hands
    px(ctx, cx - 6, 23 + bob, 6, 8, "#1b1b26");    // rear guard arm
    px(ctx, cx - 6, 28 + bob, 5, 3, "#4a3320");
  } else if (p.guard === 1) {
    // Standing guard: forearms crossed high, fists up, elbows in.
    px(ctx, cx - 8, 19 + bob, 14, 8, OUT);
    px(ctx, cx - 7, 20 + bob, 12, 2, "#1b1b26");
    px(ctx, cx - 7, 24 + bob, 12, 2, "#23232f");
    px(ctx, cx - 7, 20 + bob, 3, 6, "#4a3320");
    px(ctx, cx + 4, 20 + bob, 3, 6, "#4a3320");
    px(ctx, cx - 7, 20 + bob, 12, 1, "#33334d");
  } else if (p.guard === 2) {
    // Crouch guard: low cross over the knees (body already dropped).
    px(ctx, cx - 8, 22 + bob, 14, 8, OUT);
    px(ctx, cx - 7, 23 + bob, 12, 2, "#1b1b26");
    px(ctx, cx - 7, 27 + bob, 12, 2, "#23232f");
    px(ctx, cx - 7, 23 + bob, 3, 6, "#4a3320");
    px(ctx, cx + 4, 23 + bob, 3, 6, "#4a3320");
    px(ctx, cx - 7, 23 + bob, 12, 1, "#33334d");
  } else if (p.windup) {
    // Anticipation: fists chambered at the chest, weight shifted back.
    px(ctx, cx - 9, 19 + bob, 7, 11, OUT);
    px(ctx, cx - 8, 20 + bob, 5, 9, "#1b1b26");
    px(ctx, cx - 8, 20 + bob, 5, 4, "#4a3320");    // chambered fist
    px(ctx, cx + 2, 21 + bob, 7, 11, OUT);
    px(ctx, cx + 3, 22 + bob, 5, 9, "#1b1b26");
    px(ctx, cx + 3, 22 + bob, 5, 4, "#8a6540");
  } else if (p.slam) {
    // Heavy payoff: both arms crashed down-forward, torso folded over.
    px(ctx, cx - 2, 24 + bob, 14, 6, OUT);
    px(ctx, cx - 1, 25 + bob, 12, 4, "#1b1b26");
    px(ctx, cx + 7, 25 + bob, 5, 5, "#4a3320");    // joined fists, low
    px(ctx, cx + 7, 25 + bob, 5, 1, "#8a6540");
    px(ctx, cx + 2, 12 + bob, 2, 10, "#9fd4ff");   // downward speed lines
    px(ctx, cx + 6, 14 + bob, 2, 8, "#3a6a9f");
  } else if (p.overhead) {
    // Heavy overhead smash: both fists raised high, body coiled.
    px(ctx, cx - 9, 8 + bob, 7, 14, OUT);
    px(ctx, cx - 8, 9 + bob, 5, 12, "#1b1b26");
    px(ctx, cx - 8, 9 + bob, 5, 3, "#4a3320");    // raised fists
    px(ctx, cx + 2, 10 + bob, 7, 14, OUT);
    px(ctx, cx + 3, 11 + bob, 5, 12, "#1b1b26");
    px(ctx, cx + 3, 11 + bob, 5, 1, "#8a6540");   // knuckle light
  } else if (p.punch > 0) {
    // Punching arm extended toward +x (flip handles facing).
    arm(ctx, cx - 9, 21 + bob, 5, 10, "#1b1b26", "#0c0c12", "#4a3320");
    const ex = cx + 6, ey = 22 + bob - p.punch;
    px(ctx, ex - 1, ey - 1, 12, 5, OUT);
    px(ctx, ex, ey, 11, 3, "#1b1b26");
    px(ctx, ex + 8, ey - 1, 4, 5, "#4a3320");   // fist
    px(ctx, ex + 8, ey - 1, 4, 1, "#8a6540");   // knuckle light
    // Speed streak pixels (impact readability, animated later in M14)
    px(ctx, ex - 4, ey + 1, 3, 1, "#9fd4ff");
  } else if (p.kick > 0) {
    arm(ctx, cx - 9, 21 + bob, 5, 10, "#1b1b26", "#0c0c12", "#4a3320");
    arm(ctx, cx + 4, 21 + bob, 5, 10, "#1b1b26", "#0c0c12", "#4a3320");
    // Extended kick leg drawn over base legs
    px(ctx, cx + 2, 36 + bob, 13, 5, "#14141c");
    px(ctx, cx + 2, 36 + bob, 13, 1, "#33334d");
    px(ctx, cx + 11, 35 + bob, 4, 6, "#000000");
  } else if (p.palm) {
    // Open-hand thrust: arm extended, flat blade-hand, short snap streak.
    arm(ctx, cx - 9, 21 + bob, 5, 10, "#1b1b26", "#0c0c12", "#4a3320");
    px(ctx, cx + 6, 21 + bob - 1, 10, 4, OUT);
    px(ctx, cx + 7, 22 + bob - 1, 8, 2, "#1b1b26");
    px(ctx, cx + 13, 22 + bob - 1, 3, 2, "#e6b48c");   // edge of the hand
    px(ctx, cx + 3, 22 + bob, 3, 1, "#9fd4ff");
  } else if (p.elbow) {
    // Close elbow: arm folded tight, body sunk over it for the smash.
    px(ctx, cx - 4, 22 + bob, 10, 6, OUT);
    px(ctx, cx - 3, 23 + bob, 8, 4, "#1b1b26");
    px(ctx, cx + 3, 23 + bob, 3, 4, "#4a3320");        // elbow point forward
    arm(ctx, cx - 9, 21 + bob, 5, 10, "#1b1b26", "#0c0c12", "#4a3320");
  } else if (p.backfist) {
    // High backfist: arm whipped up-across, fist at full height.
    px(ctx, cx + 1, 8 + bob, 6, 15, OUT);
    px(ctx, cx + 2, 9 + bob, 4, 13, "#1b1b26");
    px(ctx, cx + 2, 9 + bob, 4, 4, "#4a3320");         // fist at apex
    arm(ctx, cx - 9, 22 + bob, 5, 9, "#1b1b26", "#0c0c12", "#4a3320");
    px(ctx, cx - 2, 12 + bob, 2, 6, "#9fd4ff");        // upward arc streak
  } else if (p.cobra) {
    // COBRA STRIKE: knife-hand speared dead level, whole body behind it.
    px(ctx, cx + 2, 20 + bob, 16, 5, OUT);
    px(ctx, cx + 3, 21 + bob, 14, 3, "#1b1b26");
    px(ctx, cx + 3, 21 + bob, 14, 1, "#33334d");
    px(ctx, cx + 15, 21 + bob, 3, 3, "#e6b48c");       // blade-hand tip
    px(ctx, cx + 15, 22 + bob, 3, 1, "#ff3030");       // Wesker red glint
    px(ctx, cx - 3, 22 + bob, 5, 1, "#9fd4ff");        // drive streaks
    px(ctx, cx - 5, 24 + bob, 7, 1, "#3a6a9f");
    arm(ctx, cx - 9, 22 + bob, 5, 9, "#1b1b26", "#0c0c12", "#4a3320");
  } else if (p.gun) {
    // SAMURAI EDGE: both arms punched forward, pistol leveled at chest
    // height. Canvas is 36px wide (cx=18) — muzzle glint sits at cx+16..17
    // so the tip stays inside the frame before the 3x upscale.
    arm(ctx, cx - 9, 21 + bob, 5, 10, "#1b1b26", "#0c0c12", "#4a3320");
    px(ctx, cx + 2, 20 + bob, 16, 7, OUT);             // arms+gun outline block
    px(ctx, cx + 3, 21 + bob, 9, 5, "#1b1b26");        // extended sleeves
    px(ctx, cx + 3, 21 + bob, 9, 1, "#33334d");        // rim light
    px(ctx, cx + 11, 21 + bob, 7, 4, OUT);             // slide outline
    px(ctx, cx + 12, 22 + bob, 5, 2, "#9a9ab0");       // steel slide
    px(ctx, cx + 12, 24 + bob, 3, 2, "#3a2a1a");       // grip under slide
    px(ctx, cx + 16, 22 + bob, 2, 1, "#ffd23e");       // muzzle glint
    px(ctx, cx - 4, 24 + bob, 6, 4, "#4a3320");        // support hand
  } else {
    arm(ctx, cx - 9, 21 + bob + p.armSwing, 5, 10, "#1b1b26", "#0c0c12", "#4a3320");
    arm(ctx, cx + 4, 21 + bob - p.armSwing, 5, 10, "#1b1b26", "#0c0c12", "#4a3320");
    if (p.dash) {
      // Motion streaks trailing behind the dash (local -x = behind).
      px(ctx, cx - 13, 24 + bob, 4, 1, "#9fd4ff");
      px(ctx, cx - 15, 27 + bob, 6, 1, "#3a6a9f");
    }
  }
  ctx.restore();
}

function paintHomelander(ctx, p) {
  const cx = 18;
  const bob = p.bob;
  const drop = (p.crouch ? 8 : 0) + (p.dip || 0);
  const lean = (p.dash ? 2 : 0) + (p.wind || 0);
  // Cape behind everything — big red shape = Homelander silhouette.
  const wv = p.capeWave;
  px(ctx, cx - 10 + wv, 16 + bob + drop, 5, 28, "#6e0d0d");   // inner shade
  px(ctx, cx - 5 + wv, 16 + bob + drop, 12, 28, "#a01313");   // main cape
  px(ctx, cx + 7 + wv, 16 + bob + drop, 1, 28, "#e05050");    // rim light edge
  for (let i = 0; i < 5; i++) {
    px(ctx, cx - 5 + wv + (i % 2), 20 + bob + drop + i * 5, 10 - i, 1, "#6e0d0d"); // folds
  }

  // Stance legs: blue suit + red boots (same stance logic as Wesker).
  const LM = "#2043e0", LD = "#152c96", BT = "#a01313", BH = "#e05050";
  if (p.crouch) {
    leg(ctx, cx - 9 + p.legL, 40 + bob, 6, LM, LD, BT, BH);
    leg(ctx, cx + 4 + p.legR, 40 + bob, 6, LM, LD, BT, BH);
  } else if (p.air === 1) {
    leg(ctx, cx - 6 + p.legL, 37 + bob, 7, LM, LD, BT, BH);
    leg(ctx, cx + 1 + p.legR, 39 + bob, 5, LM, LD, BT, BH);
  } else if (p.air === 2) {
    leg(ctx, cx - 6 + p.legL, 34 + bob, 11, LM, LD, BT, BH);
    leg(ctx, cx + 1 + p.legR, 35 + bob, 10, LM, LD, BT, BH);
  } else if (p.dash) {
    leg(ctx, cx - 10, 36 + bob, 10, LM, LD, BT, BH);
    leg(ctx, cx + 4, 36 + bob, 10, LM, LD, BT, BH);
  } else if (p.brace) {
    leg(ctx, cx - 9, 38 + bob, 8, LM, LD, BT, BH);
    leg(ctx, cx + 4, 38 + bob, 8, LM, LD, BT, BH);
  } else {
    leg(ctx, cx - 6 + p.legL, 34 + bob, 12, LM, LD, BT, BH);
    leg(ctx, cx + 1 + p.legR, 34 + bob, 12, LM, LD, BT, BH);
  }
  ctx.save();
  ctx.translate(lean, drop);

  // Torso: bright blue suit, muscle shading, gold belt + eagle.
  box(ctx, cx - 7, 19 + bob, 14, 16, "#2043e0");       // broader shoulders
  px(ctx, cx - 7, 19 + bob, 3, 16, "#6f86ff");         // left highlight
  px(ctx, cx + 4, 19 + bob, 3, 16, "#152c96");         // right shade
  px(ctx, cx - 2, 21 + bob, 4, 5, "#6f86ff");          // chest light
  // Chest eagle (gold) + white wing accents
  px(ctx, cx - 2, 23 + bob, 4, 2, "#ffd23e");
  px(ctx, cx - 4, 23 + bob, 2, 1, "#ffffff");
  px(ctx, cx + 2, 23 + bob, 2, 1, "#ffffff");
  // Belt
  px(ctx, cx - 7, 31 + bob, 14, 3, "#ffd23e");
  px(ctx, cx - 1, 31 + bob, 3, 3, "#fff2a8");
  // Shoulder stars (white details)
  px(ctx, cx - 6, 20 + bob, 2, 2, "#ffffff");
  px(ctx, cx + 4, 20 + bob, 2, 2, "#ffffff");

  // Head: skin + swept blond hair. (Same bob-riding hy as Wesker — see note
  // there. headBob is only the extra nod on top of body motion.)
  const hy = 7 + bob + (p.headBob || 0);
  box(ctx, cx - 5, hy, 10, 9, "#f2c9a0");
  px(ctx, cx + 3, hy, 2, 9, "#c89868");
  px(ctx, cx - 5, hy - 1, 10, 3, "#d9b45f");           // hair cap
  px(ctx, cx + 1, hy - 1, 5, 1, "#f4dd9a");            // shine
  px(ctx, cx - 5, hy + 2, 1, 4, "#d9b45f");            // side fringe
  px(ctx, cx - 3, hy + 4, 2, 2, "#ffffff");            // eyes
  px(ctx, cx + 1, hy + 4, 2, 2, "#ffffff");
  px(ctx, cx - 3, hy + 5, 1, 1, "#1a3fd4");
  px(ctx, cx + 1, hy + 5, 1, 1, "#1a3fd4");
  if (p.lase) {
    // Searing heat-vision pupils over the base eyes.
    px(ctx, cx - 3, hy + 4, 2, 2, "#ffffff");
    px(ctx, cx + 1, hy + 4, 2, 2, "#ffffff");
    px(ctx, cx - 3, hy + 5, 2, 1, "#ff3b1a");
    px(ctx, cx + 1, hy + 5, 2, 1, "#ff3b1a");
  }
  px(ctx, cx - 2, hy + 8, 4, 1, "#a8764e");            // confident smirk
  if (p.strain) {
    // Herculean effort (throw): brows down, teeth bared.
    px(ctx, cx - 4, hy + 3, 4, 1, "#8a6a2a");
    px(ctx, cx + 0, hy + 3, 4, 1, "#8a6a2a");
    px(ctx, cx - 3, hy + 8, 6, 2, "#ffffff");
    px(ctx, cx - 3, hy + 8, 1, 2, "#a8764e");
    px(ctx, cx + 0, hy + 8, 1, 2, "#a8764e");
    px(ctx, cx + 2, hy + 8, 1, 2, "#a8764e");
  } else if (p.shout) {
    // Head thrown back: brow high, throat dropped wide open.
    px(ctx, cx - 3, hy + 1, 6, 1, "#d9b45f");
    px(ctx, cx - 3, hy + 7, 6, 4, "#3a0d0d");
    px(ctx, cx - 3, hy + 7, 6, 1, "#ffffff");
    px(ctx, cx - 2, hy + 9, 4, 2, "#7a1a1a");
  }

  if (p.strain) {
    // Both arms driving down-forward for the toss.
    px(ctx, cx - 9, 23 + bob, 6, 11, OUT);
    px(ctx, cx - 8, 24 + bob, 4, 9, "#2043e0");
    px(ctx, cx - 8, 30 + bob, 4, 3, "#f2c9a0");
    px(ctx, cx + 3, 23 + bob, 6, 11, OUT);
    px(ctx, cx + 4, 24 + bob, 4, 9, "#2043e0");
    px(ctx, cx + 4, 30 + bob, 4, 3, "#f2c9a0");
  } else if (p.lase) {
    // HEAT VISION: head thrust forward, eyes white-hot with red halo.
    // (M11 — the glow reserved for his specials starts here.)
    px(ctx, cx - 2, 20 + bob, 10, 5, OUT);
    px(ctx, cx - 1, 21 + bob, 8, 3, "#2043e0");
    px(ctx, cx + 5, 21 + bob, 4, 3, "#ff3b1a");        // halo
    px(ctx, cx + 6, 22 + bob, 3, 2, "#ffffff");        // burning pupils
    px(ctx, cx - 6, 23 + bob, 5, 8, "#2043e0");        // braced arm back
    px(ctx, cx - 6, 29 + bob, 4, 2, "#f2c9a0");
  } else if (p.shout) {
    // SONIC SCREAM: head thrown back, jaw wide, arms flung open.
    px(ctx, cx - 12, 20 + bob, 6, 10, OUT);
    px(ctx, cx - 11, 21 + bob, 4, 8, "#2043e0");
    px(ctx, cx - 11, 27 + bob, 4, 2, "#f2c9a0");
    px(ctx, cx + 6, 20 + bob, 6, 10, OUT);
    px(ctx, cx + 7, 21 + bob, 4, 8, "#2043e0");
    px(ctx, cx + 7, 27 + bob, 4, 2, "#f2c9a0");
    px(ctx, cx - 2, 22 + bob, 8, 2, "#ffd23e");        // chest eagle lit
  } else if (p.seize) {
    px(ctx, cx - 3, 21 + bob, 12, 4, OUT);
    px(ctx, cx - 2, 22 + bob, 10, 2, "#2043e0");
    px(ctx, cx + 6, 21 + bob, 4, 4, "#f2c9a0");    // open hands
    px(ctx, cx - 7, 23 + bob, 6, 8, "#2043e0");    // rear guard arm
    px(ctx, cx - 7, 28 + bob, 5, 3, "#2043e0");
  } else if (p.guard === 1) {
    px(ctx, cx - 9, 19 + bob, 14, 8, OUT);
    px(ctx, cx - 8, 20 + bob, 12, 2, "#2043e0");
    px(ctx, cx - 8, 24 + bob, 12, 2, "#152c96");
    px(ctx, cx - 8, 20 + bob, 3, 6, "#f2c9a0");
    px(ctx, cx + 3, 20 + bob, 3, 6, "#f2c9a0");
    px(ctx, cx - 8, 20 + bob, 12, 1, "#ffffff");
  } else if (p.guard === 2) {
    px(ctx, cx - 9, 22 + bob, 14, 8, OUT);
    px(ctx, cx - 8, 23 + bob, 12, 2, "#2043e0");
    px(ctx, cx - 8, 27 + bob, 12, 2, "#152c96");
    px(ctx, cx - 8, 23 + bob, 3, 6, "#f2c9a0");
    px(ctx, cx + 3, 23 + bob, 3, 6, "#f2c9a0");
    px(ctx, cx - 8, 23 + bob, 12, 1, "#ffffff");
  } else if (p.windup) {
    px(ctx, cx - 10, 19 + bob, 7, 11, OUT);
    px(ctx, cx - 9, 20 + bob, 5, 9, "#2043e0");
    px(ctx, cx - 9, 20 + bob, 5, 4, "#f2c9a0");    // chambered fist
    px(ctx, cx + 3, 21 + bob, 7, 11, OUT);
    px(ctx, cx + 4, 22 + bob, 5, 9, "#2043e0");
    px(ctx, cx + 4, 22 + bob, 5, 4, "#6f86ff");
  } else if (p.slam) {
    px(ctx, cx - 3, 24 + bob, 14, 6, OUT);
    px(ctx, cx - 2, 25 + bob, 12, 4, "#2043e0");
    px(ctx, cx + 6, 25 + bob, 5, 5, "#f2c9a0");    // joined fists, low
    px(ctx, cx + 6, 25 + bob, 5, 1, "#ffffff");
    px(ctx, cx + 1, 12 + bob, 2, 10, "#ffffff");   // downward speed lines
    px(ctx, cx + 5, 14 + bob, 2, 8, "#6f86ff");
  } else if (p.overhead) {
    px(ctx, cx - 10, 8 + bob, 7, 14, OUT);
    px(ctx, cx - 9, 9 + bob, 5, 12, "#2043e0");
    px(ctx, cx - 9, 9 + bob, 5, 3, "#f2c9a0");    // raised fists
    px(ctx, cx + 3, 10 + bob, 7, 14, OUT);
    px(ctx, cx + 4, 11 + bob, 5, 12, "#2043e0");
    px(ctx, cx + 4, 11 + bob, 5, 1, "#6f86ff");
  } else if (p.punch > 0) {
    arm(ctx, cx - 10, 21 + bob, 5, 10, "#2043e0", "#152c96", "#2043e0");
    const ex = cx + 7, ey = 22 + bob - p.punch;
    px(ctx, ex - 1, ey - 1, 12, 5, OUT);
    px(ctx, ex, ey, 11, 3, "#2043e0");
    px(ctx, ex, ey, 11, 1, "#6f86ff");
    px(ctx, ex + 8, ey - 1, 4, 5, "#f2c9a0");          // fist (skin)
    px(ctx, ex - 4, ey + 1, 3, 1, "#ffffff");          // streak
  } else if (p.kick > 0) {
    arm(ctx, cx - 10, 21 + bob, 5, 10, "#2043e0", "#152c96", "#2043e0");
    arm(ctx, cx + 5, 21 + bob, 5, 10, "#2043e0", "#152c96", "#2043e0");
    px(ctx, cx + 2, 36 + bob, 13, 5, "#2043e0");
    px(ctx, cx + 2, 36 + bob, 13, 1, "#6f86ff");
    px(ctx, cx + 11, 35 + bob, 4, 6, "#a01313");
    px(ctx, cx + 11, 35 + bob, 4, 1, "#e05050");
  } else if (p.hook) {
    // Wide hook: arm looped out and up, heavy fist riding the arc.
    px(ctx, cx + 3, 12 + bob, 9, 14, OUT);
    px(ctx, cx + 4, 13 + bob, 7, 12, "#2043e0");
    px(ctx, cx + 4, 13 + bob, 7, 2, "#6f86ff");
    px(ctx, cx + 6, 21 + bob, 5, 5, "#f2c9a0");        // fist low in the arc
    px(ctx, cx - 1, 16 + bob, 3, 8, "#ffffff");        // arc streak
    arm(ctx, cx - 10, 22 + bob, 5, 9, "#2043e0", "#152c96", "#2043e0");
  } else if (p.sweep) {
    // Low sweep: leg scythed forward along the ground, dust kicked up.
    px(ctx, cx - 2, 37 + bob, 16, 4, OUT);
    px(ctx, cx - 1, 38 + bob, 14, 2, "#2043e0");
    px(ctx, cx - 1, 38 + bob, 14, 1, "#6f86ff");
    px(ctx, cx + 11, 36 + bob, 5, 5, "#a01313");       // sweeping boot
    px(ctx, cx + 11, 36 + bob, 5, 1, "#e05050");
    px(ctx, cx + 17, 40 + bob, 3, 2, "#8a7a5a");       // dust
    px(ctx, cx + 20, 38 + bob, 2, 2, "#8a7a5a");
    arm(ctx, cx - 10, 18 + bob + p.armSwing, 5, 9, "#2043e0", "#152c96", "#2043e0");
    arm(ctx, cx + 5, 22 + bob, 5, 9, "#2043e0", "#152c96", "#2043e0");
  } else {
    arm(ctx, cx - 10, 21 + bob + p.armSwing, 5, 10, "#2043e0", "#152c96", "#2043e0");
    arm(ctx, cx + 5, 21 + bob - p.armSwing, 5, 10, "#2043e0", "#152c96", "#2043e0");
    if (p.dash) {
      px(ctx, cx - 14, 24 + bob, 4, 1, "#ffffff");
      px(ctx, cx - 16, 27 + bob, 6, 1, "#6f86ff");
    }
  }
  ctx.restore();
}

// Pose table: subtle numbers => smooth idle/walk without extra assets.
function poses(kind) {
  void kind;
  return {
    idle: [
      { bob: 0, headBob: 0, legL: 0, legR: 0, armSwing: 0, capeWave: 0, coatSway: 0, punch: 0, kick: 0 },
      { bob: 1, headBob: 0, legL: 0, legR: 0, armSwing: 0, capeWave: 1, coatSway: 1, punch: 0, kick: 0 },
      { bob: 0, headBob: 1, legL: 0, legR: 0, armSwing: 0, capeWave: 0, coatSway: 0, punch: 0, kick: 0 },
      { bob: 1, headBob: 0, legL: 0, legR: 0, armSwing: 0, capeWave: -1, coatSway: -1, punch: 0, kick: 0 },
    ],
    walk: [
      { bob: 0, headBob: 0, legL: -3, legR: 3, armSwing: 1, capeWave: -1, coatSway: -1, punch: 0, kick: 0 },
      { bob: 1, headBob: 0, legL: 0, legR: 0, armSwing: 0, capeWave: 0, coatSway: 0, punch: 0, kick: 0 },
      { bob: 0, headBob: 0, legL: 3, legR: -3, armSwing: -1, capeWave: 1, coatSway: 1, punch: 0, kick: 0 },
      { bob: 1, headBob: 0, legL: 0, legR: 0, armSwing: 0, capeWave: 0, coatSway: 0, punch: 0, kick: 0 },
    ],
    attack: [
      { bob: 0, headBob: 0, legL: -1, legR: 1, armSwing: 0, capeWave: 1, coatSway: 0, punch: 2, kick: 0 },
      { bob: 0, headBob: 0, legL: 1, legR: -1, armSwing: 0, capeWave: -1, coatSway: 0, punch: 0, kick: 2 },
      { bob: 1, headBob: 0, legL: -2, legR: 2, armSwing: 0, capeWave: 2, coatSway: 1, punch: 4, kick: 0 },
      { bob: 0, headBob: 1, legL: -2, legR: 2, armSwing: 0, capeWave: 2, coatSway: 1, punch: 0, kick: 0, overhead: 1 },
      { bob: 0, headBob: 0, legL: -1, legR: 1, armSwing: 0, capeWave: -1, coatSway: -1, punch: 0, kick: 0, windup: 1, wind: -2, dip: 0, brace: 0, slam: 0 },
      { bob: 1, headBob: 1, legL: -2, legR: 2, armSwing: 0, capeWave: 2, coatSway: 1, punch: 0, kick: 0, windup: 0, wind: 3, dip: 5, brace: 1, slam: 1 },
      // M8 normals: palm(6) elbow(7) backfist(8) cobra(9) hook(10) sweep(11).
      { bob: 0, headBob: 0, legL: -1, legR: 1, armSwing: 0, capeWave: 1, coatSway: 0, punch: 0, kick: 0, palm: 1, wind: 1 },
      { bob: 0, headBob: 0, legL: -2, legR: 2, armSwing: 0, capeWave: 1, coatSway: 1, punch: 0, kick: 0, elbow: 1, wind: 2, dip: 2 },
      { bob: 0, headBob: 1, legL: -1, legR: 2, armSwing: 0, capeWave: 2, coatSway: 1, punch: 0, kick: 0, backfist: 1, wind: 2 },
      { bob: 1, headBob: 0, legL: -2, legR: 2, armSwing: 0, capeWave: 3, coatSway: 2, punch: 0, kick: 0, cobra: 1, wind: 5, dip: 2, brace: 1 },
      { bob: 0, headBob: 0, legL: -1, legR: 2, armSwing: 0, capeWave: -2, coatSway: -1, punch: 0, kick: 0, hook: 1, wind: 2, brace: 1 },
      { bob: 0, headBob: 1, legL: -2, legR: 2, armSwing: 0, capeWave: 1, coatSway: 0, punch: 0, kick: 0, sweep: 1, crouch: 1 },
      // 12: SAMURAI EDGE — leveled pistol, both hands extended (post-M14.5).
      { bob: 0, headBob: 0, legL: -2, legR: 2, armSwing: 0, capeWave: 1, coatSway: 0, punch: 0, kick: 0, gun: 1, wind: 1, brace: 1 },
    ],
    // M2 poses. Every entry carries the full field set (missing fields read
    // as `undefined`, which is falsy — safe for the stance branches above).
    crouch: [
      { bob: 0, headBob: 0, legL: 0, legR: 0, armSwing: 0, capeWave: 0, coatSway: 0, punch: 0, kick: 0, crouch: 1, air: 0, dash: 0 },
      { bob: 1, headBob: 0, legL: 0, legR: 0, armSwing: 0, capeWave: 1, coatSway: 1, punch: 0, kick: 0, crouch: 1, air: 0, dash: 0 },
    ],
    sneak: [
      { bob: 0, headBob: 0, legL: -2, legR: 2, armSwing: 1, capeWave: -1, coatSway: -1, punch: 0, kick: 0, crouch: 1, air: 0, dash: 0 },
      { bob: 1, headBob: 0, legL: 0, legR: 0, armSwing: 0, capeWave: 0, coatSway: 0, punch: 0, kick: 0, crouch: 1, air: 0, dash: 0 },
      { bob: 0, headBob: 0, legL: 2, legR: -2, armSwing: -1, capeWave: 1, coatSway: 1, punch: 0, kick: 0, crouch: 1, air: 0, dash: 0 },
      { bob: 1, headBob: 0, legL: 0, legR: 0, armSwing: 0, capeWave: 0, coatSway: 0, punch: 0, kick: 0, crouch: 1, air: 0, dash: 0 },
    ],
    jump: [
      { bob: 0, headBob: -1, legL: 0, legR: 0, armSwing: -2, capeWave: 3, coatSway: 2, punch: 0, kick: 0, crouch: 0, air: 1, dash: 0 }, // rise
      { bob: 0, headBob: 1, legL: 0, legR: 0, armSwing: 1, capeWave: -2, coatSway: -1, punch: 0, kick: 0, crouch: 0, air: 2, dash: 0 },  // fall
    ],
    dash: [
      { bob: 0, headBob: 0, legL: 0, legR: 0, armSwing: 0, capeWave: -3, coatSway: -2, punch: 0, kick: 0, crouch: 0, air: 0, dash: 1 },
      { bob: 1, headBob: 0, legL: 0, legR: 0, armSwing: 0, capeWave: -2, coatSway: -1, punch: 0, kick: 0, crouch: 0, air: 0, dash: 1 },
    ],
    // M4 guard stances: stand guard (braced, leaned back) + crouch guard.
    block: [
      { bob: 0, headBob: 0, legL: -1, legR: 1, armSwing: 0, capeWave: -1, coatSway: -1, punch: 0, kick: 0, guard: 1, brace: 1, wind: -1 },
      { bob: 0, headBob: 1, legL: 0, legR: 0, armSwing: 0, capeWave: 0, coatSway: 0, punch: 0, kick: 0, guard: 2, crouch: 1 },
    ],
    // M6 grab reach: driven forward onto braced legs, arms extended.
    grab: [
      { bob: 0, headBob: 0, legL: -1, legR: 1, armSwing: 0, capeWave: -3, coatSway: -2, punch: 0, kick: 0, seize: 1, brace: 1, wind: 3 },
    ],
    // M10 Wesker specials: jaguar tackle + unmasked rage stand. (Homelander
    // builds the same table but never displays it — unknown flags fall
    // through to neutral arms, so the shared builder stays total.)
    // M11 Homelander specials: heat-vision gaze (2) + sonic scream (3).
    // (Wesker builds them too; never displayed — same fallthrough deal.)
    special: [
      { bob: 0, headBob: 1, legL: -3, legR: 3, armSwing: 0, capeWave: -3, coatSway: -3, punch: 0, kick: 0, tackle: 1, brace: 1, wind: 4, dip: 3 },
      { bob: 0, headBob: 0, legL: 0, legR: 0, armSwing: 0, capeWave: 2, coatSway: 1, punch: 0, kick: 0, unmasked: 1 },
      { bob: 0, headBob: 0, legL: -1, legR: 1, armSwing: 0, capeWave: -1, coatSway: 0, punch: 0, kick: 0, lase: 1, brace: 1, wind: 2 },
      { bob: 0, headBob: -3, legL: -2, legR: 2, armSwing: 0, capeWave: -3, coatSway: -2, punch: 0, kick: 0, shout: 1, brace: 1, wind: -1 },
    ],
    // Effort: strain (Homelander's throw-toss grimace).
    strain: [
      { bob: 0, headBob: 1, legL: -1, legR: 2, armSwing: 0, capeWave: -1, coatSway: -1, punch: 0, kick: 0, strain: 1, brace: 1, wind: 1, dip: 2 },
    ],
  };
}

export function buildSprites(kind) {
  const table = poses(kind);
  const paint = kind === "wesker" ? paintWesker : paintHomelander;
  const out = {}; // keys follow the pose table, so new states need no extra code
  for (const key of Object.keys(table)) {
    out[key] = [];
    for (const p of table[key]) {
      const [c, ctx] = makeCanvas(SPRITE_W, SPRITE_H);
      paint(ctx, p);
      out[key].push(c);
    }
  }
  return out;
}

// Empty pixel rows below the boot bottoms in grounded stances (boots end on
// row 48 of the 52-tall canvas). Fighter.draw offsets by this so feet sit
// exactly on the ground plane instead of floating above it.
export const FEET_PAD = 4;

// Big readable portrait for character-select cards (head zoom, still pixelated).
export function buildPortrait(kind) {
  const sprites = buildSprites(kind);
  const src = sprites.idle[0];
  const [c, ctx] = makeCanvas(32, 32);
  // Crop head area (x 10..26, y 4..20) and scale up 2x with smoothing off.
  ctx.drawImage(src, 10, 4, 16, 16, 0, 0, 32, 32);
  return c;
}
