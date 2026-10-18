/* The game's name and every number worth tweaking, in one place. Classic script: exposes window.BT. */
(function () {
  'use strict';
  const BT = (window.BT = window.BT || {});

  // Working title. Alan names the games himself: change it here and the page title, logo and menus follow.
  BT.TITLE = 'BombasTTic!';
  BT.SUBTITLE = "Teddy & Tommy's confetti bomb maze";

  BT.TUNE = {
    tile: 2, // world units per grid cell

    // players
    speed: 3.7, // cells per second
    speedStep: 0.55, // each 👟 adds this much
    maxSpeedUps: 4,
    startBombs: 1,
    startRange: 2,
    maxBombs: 6,
    maxRange: 7,
    hearts: { easy: 5, normal: 3 }, // adventure: hits you can take before TRY AGAIN
    coopHearts: { easy: 6, normal: 4 }, // co-op: one shared pool
    maxHearts: 9,
    respawnSafe: 2.5, // seconds of blinking after a respawn
    dizzyTime: 1.8,

    // bombs
    fuse: { easy: 3.0, normal: 2.5 },
    blastTime: 0.55,
    kickSpeed: 8, // cells per second

    // enemies (cells per second); Easy runs them at easyEnemySpeed of this
    enemySpeed: { zombie: 1.45, robot: 2.25 },
    easyEnemySpeed: 0.75,
    robotChase: { easy: 0.25, normal: 0.55 }, // chance a robot turns toward you at a junction

    // the companion (the other brother)
    buddy: {
      visit: 10, // seconds he stays
      hello: 1.6, // his signature move when he arrives
      give: 1.9, // when he hands over the treat
      bye: 1.4, // his goodbye move, at the end of the visit
      fuse: 1.6, // his bombs are quicker than yours
      range: 2,
      bombGap: 1.3, // seconds between his bombs
      battleVisit: 8,
      battleRest: 6, // battle only: rest before he can come again
      battleBombGap: 2.6,
      savedSafe: 1.5, // seconds of safety after he blocks a hit
    },

    battle: { roundTime: 120, winsNeeded: 2, maxRounds: 5 },
  };

  BT.ITEMS = {
    1: { key: 'bomb', emoji: '💣', name: 'EXTRA BOMB', color: '#3d8bff' },
    2: { key: 'fire', emoji: '🔥', name: 'BIGGER BLAST', color: '#ff7a1f' },
    3: { key: 'speed', emoji: '👟', name: 'SPEEDY SHOES', color: '#2fc27a' },
    4: { key: 'kick', emoji: '🦶', name: 'BOMB KICK', color: '#b45cff' },
    5: { key: 'heart', emoji: '❤️', name: 'EXTRA HEART', color: '#ff3d7f' },
  };
  BT.ITEM_CODE = { bomb: 1, fire: 2, speed: 3, kick: 4, heart: 5 };

  // Heroes you can pick (the zombie and the robot are the baddies here).
  BT.HEROES = ['teddy', 'tommy', 'zoom', 'luna', 'bruno'];
})();
