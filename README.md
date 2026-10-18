# BombasTTic! (working title)

[![BombasTTic! title screen](docs/screenshot.jpg)](https://adong.github.io/bomber-teddy/)

A maze-and-bombs game starring Teddy and Tommy, built with Claude Code from plain JavaScript and Three.js on the shared Claude Games kit.
You drop cartoon bombs to blast crates, find power-ups, pop the baddies and reach the exit.
There are no image, model or audio files: the boys, zombies and robots are the kit's blocky characters, every texture is painted on a canvas, and every sound is synthesised.
It's silly, not scary: a blast is a cross of confetti-coloured smoke puffs, baddies pop into stars, and getting caught just means dizzy stars and "OOPS!".

The name lives in one place, `BT.TITLE` in `js/config.js`. Change it there and the page title, logo and menus follow.

## Play

- **Double-click `index.html`.** It works offline because Three.js and the kit are copied into `kit/`. Without internet the title font falls back to Arial Black.
- **Send one file:** `dist/bomber-teddy.html` is the whole game in one file, about 820 KB. AirDrop or email it, then open it in a browser.
- Rebuild that file after any edit: `python3 kit/tools/bundle.py . --name bomber-teddy`

Pick a mode and a difficulty on the title screen:

| Mode | |
|---|---|
| 🎈 **ADVENTURE** | 1 player, 12 stages. Pop every baddie, then find the exit hidden under one of the crates. |
| 👫 **TEAM UP** | 2 players on one keyboard (or one iPad), the same 12 stages together, sharing one row of hearts. |
| 🥊 **BATTLE** | Teddy vs Tommy, last one standing, best of 3. Player 2 can be a person or the computer. |

| Difficulty | |
|---|---|
| 🐣 **EASY**, for little bombers like Tommy (5) | 5 hearts (6 in Team Up). Your own bombs never catch you or your brother: only baddies can. Bombs tick for 3 s, and a striped red cross on the floor shows where each one will blast. Fewer baddies, and they walk slower. The exit gets a bouncing arrow as soon as it opens. |
| 🔥 **NORMAL**, for big kids like Teddy (8) | 3 hearts (4 in Team Up). Bombs catch everybody, yourself included, so drop one and run round a corner. Bombs tick for 2.5 s. All the baddies, at full speed. The exit arrow only shows up if you haven't found it after 12 s. |

In Battle the difficulty sets the bomb fuse and how clever the computer is.

## Controls

| | Player 1 | Player 2 | Touch |
|---|---|---|---|
| move | W A S D | ↑ ← ↓ → | the round pad (slide your thumb) |
| drop a bomb | Space or F | L | 💣 |
| call your brother | T | Enter | the big button with his face |

- In 1-player modes both key sets work for player 1, so arrows + Space are fine too.
- Two players on a touch screen each get their own pad, bomb button and brother button, one set in each bottom corner.
- **P** or Esc pauses and **M** turns the sound on or off. The ❚❚ and 🔊 buttons at the top do the same.
- **Menus:** Enter picks the highlighted mode, ← → move between modes, ↑ ↓ switch Easy / Normal, 1 2 3 jump straight to a mode. On the hero screen, A D pick player 1, ← → pick player 2, W S pick the starting stage, C switches player 2 between a person and the computer (Battle), Enter goes and Esc goes back.
- Turning a corner is forgiving: if you're a bit off the row when you turn, you slide onto it.

## Bombs, power-ups and baddies

- A bomb is a round black cartoon bomb with a fizzing fuse. It swells and flashes red just before it goes. The blast goes out in a **+** as far as your blast size: it stops at blocks, breaks the first crate it reaches and sets off any bomb it touches.
- Crates hide power-ups (and, in the adventure, the exit). Blasts never destroy power-ups.

| | Power-up | |
|---|---|---|
| 💣 | EXTRA BOMB | one more bomb on the floor at a time (up to 6) |
| 🔥 | BIGGER BLAST | one more cell each way (up to 7) |
| 👟 | SPEEDY SHOES | walk faster (up to 4) |
| 🦶 | BOMB KICK | walk into a bomb to send it sliding until it hits something |
| ❤️ | EXTRA HEART | adventure only, one more heart |

- **Zombies** (the kit's cartoon zombie, arms out) shuffle about at random. **Robots** (Bolt-style) are quicker, keep out of fire, and sometimes turn toward you. Either one popping into you costs a heart. A blast pops them into a burst of ⭐ and confetti.
- **Getting caught** (a blast or a baddie): you sit down dizzy with stars round your head and an "OOPS!", lose a heart, and pop back at the start blinking (safe) for 2.5 s. Power-ups are never lost.
- **Out of hearts:** "OOPS! Out of hearts" and TRY AGAIN restarts the same stage with full hearts and the power-ups you had when it started. Every cleared stage gives a heart back. The furthest stage you've reached is saved, so you can start from any stage you've already reached.

## The 12 stages

| | Theme | Stages | Arena |
|---|---|---|---|
| 1-3 | 🌳 **BACKYARD** | hedges, garden-stone pillars with grass tufts, cardboard boxes, trees | classic grid, flower-bed rows |
| 4-6 | 🧸 **TOY ROOM** | alphabet-block pillars spelling TEDDY and TOMMY, blue toy chests, wooden floor, giant toy balls | block towers, classic, flower-bed rows |
| 7-9 | ❄️ **SNOW PARK** | ice pillars with snow caps, red presents with ribbons, snowmen | snow fort, classic, block towers |
| 10-12 | 🚀 **SPACE BASE** | metal panels with glowing lights, cargo crates, a ringed planet | space maze, snow-fort shape, classic |

Each stage gets a new random layout every time you play it (crates, power-ups, exit and baddies move around), on its own pillar plan. Stage 1 has 3 zombies. Stage 12 has 4 zombies and 5 robots. Easy has about 60% as many baddies.

In Battle, rounds rotate through one arena per theme, with 12 power-ups hidden in the crates and a 2-minute clock (a time-out is a draw). First to 2 round wins takes the match, and after 5 rounds the match ends anyway.

## Call your brother (companion mode)

Your companion is the other brother: **Tommy** comes for everyone, and **Teddy** comes when Tommy is the one playing.

- **Calling him:** press **T** (player 2: **Enter**) or tap the big button with his face, any time and as often as you like. He pops in next to you in a puff of confetti with his name tag on.
- **Hello:** Tommy does his Y pose with peace fingers. Teddy shadow-boxes like Mike Tyson, jab and straight.
- **A treat:** he turns to you and hands over a 🍦 💧 🧃 🍪 🍉 or 🍌, which you carry for a few seconds ("🍦 ICE CREAM FROM TOMMY!").
- **He helps:** for the rest of his ~10 s visit he runs about and drops his own bombs (blue, with a ⭐) on baddies lined up near him. If they're walled in, he blasts crates near you to open the way. His bombs never catch you or your brother. "⭐ TOMMY GOT ONE!"
- **He's got your back:** while he's there you're inside a shield bubble, and **one** blast or baddie that would have caught you is blocked: "🛡️ TEDDY SAVED YOU!", with a burst of stars and 1.5 s of safety. The 🛡️ next to his face in the HUD shows whether his save is still ready.
- **Bye:** Tommy does his Y again, Teddy sinks a 🏀 jump shot (SWISH!). Then he's gone in a puff.
- **Tap again while he's there** and he says hello again and hands over another treat, and his visit starts over.
- The bar next to his face (top left, and round the big button) shows how long he's staying.
- **In Battle** each player has his own companion, and he bombs the other player instead of baddies. A visit lasts 8 s, and then he rests for 6 s (his face goes grey and the ring refills; pressing then just wiggles the button). Tapping while he's there gives another treat but doesn't make him stay longer. The computer player calls its companion too.

## Celebrations

- **Stage clear:** the camera leans in and the winner celebrates on the rainbow exit. Teddy shadow-boxes, then does a basketball jump shot (🏀 … SWISH!), over and over. Tommy does his Y pose and ✌️. Everyone else waves.
- **Battle:** the round winner does the same while the loser sits dizzy. Then the results screen shows the match winner.

## Make it yours

- `js/config.js`: the name, every speed and timing (player speed, fuses, hearts, enemy speeds, the companion's visit, Battle's clock).
- `js/levels.js`: the four themes' colours, the five pillar plans (as ASCII maps), and the 12 stages (layout, crate density, baddies, hidden power-ups).
- The heroes and who comes as whose companion live in the shared kit roster (`~/claude-games/kit/roster.js`). `BT.HEROES` in `js/config.js` lists who you can pick.

## How it works, and how it's tested

- `js/engine.js` has the rules and no Three.js. A stage is plain state (a 15×13 grid, bombs, fire, players, baddies, companions) stepped 60 times a second. It reports what happened as events, which `js/game.js` turns into effects, sounds and banners.
- `js/brain.js` is the computer player: Battle's CPU, the demo behind the title screen, and the autopilot the soak test uses. It reads a danger map (when each cell will be on fire, chain reactions included) and only drops a bomb when it can see a way out.
- `js/levels.js` builds each arena from a pillar plan: it keeps a pocket of cells clear around every start, puts baddies at least 7 cells away from any start, and hides the exit under a crate at least 8 cells away.
- **Headless checks**, in Node with no npm (`node tools/check.js`), or in the browser console:

```bash
node tools/check.js 200 --soak --soak-seeds=25
```

(`--buddy` also calls the companion every 15 s during the soak.)

```js
game.check(200)      // every stage x mode x difficulty, 200 random layouts each, plus the battle arenas
game.sabotage()      // 5 deliberately broken levels: the check must catch every one
game.soak({ diff: 'normal', mode: 'coop', buddyEvery: 15 })  // the autopilot plays all 12 stages
BT.Check.battleSoak(60)   // computer-vs-computer battle rounds
```

- The stage check (`BT.Check.checkLevel`) fails a layout if:
  - the exit, any baddie, any power-up or the other start can't be reached from a start (crates count as passable, because they can be blasted, but blocks don't);
  - a baddie starts less than 5 open cells' walk from a start pocket;
  - a start pocket isn't open floor;
  - there's no first bomb anywhere reachable that breaks a crate and leaves an escape you can reach before it goes off;
  - the exit isn't hidden under a crate, or a power-up is missing or on the exit.
- The soak also counts how often someone is caught again within 4 s of popping back at the start. Baddies back away from a blinking player, which cut that from 59 to 13 of about 2,100 catches.
- At the last check:
  - 11,200 generated arenas passed, and all 5 sabotaged levels were caught.
  - The autopilot cleared all 1,200 stage runs (12 stages × 25 layouts × Adventure and Team Up × Easy and Normal). With the companion called every 15 s, it cleared 480 of 480.
  - 120 computer-vs-computer battle rounds all ended (112 KOs, 1 draw, 7 time-outs), with 656 companion visits and 63 saves.
- Console hooks (`window.game`) for testing in a browser whose animation is throttled:

```js
game.start({ mode: 'adventure', diff: 'easy', heroes: ['tommy'], stage: 0 })  // jump into a game ('coop', 'battle', cpu2: true)
game.step(1)          // advance 1 s and draw
game.press(0, 'right', 0.3); game.press(0, 'bomb')   // drive player 1
game.buddy(0)         // call player 1's brother
game.win(0)           // pop the baddies and put player 1 on the exit
game.cam({ x: 2, y: 10, d: 18 })   // close-up camera on a cell (null to let go)
game.hold(true)       // stop the live loop so only step() moves time
```

## Files

```
index.html        page, HUD, menus, touch controls (CSS inline)
js/config.js      the name, tuning numbers, power-ups, pickable heroes
js/levels.js      themes, pillar plans, the 12 stages, battle arenas, the arena generator, grid helpers
js/engine.js      the rules: movement, bombs, chain blasts, kicks, fire, baddies, the companion, hearts, rounds
js/brain.js       the computer player (Battle CPU, title-screen demo, soak autopilot)
js/check.js       headless stage check, sabotage, soak and battle soak
js/input.js       keyboard for two players, touch pads and buttons
js/sfx.js         sounds on top of Kit.sound
js/art.js         arenas for each theme, crates, bombs, power-ups, the exit, effects
js/game.js        scene, camera, characters and poses, effects, the companion's visits, HUD, menus, loop, window.game
tools/check.js    runs js/check.js in Node
kit/              copy of ~/claude-games/kit (python3 ../kit/tools/sync.py .), never edited here
dist/bomber-teddy.html   the single-page build
```

## Kit candidates

These live in this game's own JS for now. They could move into `~/claude-games/kit` if another game wants them:

- **Poses** (`js/game.js`): `poseDizzy` (sitting, legs out, head wobbling), `celebrate` (loops a roster entry's signature moves, with Teddy's jump-shot hop and 🏀), `plantFeet` (stops the kit's wave and peace poses striding), `settle` (eases the channels `pose()` doesn't touch back to standing).
- **Effects** (`js/art.js`): a sprite pool (puffs, stars, glows), a confetti point cloud that flutters down and lies on the floor, a fluffy cartoon-smoke puff texture, and comic word bursts (OOPS!, POP!, SWISH!).
- **Sounds** (`js/sfx.js`): a soft cartoon boom, crate crack, pop, slide-whistle "oops", kick, shield ding, treat chime, fanfare.
- **Grid helpers** (`js/levels.js`, `js/engine.js`): BFS distances, blast crosses, lane-based grid movement with corner sliding, and a danger map with chain reactions. A future maze game could reuse them.

## Not verified

- **Sound:** the synth code runs without errors, but nobody has listened to it.
- **Real touch devices:** the pads and buttons, the 2-player iPad layout included, were tested with the browser's touch emulation and synthetic pointer events (phone 844×390, iPad 1024×768), not on a real phone or iPad. Two thumbs at once is untested.
- **Double-click from Finder (`file://`):** the page only uses classic `<script src>` tags and makes no network requests (apart from the optional Google font), but it was tested over `http://localhost`, because the test browser can't drive `file://` pages.
- **Fun:** the stage check, the soaks and the bots say every stage can be cleared. Whether Easy is easy enough for a 5-year-old needs Tommy.
