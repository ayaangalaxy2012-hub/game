// Keyboard + menu input. One shared `keys` Set, polled by the game loop.
// JS concept vs Python: browser input is event-driven (callbacks), not
// blocking `input()`. We record key state on keydown/keyup and read it later.
export const keys = new Set();

const alias = (k) => k.toLowerCase();

export function initInput() {
  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", " ", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
    keys.add(alias(e.key));
  });
  window.addEventListener("keyup", (e) => keys.delete(alias(e.key)));
  window.addEventListener("blur", () => keys.clear());
}

export function pressed(...names) {
  return names.some((n) => keys.has(n));
}
