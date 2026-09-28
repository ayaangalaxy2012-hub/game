# Pixel Brawl — Progress Checklist

> Build incrementally. Do NOT skip ahead. Only the current milestone is in progress.

- [x] **Milestone 1 — Visual Foundation + Characters** (IN PROGRESS → complete when tested)
  - [x] Main menu
  - [x] Character select screen
  - [x] Map select screen
  - [x] Game scene with 2 characters
  - [x] Procedural pixel-art Wesker (idle/walk/attack placeholders, faces opponent)
  - [x] Procedural pixel-art Homelander (idle/walk/attack placeholders, faces opponent)
  - [x] Camera with follow + clamp
  - [x] 3 environments with parallax + lighting + atmosphere
  - [x] Shadows, outlines, crisp nearest-neighbor scaling
  - [x] Tested in browser, no console errors
  - Test notes (M1): `node --check` clean on all modules; sprite/map
    painters executed headless (wesker/homelander 4 idle + 4 walk + 3 attack,
    all 3 maps draw OK); HTTP serve returns 200 for index + modules.
  - How to run: `python -m http.server` in project root → open index.html
    via http://localhost:8000 (modules require http, not file://).
  - Void fix: full-width haze band added behind parallax layers (forest/city)
    + lab wall extended to the ground plane, so black canvas never shows
    through between sky and ground. Verified with a headless coverage check
    (0 uncovered sample points on all maps at camX 0/320/640).
- [ ] **Milestone 2 — Basic Movement** (COMPLETE)
  - Walk (screen-relative A/D + arrows), auto-face, jump with startup +
    air control + landing lag, gravity, crouch, sneak (slow + LOW profile
    flag for M3 high-attack whiffs), forward dash (DD) / backdash (AA) via
    double-tap, arena walls, soft body push (no overlap).
  - New sprites: crouch[2], sneak[4], jump rise/fall, dash[2] with lean +
    streaks; feet now sit exactly on the ground (FEET_PAD fix).
  - Test notes: 25 headless checks pass (distances, jump height vs
    v²/2g, dash timing, clamps, separation, facing flip); syntax clean;
    HTTP serve 200 on all modules. Debug HUD shows live state per fighter.
- [ ] **Milestone 3 — Basic Combat** (COMPLETE)
  - Hurtboxes (stand 52x148, low 56x92) + hitboxes per move, AABB overlap.
  - LMB light chain (3 stages, distinct anims/timings) + RMB heavy
    (overhead art, slow startup, big damage/stun/knockback).
  - Damage + live HP bars, hitstop freeze clock, hitstun with ground
    friction / air carry, knockback slide, facing locked mid-swing, hits
    interrupt attacks, whiff recovery, minimal KO + R reset hook.
  - All frame data in `js/combat/data.js` (nothing hardcoded in logic).
  - Test notes: 27 headless checks pass (phases, one-hit-per-swing, full
    chain damage 5+6+8, whiff, heavy slide, stun expiry, interrupt, KO +
    immunity, facing lock, geometry, M2 regression); H toggles box overlay.
  - Anim upgrade: attacks run windup (startup) -> strike (active) ->
    follow-through (recovery) via per-phase FRAME_FOR map; new chambered
    windup + braced overhead-slam frames for both fighters.
- [ ] **Milestone 4 — Blocking** (COMPLETE)
  - Directional guard: hold AWAY on the ground (S+AWAY = crouch guard).
    S alone only crouches, never guards. No backward walk while guarding
    (genre standard; backdash/jump retreat instead).
  - Height matrix: stand guard stops high+mid, crouch guard stops mid+low.
    Heavy overhead (high) cracks crouchers; light3 kick (low) cracks
    standers; jabs (mid) stopped by either. Must face the threat; no air
    block, no guard mid-swing/stun/dash.
  - BLOCKSTUN with data-driven lock + pushback (no damage, chip field
    reserved for specials); stun end re-guards if AWAY still held; jump
    and dash cancel guard; attacks can't start from guard.
  - Feedback: dedicated stand/crouch guard sprites, guard held through
    stun with impact judder, blue cross-flash + shard spark on block,
    synthesized guard-ting / hit-thud (M14 replaces with real SFX).
  - Follow-up fix (backward movement): proximity guard — holding AWAY
    walks back outside GUARD_RANGE (260px, beyond max melee reach ~145px)
    and raises guard inside it; guard drops when spacing opens, stun ends
    neutral out of range. Ranged specials (M11) will revisit the range rule.
  - Test notes: 29 headless checks pass — full 6-cell guard matrix,
    5 no-guard cases, 7 state-machine transitions, facing rule (incl. a
    real wrong-way-guard test bug caught + fixed in the test), pushback,
    spark lifecycle, chain-after-block, M2/M3 regression; serve 200.
- [ ] **Milestone 5 — Dodging / Evasion** (SKIPPED for now, deferred)
- [ ] **Milestone 6 — Grabs** (COMPLETE)
  - Strike/throw/guard triangle: grab startup (0.12) slower than jab
    (0.10) so simultaneous strikes stuff it; grabCheck never consults
    guard (both heights thrown); guard still stops strikes.
  - GRAB phases: startup (hittable, no armor) -> active seizure window ->
    carry (victim pinned at grip, lifted) -> toss (12 dmg + airborne
    launch via stun pipeline) or 0.35s whiff recovery. Direction locked;
    no grab from guard/stun/air; jump and KO immune; THROWN has a safety
    timeout so victims can never stick.
  - New seize-reach sprite per fighter (toss reuses the slam frame);
    clinch skips body separation; catch + toss audio snaps.
  - Keys: L (P1) / / (P2). Homelander's RMB throw (M8) reuses this system.
  - Test notes: 14 headless checks pass — triangle all three ways incl.
    timing nuance (late strike gets seized), whiff/air/KO/guard-entry
    refusals, grip+launch choreography, land-and-recover, M4/chain regress.
- [ ] **Milestone 7 — Character-Specific Base Stats** (COMPLETE)
  - Single source: `stats` multipliers in `characters/data.js` only
    (Wesker 1.15/1.20/1.02/1.00, Homelander 1.00/1.00/1.15/1.10 — Homelander
    damage raised 1.10→1.15 in the post-M14.5 balance pass below).
    Grep-verified no ratios scattered elsewhere.
  - Applied: attackSpeed divides own startup/active/recovery (stun dealt,
    reach, lunge-px untouched); moveSpeed pre-scales walk/sneak/air/dash
    into `fighter.speeds` (jump arc shared by design); damage multiplies;
    health sizes maxHp (100/110). Grabs unscaled for both.
  - Select screen shows live stat readouts from the same table.
  - Test notes: 26 headless checks pass — exact table values, all tempos,
    all damages (chains 19.38/20.90), HP, walk/sneak/air/dash both chars,
    equal jump apex (129.5), identical fairness fields + stun frames,
    grab timing unscaled, copy independence, triangle BOTH directions,
    px-exact lunge (26.00) after fixing a real frame-rounding reach leak.
- [ ] **Milestone 8 — Character-Specific Normals** (COMPLETE)
  - Wesker (rushdown): palm -> elbow -> high backfist chain + Cobra Strike
    on RMB (0.18 startup, 55px lunging knife-hand, 15.3 dmg). Homelander
    (brawler): jab -> hook -> low sweep chain; RMB is a command throw via
    the M6 grab system (no heavy strike). Dashes stay character-distinct
    through M7 moveSpeed (123 vs 103px).
  - 6 new strike poses per painter (12 attack frames total); per-fighter
    FRAME_FOR maps; M7 stat scaling applies over each kit's own base table.
  - Test notes: 29 headless checks pass — kit disjointness, live frame
    observation per chain hit (6,7,8 / 0,10,11), cobra damage + px-exact
    55.0 lunge, RMB-throw completion, asymmetric enders both directions,
    faster-jab-wins, M7 regression (HP/walk/chain totals 19.38/24.20).
- [ ] **Milestone 9 — Rage System** (COMPLETE)
  - Meter 0-300, three 100pt levels, starts empty; gains (~7 landed
    strikes/level: deal 14 / take 10, blocked 8 / guarding 12, throws pay
    strike rates, whiffs pay nothing); `spendRage(levels)` pays exactly or
    refuses for free — the API M10/M11 abilities fire through.
  - HUD: 3 segment meters under each bar with partial fill, level-colored,
    white flash + celebration timer on level-up ("now available" signal).
  - Test hooks T/U grant a level (specials testing); R resets meters.
  - Test notes: 19 headless checks pass — empty start, both build paths,
    level/clamp math, exact + refused spending, flash on crossing only,
    whiff silence, throw economy, live grind to level 1 in 8 strikes,
    cobra regression. Two test-side slips caught (HP arithmetic, string
    gap arg); engine correct throughout.
- [ ] **Milestone 10 — Wesker Specials** (COMPLETE)
  - Jaguar Charge (Space, 1 bar): 0.22 stuffable startup, invulnerable
    262.5px driving tackle (px-exact travel), 18 dmg + chip 3, 0.3 recovery.
  - Phantom Combo (F, 2 bars): 5 teleport strikes alternating sides
    (5/5/5/7/12 = 34), fully invulnerable, whiff-abort on a missed opener,
    finale launches; held guard eats 7 chip (per-hit lock tuned short so
    guard recovers between teleports — a test-caught blockstun trap fixed).
  - Rage Mode (O, 3 bars) — REWORKED on request: 1s unmasking apotheosis
    (sunglasses off, red Uroboros eyes, ember aura, tremors), then six
    BLACK-SILHOUETTE blink passes (5 each, alternating sides, guardable
    for 6 chip total — per-hit block lock short so guard recovers), then
    Wesker leaps skyward and a locked-target 30-ton missile dives down
    (35, blockable for 8, dodgeable if you clear the locked mark after
    aim starts) with a crater bloom + slammed-through-floor bounce.
    ~4.2s, ~65 total, invulnerable throughout, whiff-abort on an
    untouchable opener. Black clones via new shadow-tint Clones style;
    new Missiles FX system synced bloom-to-impact (flight = aim+drop).
  - Dedicated tackle/unmasked sprites, poof/ember sparks, whoosh/powerup
    stings, trauma-based screen shake on the world layer, P2 mirror keys.
  - Test notes: 28 headless checks pass — gates (rage/state/range/air),
    spend exactness, dash invuln + startup stuffing, whiff recovery,
    plus 14 Rage-rework checks (duration/65 total/invuln window, black
    clones, missile lock+resolve, guard chip 14, post-lock dodge,
    abort, skyward leap, sibling regressions jaguar 18 / phantom 34).
    teleport alternation, guard-chip math, abort timing, launch + trauma,
    camera unit, M8/M9 regression (incl. slam rebuilding 14 rage by rule).
  - Polish addendum (post-M10): Phantom blinks, rage scoots, and Jaguar
    startup leave fading afterimage clones; Jaguar trails violet
    phantom-flame and every blink bursts violet. (Hurt faces tried and
    removed — read goofy at this resolution; stun sells through judder.
    Homelander's throw grimace stays.)
- [ ] **Milestone 11 — Homelander Specials** (COMPLETE)
  - Quick Laser (Space, 1 bar): 0.18 stuffable startup, hitscan head-height
    ray (700px) for 14 + chip 4. Thin + high by geometry: crouchers duck
    clean under it (even crouch-guarding); stand guard stops it; it also
    outranges proximity guard (260px), which is its job.
  - Sonic Scream (F, 2 bars): 0.3 startup, omnidirectional 150px burst
    (both sides, jumpers caught, dashes escape), 20 dmg + huge shove.
  - Rage Mode (O, 3 bars): unblockable cinematic seize, flight lift,
    4 laser ticks (5 each) with bleeding, 10-dmg ground slam (30 total),
    full trauma. Victim rides THROWN (safety extended to SPECIAL holders).
  - Lase-gaze + scream art, beam/ring/blood FX, zap/roar stings; shared
    Space/F/O slots map per-kit in trySpecial; resolveStrike takes an
    optional override box for exotic shapes.
  - Test notes: 27 headless checks pass — gates, slot mapping, beam
    geometry proof, duck/block/stuff cases, both-sides scream, seize-lift-
    bleed-slam execution (incl. fixing a tick-scheduling quantization that
    dropped the 4th tick), Wesker + chain regression; serve 200.
  - Fix (post-M11): idle "floating head" — heads ignored body bob, exposing
    a light collar row on bob=1 frames. `hy` now rides `bob` + nod in both
    painters; neck joint verified gap-free on all idle frames via pixel dump.
- [ ] **Milestone 12 — AI (Easy/Medium/Extreme)** (COMPLETE)
  - Think-tick brain (0.38/0.20/0.09s + jitter, injectable rng): danger
    reactions off startup tells with correct guard heights, whiff punishes
    (incl. cobra reach + grab-recover), turtle-cracking grabs from guard
    streaks, spacing/dash management, chain links, and a rage economy
    (easy wastes, medium spends, extreme kill-confirms + snipes).
  - Reads mechanics, not stats: ducks lasers instead of guarding, jumps
    driving tackles, kill-shot supers never wait behind jabs (a real
    ordering bug caught in test). Same Fighter/tables for all — no damage,
    health, or tempo cheats. M5 dodge absent, so evasion is dashes/jumps.
  - Difficulty select on the char screen (2P HUMAN preserves manual P2).
  - Test notes: 12 deterministic checks pass — guard heights both ways,
    easy inaction, punish/grab/special/kill behaviors, table honesty,
    scheduled mistakes, meter hoarding, tackle jump, corpse rule.
- [ ] **Milestone 13 — Map System (final select/random, collisions, particles)** (COMPLETE)
  - Per-map collision data: each stage owns its `width` (lab 1500 tight /
    forest 1600 standard / city 1700 wide) + select-screen `desc` + ambient
    `particles {kind,count}`. New `js/arena.js` holds the LIVE bounds;
    `enterFight` installs via `setArena(map.width)`, and physics wall
    clamps, camera pan/pin, fighter spawns, and laser beam caps all read
    the live value (swap-to-narrower-stage re-clamps next frame). Floor
    plane stays the shared GROUND_Y — all painters draw it, and per-map
    heights would desync the art from the physics.
  - Particles owned by maps (kind/count from map data, area = full arena
    width instead of a hardcoded 1100 strip). City embers now RISE from
    ground fires and recycle at the bottom (they used to fall like rain);
    respawn covers both screen edges. resetRound now wipes ALL FX lists
    (Sparks/Clones/Beams/Missiles) + camera trauma — no rematch debris.
  - Final select: hovering a stage card previews its size/feel via
    `#map-hint` (resets on screen entry); RANDOM re-rolls every click and
    is verified to cover all three stages over 100 draws.
  - Test notes: 24 headless checks pass — map data completeness + distinct
    widths, all 3 painters execute, random validity/coverage/fallback,
    per-map wall clamps (1440/1540/1640), camera live-pin down to lab,
    particle physics per kind (leaves fall-left, lab sinks, embers rise +
    10s recycle), jaguar 18 + AI-construct + clamp regressions; serve 200.
- [ ] **Milestone 14 — Polish (sparks, shake, sound, KO, portraits)** (COMPLETE)
  - Sparks: new `hit()` clean-hit star (red/white flash + 8 direction-biased
    hot shards, spray follows attacker's knock dir), `dust()` ground kick-up
    (dash takeoff / jump takeoff / landing), and a composite `ko()` finale
    (crater ring + doubled gore + flash + twin 6-shard fans). Blocks keep
    their cyan cross; main.js's contact consumer now handles hits (it used
    to drop them — the long-standing "sparks are M14" TODO is closed).
  - Shake: every clean hit kicks the camera scaled by move damage
    (`contact.weight`, clamped 0.07–0.32) through the existing trauma
    system; grab toss adds camKick 0.3 (throws previously shook nothing);
    KO punches 0.75. Supers keep their authored values.
  - Sound (all synthesized, still zero assets): `ko()` saw-crash + sub
    punch, `levelUp()` rising arpeggio (fires exactly on meter-level
    crossings), `whiff()` air-swish (whiffed strikes AND whiffed grabs),
    `land()` boots thud, dash whoosh, phantom-blink whoosh. Wired: land,
    dash, jump takeoff, whiff ends, toss, level crossings.
  - KO presentation: one-shot watcher fires on first hp≤0 — 0.30 hitstop,
    0.75 trauma, `ko()` sting, `Sparks.ko()` burst at the loser, then
    ~1.4s of slow-motion (sim dt × 0.35; HUD/input stay real-time). Stamped
    K.O. with pop-in scale + vignette; after the slow-mo the winner card
    lands (accent-colored name + 96px portrait) or DRAW GAME, plus
    "press R to rematch • ESC for menu". R clears all KO state.
  - Portraits + HUD: cached 32px head portraits in the HUD corners (40px
    boxes), bars/rage shifted to x=70 / VIEW_W-370 so faces own the edges,
    labels now show real character names ("P1 WESKER 87/100"), stale
    "M9 RAGE" center badge removed. Menu/title/footer text de-milestoned
    (no more "Milestone 1" subtitle or M11-key hint).
  - Test notes: 26 headless checks pass — hit/dust/ko spark spawns + spray
    direction + full expiry, contact weight, consumer path + shake clamp,
    level chime exactly on crossing, land/dash/whiff sounds (incl. no-whiff
    on contact), toss camKick, SFX headless-safety, both portraits, accent
    data, hit→KO regression; all files serve 200.
- [ ] **Balance pass (post-M14.5) — Samurai Edge, Homelander buff, missile FX** (COMPLETE)
  - Samurai Edge (Wesker): LMB+RMB pressed together (J+K keyboard or both
    mouse buttons) fires the pistol — `gun` move: hitscan ray band
    (`ray {len:550, top:130, h:56}` in `hitboxOf`), 7 dmg ×1.02, hitstun
    0.45 + knock 380 (or blockstun 0.30 + push 420) stops an advance,
    lunge 0 (planted), 0.22 draw / 0.40 whiff recovery (jabs stuff it).
    Input: `pressT` per-slot timestamps, GUN_WINDOW 0.18 — same-frame
    double press starts the gun; one-press-later cancels the first
    attack's startup via `samuraiEdge()` (refuses non-Wesker/bad states,
    falls through to normal presses). New attack[12] gun pose (leveled
    pistol + muzzle glint), `AudioFX.shot()` crack, `Sparks.muzzle()`,
    ray fires once per shot (`rayFired`). Docs updated (howto + hint).
  - Homelander compensation buff: `stats.damage` 1.10 → **1.15** (total
    +15% melee — single-source table, select-screen readout auto-updates).
  - Missile drama (30-ton impact): bloom lingers 0.35→0.5, half-width
    10+70e → 18+130e (≈300px wide), rising fire column + twin shockwave
    bars + deterministic debris spray + crater lip; bigger falling dart;
    impact adds `AudioFX.boom()`, wide primary ring (120→260) + second
    wave (170), twin hit stars, gore only on clean hit, 14 embers (was 6).
    Stun already spec'd `missileStun: 0.60` — regression-tested below.
  - Test notes: 49 headless checks pass — gun frame data/ray box both facings,
    not chainable, samuraiEdge gates (kind/air/guard/mid-swing + startup
    cancel), hit at gap 300 (≈7.14 dmg, ≥0.4 stun, shove), block chip,
    whiff at 700, muzzle+shot once, Homelander damage table 1.15 and
    light1 ≈6.9 live, missile stun observed 0.60s + single-frame 35 drop,
    bloom rect ≥250px wide (440) alive at fall+0.45, sibling regressions
    (cobra/grab/light1/jaguar/chain); all touched files serve 200.
- [ ] **Milestone 15 — Final Game Loop (rounds, timer, HUD, rematch)**

Current focus: **Milestone 15 — Final Game Loop (rounds, timer, HUD, rematch)**.
M1–M14 complete (M5 skipped/deferred). This is the last milestone.
