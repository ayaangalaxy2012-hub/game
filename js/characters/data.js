// Static character data. M7 will add speed/damage/health modifiers here —
// for M1 this is identity + colors only (no magic numbers elsewhere).
// JS concept vs Python: `Object.freeze` ≈ a read-only dict; it prevents
// accidental mutation of shared config at runtime.
export const CHARACTERS = Object.freeze({
  wesker: Object.freeze({
    id: "wesker",
    name: "WESKER",
    title: "The Betrayer",
    desc: "Black coat • sunglasses • superhuman swagger",
    accent: "#ff3030",
    // M7 base stats, stored as multipliers over the shared tables.
    // attackSpeed divides the fighter's own startup/active/recovery only
    // (stun dealt, reach, and lunge distance are untouched). moveSpeed
    // scales walk/sneak/air-drift/dash (jump arc stays shared on purpose).
    stats: Object.freeze({
      attackSpeed: 1.15, // +15% faster LMB/RMB
      moveSpeed: 1.20,   // +20% faster movement
      damage: 1.02,      // +2% attack damage
      health: 1.00,      // +0% health
    }),
  }),
  homelander: Object.freeze({
    id: "homelander",
    name: "HOMELANDER",
    title: "The Patriot",
    desc: "Blue suit • red cape • golden eagle",
    accent: "#3e6bff",
    stats: Object.freeze({
      attackSpeed: 1.00, // +0% attack speed
      moveSpeed: 1.00,   // +0% movement
      damage: 1.15,      // +15% melee damage (post-Samurai-Edge compensation)
      health: 1.10,      // +10% health
    }),
  }),
});
