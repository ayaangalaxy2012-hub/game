// M14 combat SFX: synthesized WebAudio (no assets). Stings cover every
// feedback gap the milestones left: KO, level-up, whiffs, landings.
export const AudioFX = {
  ctx: null,
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* ignore */ }
    }
  },
  blip(freq = 440) {
    // Placeholder UI click. Called from menus only.
    try {
      this.ensure();
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.frequency.value = freq;
      g.gain.value = 0.05;
      o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + 0.07);
    } catch { /* ignore */ }
  },
  // M4 impact feedback: tiny synthesized hits (no assets). The full sound
  // system with real SFX/music hooks arrives in M14 and replaces these.
  tone(freq, dur, vol, type = "sine") {
    try {
      this.ensure();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + dur);
    } catch { /* ignore */ }
  },
  hit() { this.tone(110, 0.12, 0.14, "sine"); },      // low thud on clean hit
  block() { this.tone(660, 0.09, 0.07, "square"); },  // metallic guard "ting"
  grab() { this.tone(220, 0.08, 0.10, "square"); },   // short catch on seizure
  // M10 special stings: pitch slides (whoosh down, power-up). Full SFX in M14.
  slide(f0, f1, dur, vol, type = "square") {
    try {
      this.ensure();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(30, f0), t);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + dur);
    } catch { /* ignore */ }
  },
  whoosh() { this.slide(420, 70, 0.20, 0.08); },      // dash / teleport rush
  powerup() { this.slide(150, 640, 0.55, 0.09, "sawtooth"); }, // rage ignition
  zap() { this.slide(1400, 280, 0.16, 0.09, "sawtooth"); }, // M11 heat-vision burn
  roar() { this.slide(90, 420, 0.45, 0.12, "sawtooth"); },  // M11 sonic scream
  // --- M14 ---
  // KO sting: detuned saw crash + sub punch — the round-ender.
  ko() {
    this.slide(300, 45, 0.55, 0.15, "sawtooth");
    this.tone(55, 0.45, 0.16, "sine");
  },
  // Rage level-up chime: rising major-third arpeggio (the "meter full" ping).
  levelUp() {
    [440, 554, 660].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.1, 0.07, "square"), i * 65));
  },
  // Whiff: a soft air-swish for swings/grabs that connected with nothing.
  whiff() { this.slide(520, 190, 0.10, 0.045, "triangle"); },
  // Landing thud: boots back on the deck after a jump.
  land() { this.tone(90, 0.07, 0.08, "sine"); },
  // Samurai Edge: sharp square crack over a low body thump.
  shot() {
    this.tone(1800, 0.04, 0.10, "square");
    this.tone(90, 0.09, 0.12, "sine");
  },
  // Missile crater: sawtooth boom + sub rumble (the 30-ton arrival).
  boom() {
    this.slide(160, 40, 0.40, 0.16, "sawtooth");
    this.tone(50, 0.35, 0.14, "sine");
  },
};
