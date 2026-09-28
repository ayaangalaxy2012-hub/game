// Ambient particles per map (leaves / lab sparks / rising city embers) +
// soft shadows. One tiny system reused by all maps instead of copy-pasted
// logic. M13: maps own {kind, count}; area covers the live arena width.
import { SPRITE_SCALE } from "./config.js";
import { FEET_PAD } from "./render/sprites.js";
export class Particles {
  constructor(kind, count, area) {
    this.kind = kind;
    this.area = area;
    this.list = [];
    for (let i = 0; i < count; i++) this.list.push(this.spawn(true));
  }
  spawn(anywhere = false) {
    const [w, h] = [this.area.w, this.area.h];
    return {
      x: Math.random() * w,
      // Embers are reborn near the ground (fires below) and rise; the
      // other kinds rain down from the top of the screen.
      y: anywhere ? Math.random() * h : this.kind === "embers" ? h - Math.random() * 80 : -10,
      vx: this.kind === "leaves" ? -30 - Math.random() * 40 : (Math.random() - 0.5) * 20,
      vy: this.kind === "leaves" ? 15 + Math.random() * 35
        : this.kind === "lab" ? 10 + Math.random() * 30
        : -(15 + Math.random() * 35), // embers RISE (city fires)
      s: 1 + Math.floor(Math.random() * 3),
      ph: Math.random() * 10,
    };
  }
  update(dt) {
    for (const p of this.list) {
      p.ph += dt;
      p.x += (p.vx + Math.sin(p.ph * 2) * 12) * dt;
      p.y += p.vy * dt;
      const goneY = this.kind === "embers" ? p.y < -12 : p.y > this.area.h + 12;
      if (goneY || p.x < -12 || p.x > this.area.w + 12) Object.assign(p, this.spawn());
    }
  }
  draw(ctx, camX, parallax = 1) {
    for (const p of this.list) {
      const x = p.x - camX * parallax;
      if (x < -10 || x > 980) continue;
      if (this.kind === "leaves") ctx.fillStyle = (p.s > 2 ? "#6fae4e" : "#3f7030");
      else if (this.kind === "lab") ctx.fillStyle = (p.s > 2 ? "#9fd4ff" : "#3a6a9f");
      else ctx.fillStyle = (p.s > 2 ? "#ff9a3e" : "#7a3a1a");
      ctx.fillRect(Math.round(x), Math.round(p.y), p.s, p.s);
    }
  }
}

// Soft ellipse shadow under each fighter (grounds them on the plane).
export function drawShadow(ctx, xWorld, yGround, camX, w = 84, alpha = 0.35) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(Math.round(xWorld - camX), Math.round(yGround + 6), w / 2, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Phantom afterimages ("clones"): fading silhouette snapshots left behind
// by teleports and burst dashes. Logic spawns them with a canvas; main.js
// draws them behind the live fighters and ticks them with everything else.
// JS concept vs Python: `img` here is just an object reference (like any
// Python object) — no copy is made, the snapshot reads the shared canvas.
export const Clones = {
  list: [],
  // style "ghost" (translucent copy) or "shadow" (solid black silhouette —
  // the speed-afterimage of something moving too fast to see).
  spawn(img, xFeet, yFeet, facing, life = 0.4, style = "ghost") {
    let dark = null;
    if (style === "shadow") {
      dark = document.createElement("canvas");
      dark.width = img.width;
      dark.height = img.height;
      const dctx = dark.getContext("2d");
      dctx.imageSmoothingEnabled = false;
      dctx.drawImage(img, 0, 0);
      dctx.globalCompositeOperation = "source-in";
      dctx.fillStyle = "#050508";
      dctx.fillRect(0, 0, dark.width, dark.height);
    }
    this.list.push({ img, dark, style, x: xFeet, y: yFeet, facing, t: 0, life });
  },
  update(dt) {
    for (const c of this.list) c.t += dt;
    this.list = this.list.filter((c) => c.t < c.life);
  },
  draw(ctx, camX) {
    for (const c of this.list) {
      const pic = c.style === "shadow" && c.dark ? c.dark : c.img;
      const w = pic.width * SPRITE_SCALE;
      const h = pic.height * SPRITE_SCALE;
      const dx = Math.round(c.x - camX - w / 2);
      const dy = Math.round(c.y - h + FEET_PAD * SPRITE_SCALE);
      ctx.save();
      // Shadows read denser and die faster than ghosts.
      ctx.globalAlpha = c.style === "shadow" ? 0.8 * (1 - c.t / c.life) : 0.45 * (1 - c.t / c.life);
      if (c.facing === 1) {
        ctx.drawImage(pic, dx, dy, w, h);
      } else {
        ctx.translate(dx + w, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(pic, 0, 0, w, h);
      }
      ctx.restore();
    }
  },
};
// Impact sparks. M4 spawns the blue guard flash on blocks (clear feedback
// that no damage was taken); red hit sparks + bigger effects arrive in M14.
// JS concept vs Python: methods here use `this` (like self) — but the
// receiver is implicit. `Sparks.block(...)` sets this=Sparks automatically.
export const Sparks = {
  list: [],
  block(x, y) {
    this.list.push({ x, y, t: 0, life: 0.18, kind: "flash" });
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2; // upward fan
      const sp = 120 + Math.random() * 220;
      this.list.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        t: 0, life: 0.25 + Math.random() * 0.15, kind: "shard",
      });
    }
  },
  // M14 clean-hit impact: white-hot star + red-hot shards sprayed in the
  // knock direction (the consumer in main.js passes attacker.attackDir).
  hit(x, y, dir = 1) {
    this.list.push({ x, y, t: 0, life: 0.16, kind: "hitflash" });
    for (let i = 0; i < 8; i++) {
      const spread = (Math.random() - 0.5) * 1.7;
      const a = (dir >= 0 ? 0 : Math.PI) + spread;
      const sp = 140 + Math.random() * 260;
      this.list.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70,
        t: 0, life: 0.22 + Math.random() * 0.18, kind: "hshard",
      });
    }
  },
  // M14.5 Samurai Edge muzzle: hot star + forward spark spray (dir = shot).
  muzzle(x, y, dir) {
    this.list.push({ x, y, t: 0, life: 0.09, kind: "hitflash" });
    for (let i = 0; i < 5; i++) {
      this.list.push({
        x, y,
        vx: dir * (160 + Math.random() * 200),
        vy: (Math.random() - 0.5) * 120,
        t: 0, life: 0.1 + Math.random() * 0.1, kind: "hshard",
      });
    }
  },
  // M14 movement dust: ground kick-up for dash takeoff / land / jump.
  dust(x, y) {
    for (let i = 0; i < 5; i++) {
      this.list.push({
        x: x + (Math.random() - 0.5) * 36, y: y - 2,
        vx: (Math.random() - 0.5) * 130, vy: -40 - Math.random() * 70,
        t: 0, life: 0.24 + Math.random() * 0.16, kind: "dust",
      });
    }
  },
  // M14 KO finale: crater ring + doubled gore + flash + twin shard fans.
  ko(x, y) {
    this.list.push({ x, y, t: 0, life: 0.25, kind: "hitflash" });
    this.ring(x, y, 170);
    this.blood(x, y);
    this.blood(x, y);
    this.puff(x, y);
    for (const dir of [1, -1]) {
      for (let i = 0; i < 6; i++) {
        this.list.push({
          x, y,
          vx: dir * (120 + Math.random() * 260),
          vy: -80 - Math.random() * 170,
          t: 0, life: 0.30 + Math.random() * 0.2, kind: "hshard",
        });
      }
    }
  },
  update(dt) {
    for (const s of this.list) {
      s.t += dt;
      if (s.kind === "shard" || s.kind === "hshard") {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 900 * dt; // shards arc down like struck sparks
      } else if (s.kind === "dust") {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 320 * dt;  // light kick-up, settles fast
        s.vx *= Math.max(0, 1 - 3 * dt);
      } else if (s.kind === "mote" || s.kind === "vmote" || s.kind === "wisp") {
        s.x += s.vx * dt;
        s.y += s.vy * dt; // embers rise, poof wisps drift
      } else if (s.kind === "blood") {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 1400 * dt; // gore falls fast
      }
    }
    this.list = this.list.filter((s) => s.t < s.life);
  },
  // M10 teleport poof: violet-white burst + slow drifting wisps.
  puff(x, y) {
    this.list.push({ x, y, t: 0, life: 0.22, kind: "poof" });
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 130;
      this.list.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        t: 0, life: 0.35 + Math.random() * 0.2, kind: "wisp",
      });
    }
  },
  // M10 rage ember: one rising red spark (spawn per-frame for an aura).
  ember(x, y) {
    this.list.push({
      x, y,
      vx: (Math.random() - 0.5) * 40, vy: -120 - Math.random() * 80,
      t: 0, life: 0.3 + Math.random() * 0.15, kind: "mote",
    });
  },
  // M11 sonic ring: expanding square shockwave from a scream.
  ring(x, y, maxR = 150) {
    this.list.push({ x, y, maxR, t: 0, life: 0.32, kind: "ring" });
  },
  // M11 laser burn: red droplets flung from the victim (pixel gore, brief).
  blood(x, y) {
    for (let i = 0; i < 4; i++) {
      this.list.push({
        x: x + (Math.random() - 0.5) * 10, y,
        vx: (Math.random() - 0.5) * 260, vy: -80 - Math.random() * 160,
        t: 0, life: 0.4 + Math.random() * 0.15, kind: "blood",
      });
    }
  },
  // Phantom violet: slow rising phantom-flame mote (jaguar trail + strikes).
  violet(x, y) {
    this.list.push({
      x, y,
      vx: (Math.random() - 0.5) * 60, vy: -60 - Math.random() * 60,
      t: 0, life: 0.35 + Math.random() * 0.15, kind: "vmote",
    });
  },
  draw(ctx, camX) {
    for (const s of this.list) {
      const x = Math.round(s.x - camX);
      const y = Math.round(s.y);
      if (s.kind === "flash") {
        // Expanding cross flash, white core + cyan halo (M4 guard).
        const r = Math.round(3 + s.t * 70);
        ctx.fillStyle = "#35e0ff";
        ctx.fillRect(x - r - 2, y - 1, r * 2 + 4, 2);
        ctx.fillRect(x - 1, y - r - 2, 2, r * 2 + 4);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - r, y - 1, r * 2, 2);
        ctx.fillRect(x - 1, y - r, 2, r * 2);
      } else if (s.kind === "hitflash") {
        // M14 clean-hit star: red-hot halo + white heart (bigger than block).
        const r = Math.round(4 + s.t * 95);
        ctx.fillStyle = "#ff4a2a";
        ctx.fillRect(x - r - 2, y - 2, r * 2 + 4, 4);
        ctx.fillRect(x - 2, y - r - 2, 4, r * 2 + 4);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - r, y - 1, r * 2, 2);
        ctx.fillRect(x - 1, y - r, 2, r * 2);
        ctx.fillRect(x - 3, y - 3, 6, 6);
      } else if (s.kind === "poof") {
        // Teleport burst: violet ring + white heart.
        const r = Math.round(4 + s.t * 90);
        ctx.fillStyle = "#8a6bff";
        ctx.fillRect(x - r, y - 2, r * 2, 4);
        ctx.fillRect(x - 2, y - r, 4, r * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - 3, y - 3, 6, 6);
      } else if (s.kind === "ring") {
        // Sonic shockwave: two expanding square outlines, fading.
        const k = s.t / s.life;
        const r = Math.max(2, Math.round(s.maxR * k));
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - r, y - 2, r * 2, 2);
        ctx.fillRect(x - r, y + 2, r * 2, 2);
        ctx.fillRect(x - r, y - r, 2, r * 2);
        ctx.fillRect(x + r - 2, y - r, 2, r * 2);
        ctx.fillStyle = "#9fd4ff";
        const r2 = Math.max(2, Math.round(s.maxR * Math.max(0, k - 0.15)));
        ctx.fillRect(x - r2, y - 1, r2 * 2, 1);
        ctx.fillRect(x - 1, y - r2, 1, r2 * 2);
        ctx.globalAlpha = 1;
      } else if (s.kind === "blood") {
        ctx.globalAlpha = Math.max(0, 1 - s.t / s.life);
        ctx.fillStyle = "#c01414";
        ctx.fillRect(x, y, 2, 2);
        ctx.globalAlpha = 1;
      } else if (s.kind === "mote" || s.kind === "vmote") {
        // Rage ember: hot red-orange riser. Violet: phantom-flame riser.
        ctx.globalAlpha = Math.max(0, 1 - s.t / s.life);
        if (s.kind === "vmote") ctx.fillStyle = s.t / s.life > 0.5 ? "#8a3aff" : "#c9a8ff";
        else ctx.fillStyle = s.t / s.life > 0.5 ? "#ff3b1a" : "#ffb13e";
        ctx.fillRect(x, y, 2, 3);
        ctx.globalAlpha = 1;
      } else if (s.kind === "dust") {
        // Ground kick-up: tan motes that fade as they settle.
        ctx.globalAlpha = Math.max(0, 1 - s.t / s.life);
        ctx.fillStyle = "#9a8f7a";
        ctx.fillRect(x, y, 2, 2);
        ctx.globalAlpha = 1;
      } else {
        // Shards (block), hit shards (white→red over life), and wisps.
        ctx.globalAlpha = Math.max(0, 1 - s.t / s.life);
        ctx.fillStyle = s.kind === "wisp" ? "#c9b8ff"
          : s.kind === "hshard" ? (s.t / s.life > 0.5 ? "#ff4a2a" : "#ffffff")
          : "#bff4ff";
        ctx.fillRect(x, y, s.kind === "hshard" ? 3 : 2, 2);
        ctx.globalAlpha = 1;
      }
    }
  },
};

// M11 heat-vision beams: red halo + white core + hot impact head. Logic
// spawns them with world coords; main.js draws them over the fighters.
// (Wesker rework) 30-ton air missile: dropped from the sky onto a locked
// ground target, then a crater bloom. Flight time is passed in so the
// caller can sync the visual bloom with its own gameplay impact frame.
export const Missiles = {
  list: [],
  launch(targetX, targetY, fallTime = 0.55) {
    this.list.push({
      sx: targetX + 140, sy: -60, tx: targetX, ty: targetY,
      t: 0, fall: fallTime,
    });
  },
  arrived(m) {
    return m.t >= m.fall;
  },
  update(dt) {
    for (const m of this.list) m.t += dt;
    // Body flies for `fall`, crater bloom lingers 0.5 more, then gone.
    this.list = this.list.filter((m) => m.t < m.fall + 0.5);
  },
  draw(ctx, camX) {
    for (const m of this.list) {
      const k = Math.min(1, m.t / m.fall); // 0 sky -> 1 target
      const x = Math.round(m.sx + (m.tx - m.sx) * k - camX);
      const y = Math.round(m.sy + (m.ty - m.sy) * k);
      if (!this.arrived(m)) {
        // Falling body (post-M14.5, bigger): dark dart + long sputtering tail.
        ctx.fillStyle = "#ff7a1a";
        ctx.fillRect(x - 2, y - 26 - (m.t * 60 % 8), 5, 12);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - 1, y - 20 - (m.t * 60 % 5), 3, 6);
        ctx.fillStyle = "#1a1a20";
        ctx.fillRect(x - 4, y - 16, 8, 16);
        ctx.fillStyle = "#3a3a48";
        ctx.fillRect(x - 6, y - 5, 2, 6);
        ctx.fillRect(x + 4, y - 5, 2, 6);
        ctx.fillStyle = "#7a1a1a";
        ctx.fillRect(x - 4, y - 3, 8, 3);
      } else {
        // 30-ton crater bloom (post-M14.5): wide fire ring, rising fire
        // column, twin shockwave bars, thrown debris, white heart — all
        // scaled by ease-out so the blast detonates fast then settles.
        const e = Math.min(1, (m.t - m.fall) / 0.5);
        const ease = 1 - Math.pow(1 - e, 3); // cubic ease-out
        const r = Math.round(18 + ease * 130); // half-width, up to ~148px
        ctx.globalAlpha = Math.max(0, 1 - e * e);
        ctx.fillStyle = "#2a1a12"; // crater lip
        ctx.fillRect(x - r - 10, y - 8, (r + 10) * 2, 14);
        ctx.fillStyle = "#ff7a1a"; // wide fire ring
        ctx.fillRect(x - r, y - 5, r * 2, 10);
        ctx.fillStyle = "#ffd23e"; // hot inner ring
        ctx.fillRect(x - Math.round(r * 0.7), y - 4, Math.round(r * 1.4), 8);
        const colH = Math.round(ease * 150); // rising fire column
        ctx.fillStyle = "#ff7a1a";
        ctx.fillRect(x - 14, y - 22 - colH, 28, colH);
        ctx.fillStyle = "#ffd23e";
        ctx.fillRect(x - 8, y - 22 - Math.round(colH * 0.7), 16, Math.round(colH * 0.7));
        const r2 = Math.round(30 + ease * 190); // twin shockwave bars
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - r2, y - 10, r2 * 2, 3);
        ctx.fillRect(x - r2, y + 4, r2 * 2, 2);
        ctx.fillStyle = "#ffffff"; // white heart over the column base
        ctx.fillRect(x - 20, y - 16, 40, 14);
        ctx.fillRect(x - 12, y - 24, 24, 10);
        for (let d = 0; d < 10; d++) { // debris: deterministic upper-fan arc
          const a = Math.PI + ((d * 97) % 100) / 100 * Math.PI;
          const dist = ease * (70 + ((d * 53) % 90));
          const dx = Math.round(Math.cos(a) * dist);
          const dy = Math.round(Math.sin(a) * dist * 0.55) - Math.round(e * 30 * (1 - e));
          ctx.fillStyle = d % 3 ? "#3a3a48" : "#ff7a1a";
          ctx.fillRect(x + dx, y - 30 + dy, 3, 3);
        }
        ctx.globalAlpha = 1;
      }
    }
  },
};
export const Beams = {
  list: [],
  spawn(x1, y1, x2, y2, life = 0.12) {
    this.list.push({ x1, y1, x2, y2, t: 0, life });
  },
  update(dt) {
    for (const b of this.list) b.t += dt;
    this.list = this.list.filter((b) => b.t < b.life);
  },
  draw(ctx, camX) {
    for (const b of this.list) {
      const k = 1 - b.t / b.life; // flicker as it dies
      const x1 = Math.round(b.x1 - camX), y1 = Math.round(b.y1);
      const x2 = Math.round(b.x2 - camX), y2 = Math.round(b.y2);
      const w = Math.abs(x2 - x1);
      const x0 = Math.min(x1, x2);
      ctx.globalAlpha = 0.55 * k + 0.25;
      ctx.fillStyle = "#ff3b1a"; // halo
      ctx.fillRect(x0, y1 - 3, w, 7);
      ctx.globalAlpha = 0.9 * k + 0.1;
      ctx.fillStyle = "#ffffff"; // core
      ctx.fillRect(x0, y1 - 1, w, 3);
      ctx.fillStyle = "#ffd0d0"; // impact head
      ctx.fillRect(x2 - 4, y2 - 5, 8, 11);
      ctx.globalAlpha = 1;
    }
  },
};
