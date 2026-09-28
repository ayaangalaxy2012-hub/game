// Tiny canvas helpers. Keeps all pixel-art crisp (no blurry scaling).
// JS concept vs Python: functions are first-class values; we export each one
// and import only what we need elsewhere with `import { x } from "..."`.

export function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

// Integer-snapped filled rect = one "chunky pixel". Always round coords so
// scaled sprites never get blurry half-pixel edges.
export function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Draw an offscreen sprite canvas flipped horizontally (for facing left).
// Returns a cached flipped canvas stored on the source canvas object.
export function flipped(source) {
  if (source._flip) return source._flip;
  const [c, ctx] = makeCanvas(source.width, source.height);
  ctx.translate(source.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  source._flip = c;
  return c;
}
