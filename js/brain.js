/* The computer player: Battle's CPU brother, the demo behind the menus and the autopilot the headless soak test
   uses to play every stage. It reads the engine's danger map (when each cell will be on fire), only drops a bomb
   when it can see a way out, grabs power-ups, blasts crates and lines up on whoever it's after.
   Exposes BT.Brain.think(match, player, dt) -> input. */
(function () {
  'use strict';
  const BT = window.BT;
  const E = BT.Engine;
  const { W, FLOOR, CRATE, DIRS, idx } = BT.Grid;
  const INF = Infinity;

  const SKILL = {
    easy: { react: 0.45, bombChance: 0.3, crateChance: 0.45, wander: 0.3, buddy: 0.0012 },
    normal: { react: 0.12, bombChance: 0.9, crateChance: 0.85, wander: 0.04, buddy: 0.003 },
  };

  function think(M, p, dt) {
    const out = { dx: 0, dy: 0, bomb: false, buddy: false };
    if (p.state !== 'play') return out;
    const B = p.brain || (p.brain = { path: [], wait: 0, skill: SKILL[p.level] || SKILL[M.diff] || SKILL.normal, stuck: 0 });
    B.wait -= dt;
    const D = E.danger(M);
    const me = E.cellOf(p);
    const speed = E.speedOf(p);
    const scary = scaryCells(M);

    if (E.centred(p)) {
      if (B.path.length && B.path[0] === me) B.path.shift();
      if (D[me] < INF || scary.has(me)) {
        const esc = escape(M, p, D, speed, scary);
        if (esc) B.path = esc;
      } else if (B.wait <= 0 || !B.path.length) {
        B.wait = B.skill.react;
        decide(M, p, B, D, speed, scary, out);
      } else if (B.path.length && !stepOK(M, D, scary, B.path[0], 1, speed)) B.path = [];
    }

    if (B.path.length) {
      const n = B.path[0], nx = n % W, ny = (n / W) | 0;
      const ddx = nx - p.x, ddy = ny - p.y;
      if (Math.abs(ddx) > 1.5 || Math.abs(ddy) > 1.5) B.path = []; // knocked off the path (respawn)
      else if (Math.abs(ddx) >= Math.abs(ddy) && Math.abs(ddx) > 1e-4) {
        out.dx = Math.sign(ddx);
        out.dist = Math.abs(ddx) + Math.abs(ddy);
      } else if (Math.abs(ddy) > 1e-4) {
        out.dy = Math.sign(ddy);
        out.dist = Math.abs(ddx) + Math.abs(ddy);
      }
    }
    if (p.botBuddy !== false && M.battle) {
      const bud = M.buddies[p.i];
      if (bud && !bud.on && bud.rest <= 0 && M.rand() < B.skill.buddy) out.buddy = true;
    }
    return out;
  }

  // Cells next to a baddie (adventure): the bot keeps out of them.
  function scaryCells(M) {
    const s = new Set();
    if (M.battle) return s;
    for (const e of M.enemies) {
      if (e.state !== 'walk') continue;
      for (const [x, y] of [[Math.round(e.x), Math.round(e.y)], [e.tx, e.ty]]) {
        s.add(idx(x, y));
        for (const [dx, dy] of DIRS) s.add(idx(x + dx, y + dy));
      }
    }
    return s;
  }

  function stepOK(M, D, scary, c, depth, speed) {
    if (M.fireT[c] > 0 || scary.has(c)) return false;
    return D[c] === INF || D[c] > depth / speed + 0.3;
  }

  function escape(M, p, D, speed, scary) {
    return E.pathTo(M, p, (c) => D[c] === INF && !scary.has(c), 12, (c, depth) => M.fireT[c] <= 0 && (D[c] === INF || D[c] > depth / speed + 0.15) && !(scary.has(c) && depth <= 1));
  }

  function targetsOf(M, p) {
    if (M.battle) return M.players.filter((q) => q.team !== p.team && q.state === 'play');
    return M.enemies.filter((e) => e.state === 'walk');
  }

  function decide(M, p, B, D, speed, scary, out) {
    const x = Math.round(p.x), y = Math.round(p.y), me = idx(x, y);
    const r = M.rand;
    const targets = targetsOf(M, p);
    const tcells = new Set();
    for (const t of targets) {
      tcells.add(E.cellOf(t));
      if (t.tx !== undefined) tcells.add(idx(t.tx, t.ty));
    }
    const friends = M.players.filter((q) => q !== p && q.team === p.team && q.state === 'play').map((q) => E.cellOf(q));

    // 1. a bomb, if it's worth it and there's a way out
    if (p.active < p.bombs && !M.bombAt[me]) {
      const lined = E.inLine(M, x, y, p.range, (c) => tcells.has(c));
      const crate = DIRS.some(([dx, dy]) => M.cells[idx(x + dx, y + dy)] === CRATE);
      const want = (lined && r() < B.skill.bombChance) || (crate && r() < B.skill.crateChance);
      if (want) {
        const fake = { x, y, fuse: BT.TUNE.fuse[M.diff] || BT.TUNE.fuse.normal, range: p.range };
        const blast = E.bombCells(M, fake);
        const hurtsFriend = friends.some((c) => blast.includes(c));
        if (!hurtsFriend) {
          const D2 = E.danger(M, fake);
          const esc = escape(M, p, D2, speed, scary);
          if (esc && esc.length) {
            out.bomb = true;
            B.path = esc;
            return;
          }
        }
      }
    }

    // 2. somewhere to go, only through cells that stay safe
    const ok = (c, depth) => stepOK(M, D, scary, c, depth, speed);
    // co-op: keep a little apart, so neither brother is stuck waiting for the other to get out of his blast
    const roomy = (c) => friends.every((f) => Math.abs((f % W) - (c % W)) + Math.abs(((f / W) | 0) - ((c / W) | 0)) > 2);
    const safeGoal = (f) => (c) => D[c] === INF && !scary.has(c) && roomy(c) && f(c);
    let path = null;
    if (r() < B.skill.wander) path = randomStep(M, p, ok);
    if (!path) path = E.pathTo(M, p, safeGoal((c) => M.items[c] > 0), 10, ok);
    if (!path && !M.battle && M.exitOpen && M.exitShown) path = E.pathTo(M, p, (c) => c === M.exit, 40, ok);
    if (!path && targets.length) path = E.pathTo(M, p, safeGoal((c) => c !== me && E.inLine(M, c % W, (c / W) | 0, p.range, (q) => tcells.has(q))), 16, ok);
    if (!path) path = E.pathTo(M, p, safeGoal((c) => DIRS.some(([dx, dy]) => M.cells[c + dx + dy * W] === CRATE)), 30, ok);
    if (!path && M.battle && targets.length) path = E.pathTo(M, p, safeGoal((c) => tcells.has(c)), 30, ok);
    if (!path) path = randomStep(M, p, ok);
    B.path = path || [];
  }

  function randomStep(M, p, ok) {
    const x = Math.round(p.x), y = Math.round(p.y);
    const opts = [];
    for (const [dx, dy] of DIRS) {
      const c = idx(x + dx, y + dy);
      if (M.cells[c] === FLOOR && !M.bombAt[c] && ok(c, 1)) opts.push(c);
    }
    return opts.length ? [opts[Math.floor(M.rand() * opts.length)]] : null;
  }

  BT.Brain = { think, SKILL };
})();
