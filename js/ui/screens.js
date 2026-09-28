// DOM screen manager: menu / char-select / map-select / fight toolbar.
// Keeps UI separate from canvas rendering (clean architecture boundary).
import { CHARACTERS } from "../characters/data.js";
import { BASE_HP } from "../combat/data.js";
import { buildPortrait } from "../render/sprites.js";
import { AudioFX } from "../audio.js";
import { MAPS } from "../maps/index.js";

function show(id) {
  for (const s of document.querySelectorAll(".screen")) s.classList.remove("visible");
  if (id) document.getElementById(id)?.classList.add("visible");
  document.getElementById("fight-bar").classList.toggle("hidden", id !== null);
}

const MAP_HINT_DEFAULT = "Pick a stage to enter the scene.";

function paintPortraits(sel) {
  const signed = (m) => ((m - 1) * 100 >= 0 ? "+" : "") + Math.round((m - 1) * 100) + "%";
  for (const p of [1, 2]) {
    const kind = p === 1 ? sel.p1 : sel.p2;
    const slot = document.getElementById(p === 1 ? "p1-portrait" : "p2-portrait");
    slot.innerHTML = "";
    const c = buildPortrait(kind);
    c.style.width = "128px"; c.style.height = "128px";
    slot.appendChild(c);
    document.getElementById(p === 1 ? "p1-name" : "p2-name").textContent =
      CHARACTERS[kind].name;
    // M7 stat readout, straight from the same table the engine uses.
    const st = CHARACTERS[kind].stats;
    document.getElementById(p === 1 ? "p1-stats" : "p2-stats").textContent =
      `SPD ${signed(st.moveSpeed)} · ATKSPD ${signed(st.attackSpeed)} · ` +
      `DMG ${signed(st.damage)} · HP ${Math.round(BASE_HP * st.health)}`;
  }
}

export function initScreens(sel, hooks) {
  paintPortraits(sel);
  document.getElementById("btn-start").onclick = () => { AudioFX.blip(660); show("screen-char"); hooks.onState("CHAR_SELECT"); };
  document.getElementById("btn-howto").onclick = () => {
    document.getElementById("howto").classList.toggle("hidden");
  };
  document.querySelectorAll("[data-p]").forEach((b) => {
    b.onclick = () => {
      AudioFX.blip(520);
      if (b.dataset.p === "1") sel.p1 = b.dataset.c; else sel.p2 = b.dataset.c;
      paintPortraits(sel);
    };
  });
  const paintDiff = () => {
    document.querySelectorAll("[data-diff]").forEach((b) => {
      b.classList.toggle("selected", b.dataset.diff === sel.diff);
      b.classList.toggle("ghost", b.dataset.diff !== sel.diff);
    });
  };
  paintDiff();
  document.querySelectorAll("[data-diff]").forEach((b) => {
    b.onclick = () => { AudioFX.blip(600); sel.diff = b.dataset.diff; paintDiff(); };
  });
  document.getElementById("btn-to-maps").onclick = () => {
    AudioFX.blip(660);
    document.getElementById("map-hint").textContent = MAP_HINT_DEFAULT;
    show("screen-map");
    hooks.onState("MAP_SELECT");
  };
  document.getElementById("btn-back-char").onclick = () => { show("screen-char"); hooks.onState("CHAR_SELECT"); };
  // M13 final select: hovering a card previews the stage (size/feel);
  // clicking (incl. RANDOM, re-rolled every time) enters the scene.
  const hintFor = (id) =>
    id === "random" ? "Rolls a fresh stage every match."
      : MAPS[id]?.desc ?? MAP_HINT_DEFAULT;
  document.querySelectorAll("[data-m]").forEach((b) => {
    b.onmouseenter = () => { document.getElementById("map-hint").textContent = hintFor(b.dataset.m); };
    b.onclick = () => {
      AudioFX.blip(760);
      hooks.onPickMap(b.dataset.m);
    };
  });
  document.getElementById("btn-quit").onclick = () => { hooks.onQuit(); show("screen-menu"); };
  document.getElementById("btn-swap-map").onclick = () => hooks.onSwapMap();
  return { show, paintPortraits: () => paintPortraits(sel) };
}
