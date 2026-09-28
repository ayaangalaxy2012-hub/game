// UNDERGROUND LAB — cold artificial light, pipes, damaged machinery, glowing tanks.
import { VIEW_W, VIEW_H, GROUND_Y } from "../config.js";
import { px } from "../render/pixel.js";

export const lab = {
  id: "lab",
  name: "UNDERGROUND LAB",
  // M13: tightest arena — walls arrive sooner, corner game is real.
  width: 1500,
  desc: "Tight metal corridors — smallest stage, the walls close in fast.",
  particles: { kind: "lab", count: 55 },
  draw(ctx, camX, t) {
    // Distant wall (spans full height to GROUND_Y so no void shows behind
    // the sparse mid-layer machinery).
    px(ctx, 0, 0, VIEW_W, GROUND_Y, "#12141f");
    px(ctx, 0, 290, VIEW_W, 10, "#1e2233");
    // Distant glowing rooms/doors (parallax 0.2)
    for (let i = 0; i < 6; i++) {
      const x = ((i * 331 - camX * 0.2) % 1200 + 1200) % 1200 - 80;
      px(ctx, x, 150, 90, 120, "#0a0c14");
      px(ctx, x + 8, 160, 74, 60, "#12324a");
      const flick = (Math.sin(t * 3 + i * 2) > -0.9) ? "#9fd4ff" : "#3a6a9f";
      px(ctx, x + 8, 160, 74, 8, flick);
      px(ctx, x + 8, 200, 10, 10, "#ff3030"); // alarm dot
    }
    // Mid pipes + cables (parallax 0.5)
    px(ctx, 0, 90, VIEW_W, 14, "#2a2f45");
    px(ctx, 0, 120, VIEW_W, 8, "#1a1e2e");
    for (let i = 0; i < 9; i++) {
      const x = ((i * 271 - camX * 0.5) % 1300 + 1300) % 1300 - 80;
      px(ctx, x, 60, 22, 240, "#343a55");
      px(ctx, x, 60, 4, 240, "#4e587f");
      px(ctx, x - 6, 200, 34, 10, "#232842"); // clamp
      // hanging cable sway
      const sw = Math.round(Math.sin(t * 1.5 + i) * 4);
      px(ctx, x + 30 + sw, 128, 3, 90, "#0c0e16");
      // broken machine block
      px(ctx, x + 60, 250, 70, 60, "#232842");
      px(ctx, x + 60, 250, 70, 6, "#9fd4ff"); // lit top edge
      px(ctx, x + 76, 270, 20, 14, "#ff9a3e"); // warning stripe block
    }
    // Ground: metal floor with plates + hazard stripes
    px(ctx, 0, GROUND_Y, VIEW_W, VIEW_H - GROUND_Y, "#23262f");
    px(ctx, 0, GROUND_Y, VIEW_W, 5, "#4e587f");
    for (let i = 0; i < 20; i++) {
      const wx = i * 193;
      const x = wx - camX;
      if (x < -60 || x > VIEW_W + 60) continue;
      px(ctx, x, GROUND_Y + 20, 60, 3, "#16181f");
      if (i % 3 === 0) {
        for (let s = 0; s < 6; s++) px(ctx, x + s * 10, GROUND_Y + 40, 6, 8, s % 2 ? "#14141f" : "#8a6d00");
      }
    }
    // Foreground pipe silhouette (parallax 1.3)
    for (let i = 0; i < 6; i++) {
      const x = ((i * 431 - camX * 1.3) % 1200 + 1200) % 1200 - 80;
      px(ctx, x, VIEW_H - 60, 40, 60, "#0b0d14");
      px(ctx, x, VIEW_H - 60, 6, 60, "#1c2136");
    }
    // Preset artificial lighting: cool top glow + green tank spill
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, "rgba(159,212,255,0.14)");
    g.addColorStop(0.5, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  },
};
