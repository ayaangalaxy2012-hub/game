// RUINED FOREST — dusk greens, broken trees, stone ruins, fireflies.
import { VIEW_W, VIEW_H, GROUND_Y } from "../config.js";
import { px } from "../render/pixel.js";

function tree(ctx, x, baseY, s, dark) {
  const trunk = dark ? "#2a1f18" : "#4a3423";
  const leaf = dark ? "#1d3120" : "#2e5233";
  px(ctx, x, baseY - 90 * s, 10 * s, 90 * s, trunk);
  px(ctx, x - 14 * s, baseY - 150 * s, 38 * s, 60 * s, leaf);
  px(ctx, x - 14 * s, baseY - 150 * s, 38 * s, 6 * s, dark ? "#243d28" : "#3f7030");
  // broken branch stub
  px(ctx, x + 10 * s, baseY - 70 * s, 14 * s, 4 * s, trunk);
}

function ruin(ctx, x, baseY, w, h, c1, c2) {
  px(ctx, x, baseY - h, w, h, c1);
  for (let i = 0; i < 4; i++) px(ctx, x + 4 + i * (w / 4), baseY - h - 6 + (i % 2) * 4, w / 5, 8, c1);
  px(ctx, x, baseY - h, 3, h, c2);
  px(ctx, x + 3, baseY - 20, w - 6, 3, "#1a1a22"); // crack
}

export const forest = {
  id: "forest",
  name: "RUINED FOREST",
  // M13 per-map data: collision width, select-screen hint, ambient FX.
  width: 1600, // the standard stage — camera pans 640px
  desc: "Dusk ruins over grown earth — a standard-size stage.",
  particles: { kind: "leaves", count: 70 },
  draw(ctx, camX, t) {
    // Sky — dusky gradient bands (pixel bands, not smooth blur).
    const bands = ["#2b3a67", "#3a4f7e", "#57709a", "#8fa3b8"];
    bands.forEach((c, i) => px(ctx, 0, i * 60, VIEW_W, 60, c));
    // Far haze band: guarantees no black void between sky and ground where
    // parallax items don't overlap.
    px(ctx, 0, 240, VIEW_W, GROUND_Y - 240, "#2b3d2e");
    // Distant sun glow (blocky pixels)
    px(ctx, 680 - camX * 0.02, 120, 60, 60, "#e8c87a");
    px(ctx, 690 - camX * 0.02, 130, 40, 40, "#f4e2a8");
    // Distant forest silhouette (parallax 0.2)
    ctx.save();
    for (let i = 0; i < 24; i++) {
      const x = ((i * 173 - camX * 0.2) % 1100 + 1100) % 1100 - 60;
      px(ctx, x, 250, 60, 120, "#22331f");
      px(ctx, x + 10, 230, 40, 30, "#22331f");
    }
    // Mid ruins + broken trees (parallax 0.5)
    for (let i = 0; i < 8; i++) {
      const x = ((i * 397 - camX * 0.5) % 1400 + 1400) % 1400 - 100;
      ruin(ctx, x, 380, 70, 90, "#5a5a6e", "#7a7a92");
      tree(ctx, x + 120, 390, 1.1, true);
    }
    ctx.restore();
    // Gameplay ground plane (parallax 1.0)
    px(ctx, 0, GROUND_Y, VIEW_W, VIEW_H - GROUND_Y, "#3a4a2e");
    px(ctx, 0, GROUND_Y, VIEW_W, 6, "#6fae4e");
    px(ctx, 0, GROUND_Y + 6, VIEW_W, 3, "#2a3822");
    // Ground detail: stones + grass tufts scrolling with camera
    for (let i = 0; i < 40; i++) {
      const wx = i * 97;
      const x = wx - camX;
      if (x < -20 || x > VIEW_W + 20) continue;
      const j = (i * 37) % 23;
      px(ctx, x, GROUND_Y + 14 + j, 6, 3, "#2a3822");
      px(ctx, x + 2, GROUND_Y - 4, 2, 4, "#6fae4e");
    }
    // Foreground grass blades (parallax 1.3, dark, bottom edge)
    for (let i = 0; i < 26; i++) {
      const x = ((i * 211 - camX * 1.3) % 1100 + 1100) % 1100 - 60;
      px(ctx, x, VIEW_H - 26, 4, 26, "#16240f");
      px(ctx, x + 8, VIEW_H - 18, 3, 18, "#1d3120");
    }
    // Preset lighting: warm dusk from upper right + vignette
    const g = ctx.createLinearGradient(0, 0, VIEW_W, VIEW_H);
    g.addColorStop(0, "rgba(20,20,60,0.25)");
    g.addColorStop(0.6, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(232,150,60,0.12)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  },
};
