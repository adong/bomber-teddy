/* Headless checks, runnable from the browser console (game.check(), game.soak()) or from Node
   (node tools/check.js). No Three.js needed.
   - checkLevel: every exit and every baddie can be reached from every spawn (crates can be blasted, blocks can't),
     no baddie starts within a short walk of a spawn, the spawn pocket is clear, and a first bomb with an escape
     is possible.
   - checkAll: the above for every stage, mode and difficulty over many random seeds, plus the battle arenas.
   - sabotage: breaks levels on purpose to prove checkLevel can fail.
   - soak: the autopilot plays every stage; each must be cleared. Exposes BT.Check. */
(function () {
  'use strict';
  const BT = window.BT;
  const { W, H, FLOOR, SOLID, CRATE, idx, bfs, blastCells, pocket } = BT.Grid;
  const TUNE = BT.TUNE;
  const SAFE_WALK = 5; // a baddie must be at least this many open cells from any spawn-pocket cell
  const xy = (c) => `(${c % W},${(c / W) | 0})`;

  function checkLevel(L) {
    const probs = [];
    const solid = (c) => L.cells[c] === SOLID;
    const spawnCells = L.spawns.map((s) => idx(s.x, s.y));
    const pocketCells = [];
    for (const s of L.spawns) {
      for (const c of pocket(s.x, s.y)) {
        pocketCells.push(c);
        if (L.cells[c] !== FLOOR) probs.push(`spawn pocket ${xy(c)} is not open floor`);
      }
    }
    // reachable: the exit, every baddie, every power-up and the other spawns
    for (const sc of spawnCells) {
      const reach = bfs([sc], (c) => !solid(c));
      if (L.mode !== 'battle') {
        if (L.exit < 0) probs.push('no exit');
        else if (reach[L.exit] < 0) probs.push(`exit ${xy(L.exit)} unreachable from ${xy(sc)}`);
      }
      for (const e of L.enemies) if (reach[idx(e.x, e.y)] < 0) probs.push(`${e.kind} at ${xy(idx(e.x, e.y))} unreachable from ${xy(sc)}`);
      for (let c = 0; c < W * H; c++) if (L.hidden[c] && reach[c] < 0) probs.push(`power-up ${xy(c)} unreachable`);
      for (const oc of spawnCells) if (reach[oc] < 0) probs.push(`spawn ${xy(oc)} unreachable from ${xy(sc)}`);
    }
    if (L.mode !== 'battle' && L.exit >= 0 && L.cells[L.exit] !== CRATE) probs.push('exit is not hidden under a crate');
    // baddies can't trap the spawn: open-floor walking distance from each baddie to the spawn pockets
    const walk = bfs(pocketCells, (c) => L.cells[c] === FLOOR);
    for (const e of L.enemies) {
      const c = idx(e.x, e.y);
      if (L.cells[c] !== FLOOR) probs.push(`${e.kind} at ${xy(c)} starts inside a block or crate`);
      else if (walk[c] >= 0 && walk[c] < SAFE_WALK) probs.push(`${e.kind} at ${xy(c)} starts ${walk[c]} steps from a spawn`);
    }
    // a first bomb: somewhere reachable over open floor, a bomb that breaks a crate and has an escape in time
    const fuse = Math.min(TUNE.fuse.easy, TUNE.fuse.normal);
    const maxSteps = Math.floor(fuse * TUNE.speed * 0.6);
    for (const sc of spawnCells) {
      const open = bfs([sc], (c) => L.cells[c] === FLOOR);
      let ok = false;
      for (let b = 0; b < W * H && !ok; b++) {
        if (open[b] < 0) continue;
        const blast = blastCells(L.cells, b % W, (b / W) | 0, TUNE.startRange);
        if (!blast.some((c) => L.cells[c] === CRATE)) continue;
        const inBlast = new Set(blast);
        const fromB = bfs([b], (c) => L.cells[c] === FLOOR);
        for (let c = 0; c < W * H; c++) {
          if (fromB[c] >= 0 && fromB[c] <= maxSteps && !inBlast.has(c)) {
            ok = true;
            break;
          }
        }
      }
      if (!ok) probs.push(`no safe first bomb from ${xy(sc)}`);
    }
    // power-ups: all hidden, none at the exit
    const want = L.items.length, got = [...L.hidden].filter((v) => v).length;
    if (got !== want) probs.push(`${got} of ${want} power-ups placed`);
    for (let c = 0; c < W * H; c++) {
      if (L.hidden[c] && L.cells[c] !== CRATE) probs.push(`power-up ${xy(c)} not under a crate`);
      if (L.hidden[c] && c === L.exit) probs.push('power-up on the exit');
    }
    return probs;
  }

  // Every stage x mode x difficulty, over `seeds` random seeds, plus the battle arenas.
  function checkAll(opts = {}) {
    const seeds = opts.seeds || 100;
    const fails = [];
    let levels = 0;
    const runs = [];
    for (let n = 0; n < BT.Levels.count; n++) for (const mode of ['adventure', 'coop']) for (const diff of ['easy', 'normal']) runs.push([mode, n, diff]);
    for (let n = 0; n < BT.Levels.ARENAS.length; n++) for (const diff of ['easy', 'normal']) runs.push(['battle', n, diff]);
    for (const [mode, n, diff] of runs) {
      for (let s = 1; s <= seeds; s++) {
        const seed = (s * 2654435761 + n * 97 + (mode === 'coop' ? 7 : mode === 'battle' ? 13 : 0)) >>> 0;
        const L = BT.Levels.make(mode, n, diff, seed);
        levels++;
        const probs = checkLevel(L);
        if (probs.length) fails.push({ mode, stage: n + 1, diff, seed, probs });
      }
    }
    return { levels, failed: fails.length, fails: fails.slice(0, 20) };
  }

  // Break levels on purpose; checkLevel must notice every one.
  function sabotage() {
    const cases = [];
    const base = () => BT.Levels.make('adventure', 0, 'normal', 1234);
    {
      const L = base();
      const s = L.spawns[0];
      L.enemies.push({ kind: 'zombie', x: s.x + 1, y: s.y - 2 >= 1 ? s.y - 2 : s.y + 2 });
      L.cells[idx(L.enemies[L.enemies.length - 1].x, L.enemies[L.enemies.length - 1].y)] = FLOOR;
      cases.push(['baddie next to the spawn', L]);
    }
    {
      const L = base();
      const x = L.exit % W, y = (L.exit / W) | 0;
      for (const [dx, dy] of BT.Grid.DIRS) if (x + dx > 0 && y + dy > 0 && x + dx < W - 1 && y + dy < H - 1) L.cells[idx(x + dx, y + dy)] = SOLID;
      cases.push(['exit walled in', L]);
    }
    {
      const L = base();
      L.cells[pocket(L.spawns[0].x, L.spawns[0].y)[1]] = SOLID;
      L.cells[pocket(L.spawns[0].x, L.spawns[0].y)[3]] = SOLID;
      cases.push(['spawn boxed in', L]);
    }
    {
      const L = base();
      const e = L.enemies[0], c = idx(e.x, e.y);
      for (const [dx, dy] of BT.Grid.DIRS) L.cells[c + dx + dy * W] = SOLID;
      cases.push(['baddie sealed away', L]);
    }
    {
      const L = base();
      L.cells[L.exit] = FLOOR;
      cases.push(['exit in plain sight', L]);
    }
    return cases.map(([name, L]) => ({ name, caught: checkLevel(L).length > 0, probs: checkLevel(L) }));
  }

  // The autopilot plays each stage. opts: { diff, mode, stages: [n...], limit (s), seed, buddyEvery (s) }
  function soak(opts = {}) {
    const diff = opts.diff || 'normal', mode = opts.mode || 'adventure';
    const limit = opts.limit || 300;
    const stages = opts.stages || [...Array(BT.Levels.count).keys()];
    const results = [];
    const heroes = mode === 'coop' ? ['teddy', 'tommy'] : ['teddy'];
    let stats = heroes.map(() => ({}));
    for (const n of stages) {
      const seed = ((opts.seed || 1) * 7919 + n * 104729) >>> 0;
      const M = BT.Engine.create({ mode, diff, n, seed, heroes, cpu: heroes.map(() => true), stats, hearts: 99 });
      const r = { stage: n + 1, name: M.L.name, result: 'timeout', time: 0, caught: 0, saves: 0, pops: 0, buddyPops: 0, bombs: 0, buddyBombs: 0, spawnTrap: 0 };
      const respawnAt = [];
      let nextBuddy = opts.buddyEvery || 0;
      const dt = BT.Engine.DT;
      while (M.state === 'play' && M.time < limit) {
        if (opts.buddyEvery && M.time >= nextBuddy) {
          for (const p of M.players) M.callBuddy(p.i);
          nextBuddy += opts.buddyEvery;
        }
        M.step(dt, []);
        for (const ev of M.events) {
          if (ev.type === 'caught') {
            r.caught++;
            // caught again near the start within 4 s of popping back there: the spawn was trapped
            const p = ev.who;
            if (respawnAt[p.i] !== undefined && M.time - respawnAt[p.i] < 4 && Math.abs(p.x - p.sx) + Math.abs(p.y - p.sy) <= 3) r.spawnTrap++;
          }
          if (ev.type === 'respawn') respawnAt[ev.who.i] = M.time;
          if (ev.type === 'saved') r.saves++;
          if (ev.type === 'pop') {
            r.pops++;
            if (ev.buddy) r.buddyPops++;
          }
          if (ev.type === 'bomb') ev.buddy ? r.buddyBombs++ : r.bombs++;
          if (ev.type === 'boom' && ev.buddy) r.buddyBoom = (r.buddyBoom || 0) + 1;
        }
        M.events.length = 0;
      }
      r.result = M.state === 'clear' ? 'clear' : M.state === 'over' ? 'over' : 'timeout';
      r.time = Math.round(M.time);
      results.push(r);
      // carry power-ups on, like the real adventure
      stats = M.players.map((p) => ({ bombs: p.bombs, range: p.range, speedUps: p.speedUps, kick: p.kick }));
    }
    const cleared = results.filter((r) => r.result === 'clear').length;
    return { diff, mode, cleared, of: results.length, results };
  }

  // Computer vs computer battle rounds: every round must end (last one standing, a draw, or the clock).
  function battleSoak(rounds = 40, diff = 'normal') {
    const out = { rounds, ko: 0, draw: 0, time: 0, wins: [0, 0], longest: 0, buddyVisits: 0, saves: 0, stuck: 0 };
    for (let k = 0; k < rounds; k++) {
      const M = BT.Engine.create({ mode: 'battle', diff, n: k % BT.Levels.ARENAS.length, seed: (k * 7919 + 17) >>> 0, heroes: ['teddy', 'tommy'], cpu: [true, true] });
      M.players.forEach((p) => (p.level = diff));
      while (M.state === 'play' && M.time < TUNE.battle.roundTime + 5) {
        M.step(BT.Engine.DT, []);
        for (const ev of M.events) {
          if (ev.type === 'buddyIn') out.buddyVisits++;
          if (ev.type === 'saved') out.saves++;
        }
        M.events.length = 0;
      }
      if (M.state !== 'roundEnd') out.stuck++;
      else if (M.reason === 'time') out.time++;
      else if (M.winner < 0) out.draw++;
      else {
        out.ko++;
        out.wins[M.winner]++;
      }
      out.longest = Math.max(out.longest, Math.round(M.time));
    }
    return out;
  }

  BT.Check = { checkLevel, checkAll, sabotage, soak, battleSoak, SAFE_WALK };
})();
