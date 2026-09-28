// Side-scrolling camera: follows the midpoint between fighters, clamped to
// the arena so background layers never show empty space. Clamp reads the
// LIVE per-map width (M13), so swapping to a narrower stage re-clamps next
// frame without any manual reset.
import { VIEW_W, ARENA_W } from "./config.js";
import { arena } from "./arena.js";

export class Camera {
  constructor() {
    this.x = (ARENA_W - VIEW_W) / 2;
    this.trauma = 0; // M10 screen shake: kicked by supers, decays fast
  }
  // Big hits add trauma (0..1, capped); majors slam it to 1.0.
  kick(a) {
    this.trauma = Math.min(1, this.trauma + a);
  }
  update(dt, a, b) {
    const mid = (a.x + b.x) / 2;
    const max = Math.max(0, arena.width - VIEW_W);
    const target = Math.max(0, Math.min(max, mid - VIEW_W / 2));
    // Frame-rate independent smoothing (lerp factor scaled by dt).
    const t = 1 - Math.pow(0.001, dt);
    this.x += (target - this.x) * t;
    this.x = Math.max(0, Math.min(max, this.x)); // hard pin to live bounds
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }
  // Integer-pixel offsets (crisp): quadratic falloff + fast wobble.
  shakeX(t) {
    const s = this.trauma * this.trauma;
    return Math.round(s * 14 * Math.sin(t * 70));
  }
  shakeY(t) {
    const s = this.trauma * this.trauma;
    return Math.round(s * 10 * Math.cos(t * 55));
  }
}
