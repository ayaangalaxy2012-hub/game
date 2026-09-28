// Entry point: game states, main loop, scene composition.
// M2 scope: menus + scene with movement state machines (walk / crouch /
// sneak / jump / dash), camera, map, particles. No damage or AI yet.
//
// JS concept vs Python: ES modules use `import`/`export` (static, resolved by
// the browser). `requestAnimationFrame(loop)` is the browser's vsync game-loop
// clock — unlike Python's `while True`, it yields to the browser each frame.
import { VIEW_W, VIEW_H, STATE, GROUND_Y, MOVE } from "./config.js";
import { arena, setArena, arenaCenter } from "./arena.js";
import { initInput, keys } from "./input.js";
import { Camera } from "./camera.js";
import { Fighter, FState } from "./characters/fighter.js";
import { AIController } from "./ai.js";
import { pickMap, MAPS } from "./maps/index.js";
import { separate } from "./physics.js";
import { Hitstop, hurtboxOf, hitboxOf } from "./combat/combat.js";
import { RAGE } from "./combat/data.js";
import { Particles, drawShadow, Sparks, Clones, Beams, Missiles } from "./effects.js";
import { initScreens } from "./ui/screens.js";
import { buildPortrait } from "./render/sprites.js";
import { CHARACTERS } from "./characters/data.js";
import { AudioFX } from "./audio.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false; // crisp pixels everywhere

const sel = { p1: "wesker", p2: "homelander", diff: "medium" };
let state = STATE.MENU;
let map = MAPS.forest;
let ai = null; // M12 CPU pilot for P2 (null = second human drives P2)
const DIFF_LABEL = Object.freeze({ easy: "EASY", medium: "MEDIUM", extreme: "EXTREME", "2p": "2P VERSUS" });
// Ambient FX are owned by the map (M13): kind/count come from map data and
// cover the live arena width, not a hardcoded strip.
let particles = new Particles(map.particles.kind, map.particles.count, { w: arena.width, h: VIEW_H });
let p1 = new Fighter(sel.p1, arenaCenter() - 120, GROUND_Y);
let p2 = new Fighter(sel.p2, arenaCenter() + 120, GROUND_Y);
const cam = new Camera();
let elapsed = 0;
// M14 KO presentation state: armed by the finisher, reset with the round.
let koSeen = false, koT = 0, koWinner = null; // winner: "p1" | "p2" | "draw"
// Cached HUD head portraits (32px canvases) — built once per match.
let hudPort = null;
// Previous frame's key set: comparing with `keys` gives us edge-triggered
// presses (jump, taps) while holds (walk, crouch) just read the live set.
// JS concept vs Python: `new Set(keys)` copies the set — like `set(keys)`.
let prevKeys = new Set();
// Double-tap trackers, one per fighter: { key, t } of the last direction tap.
let tap1 = { key: null, t: -9 };
let tap2 = { key: null, t: -9 };

function enterFight(mapId) {
  map = pickMap(mapId);
  setArena(map.width); // install this stage's collision bounds (M13)
  particles = new Particles(map.particles.kind, map.particles.count, { w: arena.width, h: VIEW_H });
  hudPort = { p1: buildPortrait(sel.p1), p2: buildPortrait(sel.p2) }; // M14 HUD faces
  resetRound(); // fighters + AI pilot + cleared clocks/FX
  state = STATE.FIGHT;
  screens.show(null); // hide DOM overlays, reveal fight toolbar via class toggle
  document.getElementById("fight-bar").classList.remove("hidden");
  document.getElementById("fight-label").textContent =
    `${map.name} — CPU ${DIFF_LABEL[sel.diff] ?? sel.diff}`;
}

// Fresh fighters: positions + full health + cleared clocks/FX. Every effect
// list is wiped so a rematch never inherits last round's debris.
function resetRound() {
  p1 = new Fighter(sel.p1, arenaCenter() - 120, GROUND_Y);
  p2 = new Fighter(sel.p2, arenaCenter() + 120, GROUND_Y);
  ai = sel.diff === "2p" ? null : new AIController(sel.diff);
  Hitstop.t = 0;
  cam.trauma = 0;
  Sparks.list.length = 0;
  Clones.list.length = 0;
  Beams.list.length = 0;
  Missiles.list.length = 0;
  koSeen = false;
  koT = 0;
  koWinner = null;
}

const screens = initScreens(sel, {
  onState: (s) => { state = STATE[s]; },
  onPickMap: (id) => enterFight(id),
  onQuit: () => { state = STATE.MENU; },
  onSwapMap: () => {
    const ids = Object.keys(MAPS);
    const next = ids[(ids.indexOf(map.id) + 1) % ids.length];
    enterFight(next);
  },
});

// Per-fighter control mapping. P2 mirrors P1 on arrows + right-hand keys so
// combat can be tested with two humans (AI arrives M12). M10 specials: P1 on
// Space/F/O, P2 mirror on ;/'/P (temporary until AI takes P2).
const CONTROLS = {
  p1: { left: "a", right: "d", jump: "w", crouch: "s", light: "j", heavy: "k", grab: "l", edge: "e", s1: " ", s2: "f", s3: "o" },
  p2: { left: "arrowleft", right: "arrowright", jump: "arrowup", crouch: "arrowdown", light: ",", heavy: ".", grab: "/", edge: "shift", s1: ";", s2: "'", s3: "p" },
};
// Special ids per slot (M11 fills homelander's kit; trySpecial refuses unknown).
const SPECIALS = { s1: "jaguar", s2: "phantom", s3: "ragemode" };

// Debug overlay: hurtboxes (green) + live hitboxes (yellow). Toggle with H.
let showBoxes = false;

// Drive one fighter from its key mapping. Holds set continuous intents;
// fresh presses (in `prevKeys`) queue one-shot actions. A second tap of the
// same direction within TAP_WINDOW becomes a dash (AA / DD). Blocking is
// directional: holding AWAY guards at fighting range and walks back farther
// out (proximity guard, M4). With S also held the guard drops low — S alone
// only ever crouches, never blocks.
function drive(fighter, map, tap, foe) {
  fighter.moving = (keys.has(map.left) ? -1 : 0) + (keys.has(map.right) ? 1 : 0);
  fighter.crouchHeld = keys.has(map.crouch);
  const awayKey = foe.x >= fighter.x ? map.left : map.right;
  fighter.blockHeld = keys.has(awayKey);
  if (!prevKeys.has(map.jump) && keys.has(map.jump)) fighter.queueJump();
  const lEdge = !prevKeys.has(map.light) && keys.has(map.light);
  const hEdge = !prevKeys.has(map.heavy) && keys.has(map.heavy);
  const eEdge = !prevKeys.has(map.edge) && keys.has(map.edge);
  // Samurai Edge (E / Shift): dedicated key, single press. Wesker-only
  // burst firearm — instant from neutral, guard, dash, stun, or mid-swing,
  // with i-frames (fighter decides the gates). Falls back to heavy so the
  // key never feels dead — Homelander has no gun, so his E routes to the
  // grab via pressHeavy.
  if (eEdge) {
    if (!fighter.trySamuraiEdge()) fighter.pressHeavy();
  }
  if (lEdge) fighter.pressLight();
  if (hEdge) fighter.pressHeavy();
  if (!prevKeys.has(map.grab) && keys.has(map.grab)) fighter.pressGrab();
  for (const slot of ["s1", "s2", "s3"]) {
    if (!prevKeys.has(map[slot]) && keys.has(map[slot])) fighter.trySpecial(SPECIALS[slot], foe);
  }
  for (const [key, dir] of [[map.left, -1], [map.right, 1]]) {
    if (!prevKeys.has(key) && keys.has(key)) {
      if (tap.key === key && elapsed - tap.t < MOVE.TAP_WINDOW) {
        fighter.queueDash(dir); // screen dir; fighter resolves fwd vs back
        tap.key = null;
      } else {
        tap.key = key;
        tap.t = elapsed;
      }
    }
  }
}

function pollMoveInput(dt) {
  drive(p1, CONTROLS.p1, tap1, p2);
  if (ai) ai.update(dt, p2, p1); // CPU pilots P2 (same clock as the fight)
  else drive(p2, CONTROLS.p2, tap2, p1); // ...or a second human does
  if (!prevKeys.has("m") && keys.has("m")) {
    document.getElementById("btn-swap-map").click();
  }
  if (!prevKeys.has("escape") && keys.has("escape")) {
    state = STATE.MENU;
    screens.show("screen-menu");
  }
  if (!prevKeys.has("h") && keys.has("h")) showBoxes = !showBoxes;
  if (!prevKeys.has("r") && keys.has("r")) resetRound(); // test hook (rematch is M15)
  // M9 test hooks: grant a rage level (specials arrive M10/M11).
  if (!prevKeys.has("t") && keys.has("t")) p1.addRage(RAGE.PER_LEVEL);
  if (!prevKeys.has("u") && keys.has("u")) p2.addRage(RAGE.PER_LEVEL);
  prevKeys = new Set(keys);
}

function drawHUD() {
  // M14 HUD: head portraits + real names beside the M3 health bars; rage
  // meters (M9) sit under each bar; timer + rounds arrive in M15.
  const drawPort = (img, x) => {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x - 2, 2, 44, 44);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x, 4, 40, 40);
  };
  if (hudPort) {
    drawPort(hudPort.p1, 20);
    drawPort(hudPort.p2, VIEW_W - 60);
  }
  const drawBar = (x, label, color, frac) => {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x, 34, 300, 22);
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(x + 2, 36, 296, 18);
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, 36, Math.max(0, 296 * frac), 18);
    ctx.fillStyle = "#fff";
    ctx.font = "12px 'Courier New', monospace";
    ctx.fillText(label, x + 6, 49);
  };
  drawBar(70, `P1 ${CHARACTERS[p1.kind].name} ${Math.ceil(p1.hp)}/${p1.maxHp}`, "#3ecf5a", p1.hp / p1.maxHp);
  drawBar(VIEW_W - 370, `P2 ${CHARACTERS[p2.kind].name} ${Math.ceil(p2.hp)}/${p2.maxHp}`, "#ff4b4b", p2.hp / p2.maxHp);
  // M9 rage meters: 3 segments under each bar, filling left to right. A fresh
  // level flashes white (fighter.rageFlash) — the "now available" signal.
  const drawRage = (x, f) => {
    const segW = 96, segH = 12, gap = 4, y = 60;
    const cols = ["#ffb13e", "#ff7a3e", "#ff3b3b"];
    for (let i = 0; i < 3; i++) {
      const bx = x + i * (segW + gap);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(bx, y, segW, segH);
      const fill = Math.max(0, Math.min(1, (f.rage - i * RAGE.PER_LEVEL) / RAGE.PER_LEVEL));
      if (fill > 0) {
        ctx.fillStyle = cols[i];
        ctx.fillRect(bx + 1, y + 1, (segW - 2) * fill, segH - 2);
      }
      ctx.strokeStyle = f.rageFlash > 0 ? "#ffffff" : "#3a3a4d";
      ctx.lineWidth = f.rageFlash > 0 ? 2 : 1;
      ctx.strokeRect(bx + 0.5, y + 0.5, segW - 1, segH - 1);
    }
    ctx.fillStyle = f.rageLevel > 0 ? "#ffd23e" : "#8a8a9a";
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.fillText(`RAGE ${f.rageLevel}/3`, x + 3 * (segW + gap) + 6, y + 11);
  };
  drawRage(70, p1);
  drawRage(VIEW_W - 370, p2);
  // Debug readout: live state per fighter (proves the machine works).
  ctx.font = "12px 'Courier New', monospace";
  ctx.fillStyle = "#9fd4ff";
  const tag = (f, x) => {
    const air = f.grounded ? "GRND" : "AIR ";
    const extra = f.state === FState.SPECIAL && f.specialId ? `:${f.specialId}` : "";
    ctx.fillText(`${f.kind.toUpperCase()} ${f.state}${extra} ${air}${f.isLow ? " LOW" : ""}`, x, 88);
  };
  tag(p1, 20);
  const label2 = `${p2.kind.toUpperCase()} ${p2.state}${p2.state === FState.SPECIAL && p2.specialId ? `:${p2.specialId}` : ""} ${p2.grounded ? "GRND" : "AIR "}${p2.isLow ? " LOW" : ""}`;
  ctx.fillText(label2, VIEW_W - 20 - ctx.measureText(label2).width, 88);
  // M14 KO presentation: stamped K.O. + dim, winner portrait after the
  // slow-mo settles, rematch hint. (Rounds/timer are M15.)
  if (koSeen) {
    const cx = VIEW_W / 2;
    ctx.fillStyle = "rgba(8,4,12,0.45)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(cx, VIEW_H / 2 - 70);
    const pop = Math.min(1, koT / 0.25);
    ctx.scale(0.55 + 0.45 * pop, 0.55 + 0.45 * pop);
    ctx.textAlign = "center";
    ctx.font = "bold 90px 'Courier New', monospace";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#2a0a0a";
    ctx.strokeText("K.O.", 0, 0);
    ctx.fillStyle = "#ff3b3b";
    ctx.fillText("K.O.", 0, 0);
    ctx.restore();
    if (koT >= 1.4) { // after the slow-mo: name the winner
      ctx.textAlign = "center";
      if (koWinner === "draw") {
        ctx.fillStyle = "#ffd23e";
        ctx.font = "bold 30px 'Courier New', monospace";
        ctx.fillText("DRAW GAME", cx, VIEW_H / 2 + 10);
      } else {
        const f = koWinner === "p1" ? p1 : p2;
        const meta = CHARACTERS[f.kind];
        ctx.fillStyle = meta.accent;
        ctx.font = "bold 30px 'Courier New', monospace";
        ctx.fillText(`${meta.name} WINS`, cx, VIEW_H / 2 + 10);
        const img = hudPort?.[koWinner];
        if (img) {
          const S = 96;
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(cx - S / 2 - 4, VIEW_H / 2 + 24, S + 8, S + 8);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, cx - S / 2, VIEW_H / 2 + 28, S, S);
        }
      }
      ctx.fillStyle = "#fff";
      ctx.font = "16px 'Courier New', monospace";
      ctx.fillText("press R to rematch  •  ESC for menu", cx, VIEW_H / 2 + 150);
      ctx.textAlign = "left";
    }
  }
}

// Hitbox/hurtbox debug overlay (toggled with H).
function drawBoxes() {
  const rect = (r, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(r.x - cam.x), Math.round(r.y), Math.round(r.w), Math.round(r.h));
  };
  for (const f of [p1, p2]) rect(hurtboxOf(f), f.hp > 0 ? "#3ecf5a" : "#555555");
  for (const f of [p1, p2]) {
    if (f.state === FState.ATTACK && f.phase === "active" && !f.hasHit) {
      rect(hitboxOf(f, f.attackMove), "#ffd23e");
    }
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  elapsed += dt;

  if (state === STATE.FIGHT) {
    // M14 KO watch: fires once when a health bar empties (either path —
    // clean hit or chip). Punches hitstop, camera, sting, and the burst.
    if (!koSeen && (p1.hp <= 0 || p2.hp <= 0)) {
      koSeen = true;
      koT = 0;
      koWinner = p1.hp <= 0 && p2.hp <= 0 ? "draw" : p1.hp <= 0 ? "p2" : "p1";
      const loser = p1.hp <= 0 ? p1 : p2;
      Hitstop.t = Math.max(Hitstop.t, 0.30);
      cam.kick(0.75);
      AudioFX.ko();
      Sparks.ko(loser.x, loser.y - 70);
    }
    if (koSeen) koT += dt;
    // Slow-mo: ~1.4s of drift after the finishing blow (sim scales, UI doesn't).
    const simDt = koSeen && koT < 1.4 ? dt * 0.35 : dt;
    pollMoveInput(simDt);
    if (Hitstop.t > 0) {
      Hitstop.t -= dt; // impact freeze: render continues, bodies don't move
    } else {
      p1.update(simDt, p2);
      p2.update(simDt, p1);
      // No body separation mid-clinch or mid-super: scripted positions
      // (carry grip, teleports, driving tackles) own the spacing on purpose.
      const clinch =
        p1.state === FState.GRAB || p2.state === FState.GRAB ||
        p1.state === FState.THROWN || p2.state === FState.THROWN ||
        p1.state === FState.SPECIAL || p2.state === FState.SPECIAL;
      if (!clinch) separate(p1, p2); // soft pushbox otherwise
      Sparks.update(simDt);
      Clones.update(simDt);
      Beams.update(simDt);
      Missiles.update(simDt);
      // Consume combat reports (M14): guard flash on blocks, red star +
      // damage-scaled camera kick on clean hits.
      for (const f of [p1, p2]) {
        const c = f.lastContact;
        f.lastContact = null;
        if (!c) continue;
        if (c.type === "block") {
          Sparks.block(c.x, c.y);
        } else {
          Sparks.hit(c.x, c.y, f.attackDir);
          cam.kick(Math.min(0.32, 0.07 + (c.weight || 5) * 0.012));
        }
      }
      // Drain camera trauma requested by supers (see f.camKick).
      for (const f of [p1, p2]) {
        if (f.camKick) {
          cam.kick(f.camKick);
          f.camKick = 0;
        }
      }
    }
    cam.update(simDt, p1, p2);
    particles.update(simDt);
    // World draws ride inside the trauma offset (HUD stays locked).
    ctx.save();
    ctx.translate(cam.shakeX(elapsed), cam.shakeY(elapsed));
    // Draw order: map (all parallax layers) -> shadows -> fighters -> particles -> light/HUD
    map.draw(ctx, cam.x, elapsed);
    drawShadow(ctx, p1.x, GROUND_Y, cam.x);
    drawShadow(ctx, p2.x, GROUND_Y, cam.x);
    // Draw far fighter first so overlap looks correct.
    const [back, front] = p1.y <= p2.y ? [p1, p2] : [p2, p1];
    Clones.draw(ctx, cam.x); // afterimages behind the live fighters
    back.draw(ctx, cam.x);
    front.draw(ctx, cam.x);
    if (showBoxes) drawBoxes();
    Sparks.draw(ctx, cam.x);
    Beams.draw(ctx, cam.x); // heat rays over the fighters
    Missiles.draw(ctx, cam.x); // falling ordnance over everything
    particles.draw(ctx, cam.x, 0.7);
    ctx.restore();
    drawHUD();
  } else {
    // Behind menus: slowly pan the current map as an animated backdrop.
    cam.x = (Math.sin(elapsed * 0.05) * 0.5 + 0.5) * Math.max(0, arena.width - VIEW_W);
    map.draw(ctx, cam.x, elapsed);
  }
  requestAnimationFrame(loop);
}

initInput();
// P1 attacks on mouse (LMB light / RMB heavy). Keyboard J/K work too.
// Samurai Edge is on the E key (P1) / Shift (P2) — single press, handled in
// drive(), so the mouse path stays a plain single heavy with no timing code.
canvas.addEventListener("mousedown", (e) => {
  if (state !== STATE.FIGHT) return;
  if (e.button === 0) { p1.pressLight(); return; }
  if (e.button !== 2) return;
  p1.pressHeavy();
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
requestAnimationFrame(loop);
