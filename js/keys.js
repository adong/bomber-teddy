/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: "BombasTTic!",
  cols: ["Player 1", "Player 2"],
  keys: [
    ["move", "W A S D", "↑ ← ↓ →"],
    ["drop a bomb", "Space or F", "L"],
    ["call your brother", "T", "Enter"],
    ["pause · sound", "P or Esc · M", ""],
  ],
  note: "In 1 player both sets of keys work.",
  touch: "Slide your thumb on the round pad, tap 💣 to drop a bomb, and tap his face to call your brother.",
});
