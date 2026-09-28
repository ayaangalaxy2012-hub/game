// OVERRUN CITY — sunset ruins, broken skyline, debris, cracked road.
import { VIEW_W, VIEW_H, GROUND_Y } from "../config.js";
import { px } from "../render/pixel.js";

export const city = {
  id: "city",
  name: "OVERRUN CITY",
  // M13: widest arena — room to run, and rising fire embers for ambience.
  width: 1700,
  desc: "A wide broken boulevard — roomiest stage, embers on the wind.",
  particles: { kind: "embers", count: 65 },
  draw(ctx, camX, t) {
    // Sky: burnt-orange sunset bands
    const bands = ["#3a2a55", "#6e3a55", "#c96a3e", "#e8a04e"];
    bands.forEach((c, i) => px(ctx, 0, i * 70, VIEW_W, 70, c));
    // Dust-haze band: guarantees no black void between skyline and ground
    // where parallax buildings don't overlap.
    px(ctx, 0, 280, VIEW_W, GROUND_Y - 280, "#503a4a");
    px(ctx, 480 - camX * 0.02, 190, 56, 56, "#ffe2a8");
    // Distant skyline (parallax 0.2), some towers snapped in half
    for (let i = 0; i < 16; i++) {
      const x = ((i * 211 - camX * 0.2) % 1200 + 1200) % 1200 - 80;
      const h = 90 + ((i * 53) % 110);
      px(ctx, x, 300 - h, 70, h, "#2a2138");
      // broken top
      if (i % 3 === 0) px(ctx, x + 10, 300 - h - 12, 30, 14, "#2a2138");
      // lit windows (sparse — power failing)
      if (i % 2 === 0) {
        px(ctx, x + 12, 300 - h + 20, 8, 8, "#ffd23e");
        px(ctx, x + 40, 300 - h + 50, 8, 8, "#ff9a3e");
      }
    }
    // Mid damaged buildings + rubble (parallax 0.5)
    for (let i = 0; i < 7; i++) {
      const x = ((i * 389 - camX * 0.5) % 1400 + 1400) % 1400 - 100;
      px(ctx, x, 230, 110, 170, "#3d3348");
      px(ctx, x, 230, 110, 8, "#241d2e");
      px(ctx, x + 14, 260, 24, 30, "#14101c"); // blown window
      px(ctx, x + 60, 300, 30, 60, "#241d2e"); // collapsed section
      px(ctx, x - 20, 380, 60, 20, "#4a4258"); // rubble
      px(ctx, x + 90, 386, 44, 14, "#4a4258");
    }
    // Ground: cracked asphalt road
    px(ctx, 0, GROUND_Y, VIEW_W, VIEW_H - GROUND_Y, "#2e2e36");
    px(ctx, 0, GROUND_Y, VIEW_W, 5, "#6a6a7a");
    px(ctx, 0, GROUND_Y + 34, VIEW_W, 4, "#8a7a3a"); // center line (worn)
    for (let i = 0; i < 30; i++) {
      const wx = i * 139;
      const x = wx - camX;
      if (x < -30 || x > VIEW_W + 30) continue;
      px(ctx, x, GROUND_Y + 12 + ((i * 29) % 40), 10, 2, "#1c1c22"); // cracks
      if (i % 4 === 0) px(ctx, x, GROUND_Y + 50, 12, 6, "#4a4258");   // debris
    }
    // Foreground wreck silhouette (parallax 1.3)
    for (let i = 0; i < 5; i++) {
      const x = ((i * 523 - camX * 1.3) % 1300 + 1300) % 1300 - 100;
      px(ctx, x, VIEW_H - 70, 90, 70, "#12101a");
      px(ctx, x + 10, VIEW_H - 90, 40, 24, "#12101a");
    }
    // Preset lighting: sunset wash from horizon + dark foreground
    const g = ctx.createLinearGradient(0, 200, 0, VIEW_H);
    g.addColorStop(0, "rgba(255,160,60,0.10)");
    g.addColorStop(0.6, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(10,0,20,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  },
};
