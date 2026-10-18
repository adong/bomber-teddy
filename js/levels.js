/* Stages, themes and the arena generator. No Three.js in here: the engine, the headless checks and the renderer
   all read the same plain grids. Exposes BT.Levels and the grid helpers in BT.Grid. */
(function () {
  'use strict';
  const BT = window.BT;
  const W = 15, H = 13;
  const FLOOR = 0, SOLID = 1, CRATE = 2;

  // ---------------------------------------------------------------- themes (colours are read by js/art.js)
  const THEMES = [
    {
      id: 'yard', name: 'BACKYARD', sky: '#8fd0ff', ground: '#5fae46',
      floorA: '#88d561', floorB: '#7cc957', wall: '#3f8f3a', wallTop: '#58b04a',
      pillar: '#cbbfa6', pillarTop: '#e9dfca', crate: '#c99255', crateLine: '#9a6a36', crateMark: '#e9c38a',
    },
    {
      id: 'toys', name: 'TOY ROOM', sky: '#ffd9a8', ground: '#7a5bd6',
      floorA: '#e6b97f', floorB: '#dcab70', wall: '#ff8a5a', wallTop: '#ffb07a',
      pillar: 'letters', pillarTop: '#ffffff', crate: '#4fa3ff', crateLine: '#2a6fc9', crateMark: '#ffd400',
    },
    {
      id: 'snow', name: 'SNOW PARK', sky: '#bfe3ff', ground: '#f4f8ff',
      floorA: '#e6f0fc', floorB: '#d5e5f7', wall: '#ffffff', wallTop: '#ffffff',
      pillar: '#7cc4f5', pillarTop: '#d6f0ff', crate: '#ff5a6e', crateLine: '#c93a4f', crateMark: '#ffd400',
    },
    {
      id: 'space', name: 'SPACE BASE', sky: '#151834', ground: '#22264a',
      floorA: '#3d4674', floorB: '#363f69', wall: '#5a6392', wallTop: '#7a84b8',
      pillar: '#8b95c6', pillarTop: '#b9c2ee', crate: '#ffb02e', crateLine: '#c97a10', crateMark: '#24232e',
    },
  ];

  // ---------------------------------------------------------------- layouts
  // '#' solid (border or pillar), '.' floor that may get a crate, 'o' floor that never gets one, 'c' always a crate.
  const LAYOUTS = {
    classic: [
      '###############',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '###############',
    ],
    garden: [
      '###############',
      '#.............#',
      '#.##.##.##.##.#',
      '#.............#',
      '#.#.#.....#.#.#',
      '#.............#',
      '#.##.#.#.#.##.#',
      '#.............#',
      '#.#.#.....#.#.#',
      '#.............#',
      '#.##.##.##.##.#',
      '#.............#',
      '###############',
    ],
    towers: [
      '###############',
      '#.............#',
      '#.##..#.#..##.#',
      '#.##.......##.#',
      '#.....#.#.....#',
      '#.#.##...##.#.#',
      '#.....#.#.....#',
      '#.#.##...##.#.#',
      '#.....#.#.....#',
      '#.##.......##.#',
      '#.##..#.#..##.#',
      '#.............#',
      '###############',
    ],
    fort: [
      '###############',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '#.#.###.###.#.#',
      '#...#.....#...#',
      '#.#...#.#...#.#',
      '#...#.....#...#',
      '#.#.###.###.#.#',
      '#.............#',
      '#.#.#.#.#.#.#.#',
      '#.............#',
      '###############',
    ],
    maze: [
      '###############',
      '#.............#',
      '#.#.##.#.##.#.#',
      '#.#.........#.#',
      '#...#.#.#.#...#',
      '#.#.........#.#',
      '#.#.#.###.#.#.#',
      '#.#.........#.#',
      '#...#.#.#.#...#',
      '#.#.........#.#',
      '#.#.##.#.##.#.#',
      '#.............#',
      '###############',
    ],
  };

  // ---------------------------------------------------------------- the adventure: 12 stages, 3 per theme
  const STAGES = [
    { theme: 0, layout: 'classic', crates: 0.4, zombie: 3, robot: 0, items: ['bomb', 'fire', 'fire'] },
    { theme: 0, layout: 'garden', crates: 0.45, zombie: 4, robot: 0, items: ['bomb', 'fire', 'speed'] },
    { theme: 0, layout: 'classic', crates: 0.48, zombie: 3, robot: 1, items: ['bomb', 'fire', 'kick', 'heart'] },
    { theme: 1, layout: 'towers', crates: 0.45, zombie: 2, robot: 2, items: ['bomb', 'fire', 'speed'] },
    { theme: 1, layout: 'classic', crates: 0.5, zombie: 3, robot: 2, items: ['bomb', 'fire', 'kick'] },
    { theme: 1, layout: 'garden', crates: 0.5, zombie: 2, robot: 3, items: ['bomb', 'fire', 'speed', 'heart'] },
    { theme: 2, layout: 'fort', crates: 0.45, zombie: 3, robot: 3, items: ['bomb', 'fire', 'speed'] },
    { theme: 2, layout: 'classic', crates: 0.52, zombie: 2, robot: 4, items: ['bomb', 'fire', 'kick'] },
    { theme: 2, layout: 'towers', crates: 0.52, zombie: 4, robot: 3, items: ['bomb', 'fire', 'speed', 'heart'] },
    { theme: 3, layout: 'maze', crates: 0.48, zombie: 3, robot: 4, items: ['bomb', 'fire', 'kick'] },
    { theme: 3, layout: 'fort', crates: 0.52, zombie: 2, robot: 5, items: ['bomb', 'fire', 'speed'] },
    { theme: 3, layout: 'classic', crates: 0.55, zombie: 4, robot: 5, items: ['bomb', 'fire', 'fire', 'kick', 'heart'] },
  ];

  // Battle arenas, one per theme; round n uses arena (n - 1) % 4.
  const ARENAS = [
    { theme: 0, layout: 'classic', crates: 0.6 },
    { theme: 1, layout: 'towers', crates: 0.58 },
    { theme: 2, layout: 'garden', crates: 0.6 },
    { theme: 3, layout: 'maze', crates: 0.58 },
  ];
  const BATTLE_ITEMS = ['bomb', 'bomb', 'bomb', 'bomb', 'fire', 'fire', 'fire', 'fire', 'speed', 'speed', 'kick', 'kick'];

  const SPAWNS = {
    adventure: [[1, 11]],
    coop: [[1, 11], [13, 11]],
    battle: [[1, 11], [13, 1]],
  };

  // ---------------------------------------------------------------- grid helpers
  const idx = (x, y) => y * W + x;
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up (away from the camera), right, down, left

  // Breadth-first distances from the source cells through cells where pass(c) is true. -1 = unreachable.
  function bfs(sources, pass) {
    const dist = new Int16Array(W * H).fill(-1);
    const q = [];
    for (const c of sources) {
      if (dist[c] < 0) {
        dist[c] = 0;
        q.push(c);
      }
    }
    for (let h = 0; h < q.length; h++) {
      const c = q[h], x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = idx(nx, ny);
        if (dist[n] >= 0 || !pass(n)) continue;
        dist[n] = dist[c] + 1;
        q.push(n);
      }
    }
    return dist;
  }

  // The cells a bomb at (x, y) would set on fire: the centre plus up to `range` cells each way. Fire stops at solid
  // blocks, takes a crate and stops, and stops on another bomb (which then goes off too). stopAt(c) marks bombs.
  function blastCells(cells, x, y, range, stopAt) {
    const out = [idx(x, y)];
    for (const [dx, dy] of DIRS) {
      for (let k = 1; k <= range; k++) {
        const nx = x + dx * k, ny = y + dy * k;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) break;
        const c = idx(nx, ny);
        if (cells[c] === SOLID) break;
        out.push(c);
        if (cells[c] === CRATE || (stopAt && stopAt(c))) break;
      }
    }
    return out;
  }

  // The spawn pocket: the spawn cell, two cells toward the middle along its row and two along its column.
  function pocket(sx, sy) {
    const hx = sx < W / 2 ? 1 : -1, vy = sy < H / 2 ? 1 : -1;
    return [idx(sx, sy), idx(sx + hx, sy), idx(sx + 2 * hx, sy), idx(sx, sy + vy), idx(sx, sy + 2 * vy)];
  }

  // ---------------------------------------------------------------- the generator
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, r) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const ENEMY_MIN_DIST = 7; // cells (through anything but solid blocks) between a baddie and any spawn
  const EXIT_MIN_DIST = 8;

  // Build one arena. mode: 'adventure' | 'coop' | 'battle'; n: stage index (or round index in battle).
  function make(mode, n, diff, seed) {
    const battle = mode === 'battle';
    const st = battle ? ARENAS[n % ARENAS.length] : STAGES[Math.min(n, STAGES.length - 1)];
    const r = rng((seed >>> 0) || 1);
    const rows = LAYOUTS[st.layout];
    const cells = new Uint8Array(W * H);
    const forced = new Uint8Array(W * H); // 1 = never a crate, 2 = always a crate
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const ch = rows[y][x];
        cells[idx(x, y)] = ch === '#' ? SOLID : FLOOR;
        forced[idx(x, y)] = ch === 'o' ? 1 : ch === 'c' ? 2 : 0;
      }
    }
    const spawns = SPAWNS[mode].map(([x, y]) => ({ x, y }));
    const pockets = new Set();
    spawns.forEach((s) => pocket(s.x, s.y).forEach((c) => pockets.add(c)));
    const fromSpawn = bfs(spawns.map((s) => idx(s.x, s.y)), (c) => cells[c] !== SOLID);

    // baddies: far from every spawn (counting crates as walkable, so they stay far once crates are gone too)
    const enemies = [];
    const reserved = new Set();
    if (!battle) {
      const easy = diff === 'easy';
      const want = [];
      const nz = easy ? Math.ceil(st.zombie * 0.6) : st.zombie;
      const nr = easy ? Math.ceil(st.robot * 0.6) : st.robot;
      for (let i = 0; i < nz; i++) want.push('zombie');
      for (let i = 0; i < nr; i++) want.push('robot');
      const cand = [];
      for (let c = 0; c < W * H; c++) {
        if (cells[c] === FLOOR && forced[c] !== 2 && !pockets.has(c) && fromSpawn[c] >= ENEMY_MIN_DIST) cand.push(c);
      }
      shuffle(cand, r);
      for (const kind of want) {
        // keep baddies a couple of cells apart so they spread over the arena
        let pickC = cand.find((c) => !reserved.has(c) && enemies.every((e) => Math.abs(e.x - (c % W)) + Math.abs(e.y - ((c / W) | 0)) >= 3));
        if (pickC === undefined) pickC = cand.find((c) => !reserved.has(c));
        if (pickC === undefined) break;
        const x = pickC % W, y = (pickC / W) | 0;
        enemies.push({ kind, x, y });
        reserved.add(pickC);
        // give it a little corridor to walk in: clear one neighbour and the cell beyond it
        const dirs = shuffle(DIRS.slice(), r);
        for (const [dx, dy] of dirs) {
          const a = idx(x + dx, y + dy), b = idx(x + 2 * dx, y + 2 * dy);
          if (cells[a] === FLOOR && !pockets.has(a) && forced[a] !== 2) {
            reserved.add(a);
            if (cells[b] === FLOOR && !pockets.has(b) && forced[b] !== 2 && fromSpawn[b] >= ENEMY_MIN_DIST - 1) reserved.add(b);
            break;
          }
        }
      }
    }

    // crates
    for (let c = 0; c < W * H; c++) {
      if (cells[c] !== FLOOR || pockets.has(c) || reserved.has(c) || forced[c] === 1) continue;
      if (forced[c] === 2 || r() < st.crates) cells[c] = CRATE;
    }

    // the exit hides under a crate far from the start
    let exit = -1;
    if (!battle) {
      let far = [];
      for (let c = 0; c < W * H; c++) if (cells[c] === CRATE && fromSpawn[c] >= EXIT_MIN_DIST) far.push(c);
      if (!far.length) {
        // few crates: put a crate on a far floor cell for it
        for (let c = 0; c < W * H; c++) if (cells[c] === FLOOR && !reserved.has(c) && !pockets.has(c) && fromSpawn[c] >= EXIT_MIN_DIST) far.push(c);
        far = far.slice(0, 1);
        if (far.length) cells[far[0]] = CRATE;
      }
      exit = far.length ? far[Math.floor(r() * far.length)] : -1;
    }

    // power-ups hide under other crates
    const hidden = new Int8Array(W * H);
    const itemList = battle ? BATTLE_ITEMS : st.items;
    const crateCells = [];
    for (let c = 0; c < W * H; c++) if (cells[c] === CRATE && c !== exit) crateCells.push(c);
    shuffle(crateCells, r);
    itemList.forEach((key, i) => {
      if (i < crateCells.length) hidden[crateCells[i]] = BT.ITEM_CODE[key];
    });

    const theme = THEMES[st.theme];
    return {
      W, H, cells, hidden, exit, spawns, enemies, theme, mode, n, diff, seed,
      layout: st.layout, items: itemList.slice(),
      name: battle ? theme.name : `${theme.name} ${Math.floor(n / 3) + 1}-${(n % 3) + 1}`,
      pockets: [...pockets],
    };
  }

  BT.Grid = { W, H, FLOOR, SOLID, CRATE, DIRS, idx, bfs, blastCells, pocket };
  BT.Levels = { THEMES, LAYOUTS, STAGES, ARENAS, SPAWNS, make, rng, count: STAGES.length, ENEMY_MIN_DIST, EXIT_MIN_DIST };
})();
