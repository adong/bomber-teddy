/* The game rules, as plain state stepped at a fixed rate. No Three.js in here: the renderer (js/game.js) only reads
   this state and turns the engine's events into effects and sounds, and the headless checks (js/check.js) run the
   same code. Grid y grows toward the camera; positions are in cells, with cell centres on whole numbers.
   Exposes BT.Engine. */
(function () {
  'use strict';
  const BT = window.BT;
  const G = BT.Grid;
  const { W, H, FLOOR, SOLID, CRATE, DIRS, idx } = G;
  const TUNE = BT.TUNE;
  const BUD = TUNE.buddy;
  const DT = 1 / 60;
  const INF = Infinity;
  const NO_INPUT = { dx: 0, dy: 0, bomb: false, buddy: false };

  const cellOf = (e) => idx(Math.round(e.x), Math.round(e.y));
  const centred = (e) => Math.abs(e.x - Math.round(e.x)) < 1e-3 && Math.abs(e.y - Math.round(e.y)) < 1e-3;
  const dirIndex = (dx, dy) => (dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3);
  const speedOf = (p) => TUNE.speed + p.speedUps * TUNE.speedStep;

  // ---------------------------------------------------------------- a match (one stage, or one battle round)
  // cfg: { mode: 'adventure'|'coop'|'battle', diff: 'easy'|'normal', n (stage or arena), seed,
  //        heroes: [id, ...], cpu: [bool, ...], stats: [{ bombs, range, speedUps, kick }], hearts, level? }
  function create(cfg) {
    const L = cfg.level || BT.Levels.make(cfg.mode, cfg.n, cfg.diff, cfg.seed);
    const battle = cfg.mode === 'battle';
    const M = {
      mode: cfg.mode, diff: cfg.diff, n: cfg.n, battle, L, theme: L.theme,
      cells: L.cells.slice(), hidden: L.hidden.slice(), items: new Int8Array(W * H), pending: new Int8Array(W * H),
      exit: L.exit, exitShown: false, exitOpen: false,
      bombs: [], bombAt: new Array(W * H).fill(null), nextId: 1,
      fireT: new Float32Array(W * H), fireMask: new Uint8Array(W * H), fireBy: new Array(W * H).fill(null),
      players: [], enemies: [], buddies: [],
      time: 0, state: 'play', stateT: 0, winner: -1, endT: 0, reason: '',
      timeLeft: battle ? TUNE.battle.roundTime : 0,
      hearts: cfg.hearts ?? 3, score: cfg.score || 0,
      events: [], rand: BT.Levels.rng(((cfg.seed >>> 0) ^ 0x9e3779b9) >>> 0),
      _danger: null, _dangerAt: -1, tick: 0,
    };
    const heroes = cfg.heroes || ['teddy'];
    L.spawns.forEach((s, i) => {
      if (i >= heroes.length) return;
      const st = (cfg.stats && cfg.stats[i]) || {};
      M.players.push({
        i, id: heroes[i], team: battle ? i : 0, x: s.x, y: s.y, sx: s.x, sy: s.y, face: 2, moving: false,
        bombs: st.bombs || TUNE.startBombs, range: st.range || TUNE.startRange, speedUps: st.speedUps || 0, kick: !!st.kick,
        active: 0, state: 'play', st: 0, safe: 0, cpu: !!(cfg.cpu && cfg.cpu[i]), brain: null, kicks: 0, caught: 0,
      });
      M.buddies.push({
        i, id: Kit.roster.buddyFor(heroes[i]), on: false, t: 0, x: s.x, y: s.y, face: 2, moving: false, shield: false,
        rest: 0, next: 0, active: 0, path: [], plan: 0, treatAt: -1, saves: 0, visits: 0, team: battle ? i : 0,
      });
    });
    L.enemies.forEach((e, k) => {
      M.enemies.push({ id: k + 1, kind: e.kind, x: e.x, y: e.y, tx: e.x, ty: e.y, dir: (k * 3) % 4, moving: false, state: 'walk', st: 0, wait: 0 });
    });
    M.step = (dt, inputs) => step(M, dt, inputs);
    M.callBuddy = (i) => callBuddy(M, i);
    return M;
  }

  const emit = (M, type, data) => M.events.push(Object.assign({ type }, data));

  // ---------------------------------------------------------------- movement shared by everyone
  // Lane-based grid movement with corner help: moving along a row while a bit above or below it first slides you
  // onto the row (or onto the next row if that's where the opening is), so turning into corridors is forgiving.
  function moveEnt(M, e, dx, dy, dist, pass) {
    const horiz = dx !== 0;
    const s = horiz ? dx : dy;
    let a = horiz ? e.x : e.y, p = horiz ? e.y : e.x;
    const a0 = a, p0 = p;
    const free = (al, pe) => (horiz ? pass(M, e, al, pe) : pass(M, e, pe, al));
    let rem = dist;
    const cp = Math.round(p);
    const ca = Math.round(a);
    if (Math.abs(p - cp) > 1e-3) {
      let lane = null;
      if (free(ca + s, cp)) lane = cp;
      else {
        const cp2 = cp + Math.sign(p - cp);
        if (Math.abs(p - cp2) < 0.65 && free(ca + s, cp2) && free(ca, cp2)) lane = cp2;
      }
      if (lane !== null) {
        const d = lane - p, stp = Math.min(Math.abs(d), rem);
        p += Math.sign(d) * stp;
        rem -= stp;
        if (Math.abs(lane - p) < 1e-4) p = lane;
      } else rem = Math.min(rem, Math.abs(a - ca)); // nothing open ahead: only walk to the middle of this cell
    }
    if (rem > 0 && Math.abs(p - Math.round(p)) < 1e-4) {
      p = Math.round(p);
      let na = a + s * rem;
      const c0 = Math.round(a);
      if (!free(c0 + s, p)) na = s > 0 ? Math.min(na, Math.max(a, c0)) : Math.max(na, Math.min(a, c0));
      a = na;
    } else if (rem > 0) {
      const c0 = Math.round(a);
      a = s > 0 ? Math.min(a + rem, Math.max(a, c0)) : Math.max(a - rem, Math.min(a, c0));
    }
    if (horiz) { e.x = a; e.y = p; } else { e.y = a; e.x = p; }
    return Math.abs(a - a0) > 1e-6 || Math.abs(p - p0) > 1e-6;
  }

  function inside(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }

  // Players and the companion: floor without bombs, except the bomb you are standing on.
  function passWalker(M, e, x, y) {
    if (!inside(x, y)) return false;
    const c = idx(x, y);
    if (M.cells[c] !== FLOOR) return false;
    const b = M.bombAt[c];
    return !b || c === cellOf(e);
  }
  function passEnemy(M, e, x, y) {
    if (!inside(x, y)) return false;
    const c = idx(x, y);
    return M.cells[c] === FLOOR && !M.bombAt[c];
  }

  function refreshBombAt(M) {
    M.bombAt.fill(null);
    for (const b of M.bombs) M.bombAt[b.cell] = b;
  }

  // ---------------------------------------------------------------- danger: when each cell will be on fire
  function bombCells(M, b) {
    return G.blastCells(M.cells, Math.round(b.x), Math.round(b.y), b.range, null);
  }
  // Seconds until each cell burns (0 = burning now, Infinity = safe). Chain reactions are followed.
  function danger(M, extra) {
    if (!extra && M._dangerAt === M.tick && M._danger) return M._danger;
    const D = new Float32Array(W * H).fill(INF);
    for (let c = 0; c < W * H; c++) if (M.fireT[c] > 0) D[c] = 0;
    const bs = extra ? M.bombs.concat([extra]) : M.bombs;
    if (bs.length) {
      const t = bs.map((b) => b.fuse);
      const cs = bs.map((b) => bombCells(M, b));
      const at = bs.map((b) => idx(Math.round(b.x), Math.round(b.y)));
      for (let guard = 0, changed = true; changed && guard < 12; guard++) {
        changed = false;
        for (let i = 0; i < bs.length; i++) {
          for (let j = 0; j < bs.length; j++) {
            if (i !== j && t[i] < t[j] && cs[i].includes(at[j])) {
              t[j] = t[i];
              changed = true;
            }
          }
        }
      }
      for (let i = 0; i < bs.length; i++) for (const c of cs[i]) if (t[i] < D[c]) D[c] = t[i];
    }
    if (!extra) {
      M._danger = D;
      M._dangerAt = M.tick;
    }
    return D;
  }

  // ---------------------------------------------------------------- the step
  function step(M, dt, inputs) {
    M.tick++;
    M.time += dt;
    M.stateT += dt;
    if (M.state === 'play') {
      if (M.battle) {
        M.timeLeft -= dt;
      }
      for (const p of M.players) {
        let inp = (inputs && inputs[p.i]) || NO_INPUT;
        if (p.cpu) inp = BT.Brain ? BT.Brain.think(M, p, dt) : NO_INPUT;
        updatePlayer(M, p, inp, dt);
      }
      for (const b of M.buddies) updateBuddy(M, b, dt);
      updateBombs(M, dt);
      updateFire(M, dt);
      updateEnemies(M, dt);
      collide(M);
      checkEnd(M, dt);
    } else {
      updateFire(M, dt);
      for (const p of M.players) p.st += dt;
      for (const e of M.enemies) if (e.state === 'pop') e.st += dt;
      for (const b of M.buddies) if (b.on) b.t += dt;
    }
  }

  // ---------------------------------------------------------------- players
  function updatePlayer(M, p, inp, dt) {
    p.st += dt;
    p.safe = Math.max(0, p.safe - dt);
    if (p.state === 'dizzy') {
      if (p.st >= TUNE.dizzyTime) afterDizzy(M, p);
      return;
    }
    if (p.state !== 'play') return;
    if (inp.buddy) callBuddy(M, p.i);
    if (inp.bomb) dropBomb(M, p);
    p.moving = false;
    if (inp.dx || inp.dy) {
      const dx = inp.dx ? Math.sign(inp.dx) : 0, dy = dx ? 0 : Math.sign(inp.dy);
      p.face = dirIndex(dx, dy);
      const dist = inp.dist !== undefined ? Math.min(inp.dist, speedOf(p) * dt) : speedOf(p) * dt;
      p.moving = moveEnt(M, p, dx, dy, dist, passWalker);
      if (p.kick) tryKick(M, p, dx, dy);
    }
    const c = cellOf(p);
    if (M.items[c]) pickup(M, p, c);
    if (M.exitOpen && c === M.exit && !M.battle) stageClear(M, p);
  }

  function dropBomb(M, p) {
    if (p.active >= p.bombs) return false;
    const x = Math.round(p.x), y = Math.round(p.y), c = idx(x, y);
    if (M.bombAt[c] || M.cells[c] !== FLOOR) return false;
    // easy adventure: your bombs never catch you or your brother; otherwise they catch everybody
    const mask = M.battle || M.diff !== 'easy' ? 3 : 0;
    const b = { id: M.nextId++, x, y, cell: c, fuse: TUNE.fuse[M.diff] || TUNE.fuse.normal, fuseMax: 0, range: p.range, owner: p, kind: 'player', mask, slide: null, t: 0 };
    b.fuseMax = b.fuse;
    p.active++;
    M.bombs.push(b);
    M.bombAt[c] = b;
    emit(M, 'bomb', { bomb: b, who: p });
    return true;
  }

  function tryKick(M, p, dx, dy) {
    const x = Math.round(p.x), y = Math.round(p.y);
    if (!inside(x + dx, y + dy)) return;
    const b = M.bombAt[idx(x + dx, y + dy)];
    if (!b || b.slide) return;
    // only when you're up against it (in the middle of your cell, lined up)
    if (Math.abs(p.x - x) > 0.12 || Math.abs(p.y - y) > 0.12) return;
    if (!slideFree(M, b, x + 2 * dx, y + 2 * dy)) return;
    b.slide = { dx, dy };
    p.kicks++;
    emit(M, 'kick', { bomb: b, who: p });
  }

  function pickup(M, p, c) {
    const type = M.items[c];
    M.items[c] = 0;
    const key = BT.ITEMS[type].key;
    if (key === 'bomb') p.bombs = Math.min(TUNE.maxBombs, p.bombs + 1);
    else if (key === 'fire') p.range = Math.min(TUNE.maxRange, p.range + 1);
    else if (key === 'speed') p.speedUps = Math.min(TUNE.maxSpeedUps, p.speedUps + 1);
    else if (key === 'kick') p.kick = true;
    else if (key === 'heart') M.hearts = Math.max(M.hearts, Math.min(TUNE.maxHearts, M.hearts + 1));
    M.score += 50;
    emit(M, 'pickup', { who: p, item: type, c });
  }

  function hit(M, p, why) {
    if (p.safe > 0 || p.state !== 'play') return;
    const bud = M.buddies[p.i];
    if (bud && bud.on && bud.shield) {
      bud.shield = false;
      bud.saves++;
      p.safe = BUD.savedSafe;
      emit(M, 'saved', { who: p, buddy: bud, why });
      return;
    }
    p.state = 'dizzy';
    p.st = 0;
    p.moving = false;
    p.caught++;
    if (!M.battle) M.hearts = Math.max(0, M.hearts - 1);
    emit(M, 'caught', { who: p, why });
  }

  function afterDizzy(M, p) {
    if (M.battle) {
      p.state = 'out';
      return;
    }
    if (M.hearts > 0) {
      p.x = p.sx;
      p.y = p.sy;
      p.state = 'play';
      p.st = 0;
      p.safe = TUNE.respawnSafe;
      p.face = 2;
      emit(M, 'respawn', { who: p });
    } else {
      p.state = 'out';
      emit(M, 'out', { who: p });
    }
  }

  // ---------------------------------------------------------------- the companion
  // Call him and he pops in next to you: his signature move, a treat, then ~6 s of help (he bombs baddies near you)
  // and his goodbye move. While he's here one hit that would catch you is blocked. Calling again while he's here
  // gives another treat (and, in the adventure, starts his visit over). In battle he rests a little after a visit.
  const visitOf = (M) => (M.battle ? BUD.battleVisit : BUD.visit);

  function callBuddy(M, i) {
    const b = M.buddies[i], owner = M.players[i];
    if (!b || !owner || M.state !== 'play') return false;
    if (!b.on) {
      if (b.rest > 0) {
        emit(M, 'buddyNope', { i });
        return false;
      }
      if (owner.state !== 'play') return false;
      // he pops in on a free cell next to you (behind you if he can), or right where you are
      const ox = Math.round(owner.x), oy = Math.round(owner.y);
      const back = (owner.face + 2) % 4;
      let spot = [ox, oy];
      for (const d of [back, (back + 1) % 4, (back + 3) % 4, owner.face]) {
        const nx = ox + DIRS[d][0], ny = oy + DIRS[d][1];
        if (inside(nx, ny) && M.cells[idx(nx, ny)] === FLOOR && !M.bombAt[idx(nx, ny)] && !(M.fireT[idx(nx, ny)] > 0)) {
          spot = [nx, ny];
          break;
        }
      }
      Object.assign(b, { on: true, t: 0, x: spot[0], y: spot[1], moving: false, shield: true, path: [], plan: 0, next: BUD.give + 0.6, treatAt: BUD.give, face: 2 });
      b.visits++;
      emit(M, 'buddyIn', { i, buddy: b });
      return true;
    }
    if (M.battle) {
      if (b.treatAt < 0 && b.t > BUD.give + 0.4 && b.t < visitOf(M) - BUD.bye - 0.6) b.treatAt = b.t + 0.35;
    } else if (b.t > BUD.give + 0.3) {
      b.t = 0.3;
      b.treatAt = BUD.give;
      b.path = [];
      b.moving = false;
      emit(M, 'buddyAgain', { i, buddy: b });
    }
    return true;
  }

  function buddyPhase(M, b) {
    if (!b.on) return 'off';
    if (b.t < BUD.hello) return 'hello';
    if (b.t > visitOf(M) - BUD.bye) return 'bye';
    if (b.treatAt >= 0 && b.treatAt - b.t < 0.35) return 'give';
    if (b.giveT > 0) return 'give';
    return 'help';
  }

  function updateBuddy(M, b, dt) {
    if (!b.on) {
      b.rest = Math.max(0, b.rest - dt);
      return;
    }
    b.t += dt;
    b.giveT = Math.max(0, (b.giveT || 0) - dt);
    b.next -= dt;
    if (b.treatAt >= 0 && b.t >= b.treatAt) {
      b.treatAt = -1;
      b.giveT = 0.35;
      emit(M, 'treat', { i: b.i, buddy: b });
    }
    if (b.t >= visitOf(M)) {
      b.on = false;
      b.shield = false;
      b.moving = false;
      b.rest = M.battle ? BUD.battleRest : 0;
      emit(M, 'buddyOut', { i: b.i, buddy: b });
      return;
    }
    b.phase = buddyPhase(M, b);
    b.moving = false;
    if (b.phase !== 'help') {
      // finish the step he's on so he stands on a cell centre while he poses
      if (!centred(b)) stepToward(M, b, Math.round(b.x), Math.round(b.y), 3.5 * dt);
      return;
    }
    buddyBrain(M, b, dt);
  }

  // Targets in a straight line from (x, y) within `range`, with nothing solid or crated in between.
  function inLine(M, x, y, range, isTarget) {
    for (const [dx, dy] of DIRS) {
      for (let k = 1; k <= range; k++) {
        const nx = x + dx * k, ny = y + dy * k;
        if (!inside(nx, ny)) break;
        const c = idx(nx, ny);
        if (M.cells[c] !== FLOOR) break;
        if (isTarget(c)) return true;
      }
    }
    return false;
  }

  function buddyTargets(M, b) {
    if (M.battle) return M.players.filter((p) => p.team !== b.team && p.state === 'play');
    return M.enemies.filter((e) => e.state === 'walk');
  }

  function buddyBrain(M, b, dt) {
    const speed = 4.2;
    const owner = M.players[b.i];
    if (centred(b)) {
      const x = Math.round(b.x), y = Math.round(b.y), c = idx(x, y);
      const targets = buddyTargets(M, b);
      const tcells = new Set(targets.map((t) => cellOf(t)));
      // drop a helper bomb when a baddie is lined up, or (when no baddie can be reached) to open up a crate
      const lined = targets.length && inLine(M, x, y, BUD.range, (cc) => tcells.has(cc));
      const crate = b.wantCrate && DIRS.some(([dx, dy]) => M.cells[idx(x + dx, y + dy)] === CRATE);
      if (b.next <= 0 && b.active < 2 && !M.bombAt[c] && (lined || crate)) {
        const fuse = M.battle ? TUNE.fuse[M.diff] || TUNE.fuse.normal : BUD.fuse;
        const mask = M.battle ? 3 & ~(1 << b.team) : 0; // his bombs never catch his own side
        const bomb = { id: M.nextId++, x, y, cell: c, fuse, fuseMax: fuse, range: BUD.range, owner: b, kind: 'buddy', mask, slide: null, t: 0 };
        M.bombs.push(bomb);
        M.bombAt[c] = bomb;
        b.active++;
        b.next = M.battle ? BUD.battleBombGap : BUD.bombGap;
        emit(M, 'bomb', { bomb, who: b, buddy: true });
        // then step out of its way, like a real bomber
        const blast = new Set(bombCells(M, bomb));
        b.path = pathTo(M, b, (cc) => !blast.has(cc), 6) || [];
        b.plan = 0.8;
      }
      b.plan -= dt;
      if (!b.path.length || b.plan <= 0) {
        b.plan = 0.6;
        let path = null;
        b.wantCrate = false;
        if (targets.length) path = pathTo(M, b, (cc) => inLine(M, cc % W, (cc / W) | 0, BUD.range, (q) => tcells.has(q)) && !tcells.has(cc), 10);
        if (!path && targets.length && b.next < 1) {
          // the baddies are walled in: blast a crate near you to open the way (his bombs never catch you)
          const near = (cc) => !owner || Math.abs((cc % W) - owner.x) + Math.abs(((cc / W) | 0) - owner.y) <= 6;
          path = pathTo(M, b, (cc) => near(cc) && DIRS.some(([dx, dy]) => M.cells[cc + dx + dy * W] === CRATE), 8);
          if (path) b.wantCrate = true;
        }
        if (!path && owner) {
          // nobody to bomb: stay close to the one who called him
          const oc = cellOf(owner);
          const d = Math.abs(owner.x - b.x) + Math.abs(owner.y - b.y);
          if (d > 2.2) path = pathTo(M, b, (cc) => cc === oc || Math.abs((cc % W) - owner.x) + Math.abs(((cc / W) | 0) - owner.y) <= 1.01, 14);
        }
        b.path = path || [];
      }
    } else b.plan -= dt;
    if (b.path.length) {
      const next = b.path[0];
      const nx = next % W, ny = (next / W) | 0;
      if (!passWalker(M, b, nx, ny) && cellOf(b) !== next) {
        b.path = [];
        return;
      }
      const moved = stepToward(M, b, nx, ny, speed * dt);
      b.moving = moved;
      if (Math.abs(b.x - nx) < 1e-3 && Math.abs(b.y - ny) < 1e-3) {
        b.x = nx;
        b.y = ny;
        b.path.shift();
      }
      if (!moved) b.path = [];
    } else if (!centred(b)) stepToward(M, b, Math.round(b.x), Math.round(b.y), speed * dt);
  }

  // Move straight toward a neighbouring cell centre; returns whether he moved.
  function stepToward(M, e, nx, ny, dist) {
    const ddx = nx - e.x, ddy = ny - e.y;
    if (Math.abs(ddx) < 1e-4 && Math.abs(ddy) < 1e-4) return false;
    const horiz = Math.abs(ddx) >= Math.abs(ddy);
    const d = Math.min(dist, horiz ? Math.abs(ddx) : Math.abs(ddy));
    const dx = horiz ? Math.sign(ddx) : 0, dy = horiz ? 0 : Math.sign(ddy);
    e.face = dirIndex(dx, dy);
    return moveEnt(M, e, dx, dy, d, passWalker);
  }

  // Shortest path (list of cells, excluding the start) from e's cell to the nearest cell where goal(c) holds.
  // ok(c, depth) can veto cells; bombs block except the one you stand on.
  function pathTo(M, e, goal, maxDepth, ok) {
    const start = cellOf(e);
    if (goal(start)) return [];
    const prev = new Int16Array(W * H).fill(-1);
    const depth = new Int16Array(W * H).fill(-1);
    depth[start] = 0;
    const q = [start];
    for (let h = 0; h < q.length; h++) {
      const c = q[h], x = c % W, y = (c / W) | 0;
      if (depth[c] >= maxDepth) continue;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!inside(nx, ny)) continue;
        const n = idx(nx, ny);
        if (depth[n] >= 0 || M.cells[n] !== FLOOR || M.bombAt[n]) continue;
        if (ok && !ok(n, depth[c] + 1)) continue;
        depth[n] = depth[c] + 1;
        prev[n] = c;
        if (goal(n)) {
          const path = [n];
          for (let k = prev[n]; k !== start; k = prev[k]) path.unshift(k);
          return path;
        }
        q.push(n);
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- bombs and fire
  function slideFree(M, b, x, y) {
    if (!inside(x, y)) return false;
    const c = idx(x, y);
    if (M.cells[c] !== FLOOR) return false;
    if (M.bombAt[c] && M.bombAt[c] !== b) return false;
    for (const p of M.players) if (p.state !== 'out' && cellOf(p) === c) return false;
    for (const e of M.enemies) if (e.state === 'walk' && (cellOf(e) === c || idx(e.tx, e.ty) === c)) return false;
    return true;
  }

  function updateBombs(M, dt) {
    let moved = false;
    for (const b of M.bombs) {
      b.t += dt;
      b.fuse -= dt;
      if (b.slide) {
        const { dx, dy } = b.slide;
        const cx = Math.round(b.x), cy = Math.round(b.y);
        const v = TUNE.kickSpeed * dt;
        if (slideFree(M, b, cx + dx, cy + dy)) {
          b.x += dx * v;
          b.y += dy * v;
        } else {
          // stop in the middle of this cell
          const ax = b.x + dx * v, ay = b.y + dy * v;
          b.x = dx > 0 ? Math.min(ax, Math.max(b.x, cx)) : dx < 0 ? Math.max(ax, Math.min(b.x, cx)) : b.x;
          b.y = dy > 0 ? Math.min(ay, Math.max(b.y, cy)) : dy < 0 ? Math.max(ay, Math.min(b.y, cy)) : b.y;
          if (Math.abs(b.x - cx) < 1e-3 && Math.abs(b.y - cy) < 1e-3) {
            b.x = cx;
            b.y = cy;
            b.slide = null;
            emit(M, 'bombStop', { bomb: b });
          }
        }
        const nc = idx(Math.round(b.x), Math.round(b.y));
        if (nc !== b.cell) {
          b.cell = nc;
          moved = true;
        }
      }
    }
    if (moved) refreshBombAt(M);
    // explode everything that's due, following chain reactions within the same step
    for (let guard = 0; guard < 40; guard++) {
      const due = M.bombs.find((b) => b.fuse <= 0);
      if (!due) break;
      explode(M, due);
    }
  }

  function explode(M, b) {
    M.bombs.splice(M.bombs.indexOf(b), 1);
    b.owner.active = Math.max(0, b.owner.active - 1);
    b.slide = null;
    const x = Math.round(b.x), y = Math.round(b.y);
    b.cell = idx(x, y);
    refreshBombAt(M);
    const cells = G.blastCells(M.cells, x, y, b.range, (c) => !!M.bombAt[c]);
    for (const c of cells) {
      M.fireT[c] = Math.max(M.fireT[c], TUNE.blastTime);
      M.fireMask[c] |= b.mask;
      M.fireBy[c] = b.owner;
      if (M.cells[c] === CRATE) {
        M.cells[c] = FLOOR;
        M.score += 10;
        if (M.hidden[c]) {
          M.pending[c] = M.hidden[c];
          M.hidden[c] = 0;
        }
        emit(M, 'crate', { c, item: M.pending[c] });
        if (c === M.exit && !M.exitShown) {
          M.exitShown = true;
          emit(M, 'exitShown', { c });
        }
      }
      const other = M.bombAt[c];
      if (other) other.fuse = Math.min(other.fuse, 0.07);
    }
    emit(M, 'boom', { x, y, cells, bomb: b, buddy: b.kind === 'buddy' });
  }

  function updateFire(M, dt) {
    for (let c = 0; c < W * H; c++) {
      if (M.fireT[c] <= 0) continue;
      M.fireT[c] -= dt;
      if (M.fireT[c] <= 0) {
        M.fireT[c] = 0;
        M.fireMask[c] = 0;
        M.fireBy[c] = null;
        if (M.pending[c]) {
          M.items[c] = M.pending[c];
          M.pending[c] = 0;
          emit(M, 'item', { c, item: M.items[c] });
        }
      }
    }
  }

  // ---------------------------------------------------------------- baddies
  // Zombies wander: mostly straight on, turning at random. Robots are quicker, keep out of fire and sometimes turn
  // toward the nearest player. Neither walks through crates or bombs.
  function updateEnemies(M, dt) {
    for (const e of M.enemies) {
      if (e.state === 'pop') {
        e.st += dt;
        continue;
      }
      const base = TUNE.enemySpeed[e.kind] * (M.diff === 'easy' ? TUNE.easyEnemySpeed : 1) * (1 + Math.min(M.n, 11) * 0.02);
      let rem = base * dt;
      for (let guard = 0; guard < 3 && rem > 0; guard++) {
        if (!e.moving) {
          if (e.wait > 0) {
            e.wait -= dt;
            break;
          }
          chooseDir(M, e);
          if (!e.moving) {
            e.wait = 0.3;
            break;
          }
        }
        // something landed in the cell it was heading for (a bomb): turn back if it isn't halfway yet
        if (!passEnemy(M, e, e.tx, e.ty) || (e.kind === 'robot' && M.fireT[idx(e.tx, e.ty)] > 0)) {
          const back = idx(e.tx, e.ty) !== cellOf(e);
          if (back) {
            e.tx = Math.round(e.x);
            e.ty = Math.round(e.y);
            e.dir = (e.dir + 2) % 4;
          }
        }
        const ddx = e.tx - e.x, ddy = e.ty - e.y, d = Math.abs(ddx) + Math.abs(ddy);
        if (d <= rem) {
          e.x = e.tx;
          e.y = e.ty;
          rem -= d;
          e.moving = false;
        } else {
          e.x += Math.sign(ddx) * rem;
          e.y += Math.sign(ddy) * rem;
          rem = 0;
        }
      }
    }
  }

  function chooseDir(M, e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const D = e.kind === 'robot' ? danger(M) : null;
    // baddies back away from anyone blinking (just popped back at the start, or just saved by his brother)
    const blinking = M.players.filter((p) => p.state === 'play' && p.safe > 0);
    const near = (nx, ny) => blinking.some((p) => Math.abs(p.x - nx) + Math.abs(p.y - ny) < 2.6);
    const okCell = (nx, ny) => passEnemy(M, e, nx, ny) && (!D || D[idx(nx, ny)] > 0.7) && !near(nx, ny);
    let opts = [];
    for (let d = 0; d < 4; d++) if (okCell(x + DIRS[d][0], y + DIRS[d][1])) opts.push(d);
    if (!opts.length) for (let d = 0; d < 4; d++) if (passEnemy(M, e, x + DIRS[d][0], y + DIRS[d][1]) && (!D || D[idx(x + DIRS[d][0], y + DIRS[d][1])] > 0.7)) opts.push(d);
    if (!opts.length && D) for (let d = 0; d < 4; d++) if (passEnemy(M, e, x + DIRS[d][0], y + DIRS[d][1])) opts.push(d);
    if (!opts.length) {
      e.moving = false;
      return;
    }
    const r = M.rand;
    const rev = (e.dir + 2) % 4;
    let d = -1;
    if (e.kind === 'robot' && r() < TUNE.robotChase[M.diff === 'easy' ? 'easy' : 'normal']) {
      let best = INF;
      const targets = M.players.filter((p) => p.state === 'play');
      for (const p of targets) {
        for (const o of opts) {
          const dd = Math.abs(x + DIRS[o][0] - p.x) + Math.abs(y + DIRS[o][1] - p.y);
          if (dd < best && (Math.abs(x - p.x) + Math.abs(y - p.y) < 9)) {
            best = dd;
            d = o;
          }
        }
      }
    }
    if (d < 0 && opts.includes(e.dir) && r() < (e.kind === 'zombie' ? 0.72 : 0.6)) d = e.dir;
    if (d < 0) {
      const turns = opts.length > 1 ? opts.filter((o) => o !== rev) : opts;
      d = turns[Math.floor(r() * turns.length)];
    }
    e.dir = d;
    e.tx = x + DIRS[d][0];
    e.ty = y + DIRS[d][1];
    e.moving = true;
  }

  function pop(M, e, by) {
    e.state = 'pop';
    e.st = 0;
    e.moving = false;
    M.score += e.kind === 'robot' ? 200 : 100;
    const buddy = !!(by && by.visits !== undefined);
    emit(M, 'pop', { enemy: e, by, buddy });
  }

  // ---------------------------------------------------------------- who got caught
  function collide(M) {
    for (const e of M.enemies) {
      if (e.state === 'walk' && M.fireT[cellOf(e)] > 0) pop(M, e, M.fireBy[cellOf(e)]);
    }
    for (const p of M.players) {
      if (p.state !== 'play') continue;
      const c = cellOf(p);
      if (M.fireT[c] > 0 && M.fireMask[c] & (1 << p.team)) hit(M, p, 'blast');
      if (p.state !== 'play') continue;
      for (const e of M.enemies) {
        if (e.state === 'walk' && Math.abs(e.x - p.x) < 0.62 && Math.abs(e.y - p.y) < 0.62) {
          hit(M, p, 'enemy');
          break;
        }
      }
    }
  }

  function checkEnd(M, dt) {
    if (M.battle) {
      const alive = [...new Set(M.players.filter((p) => p.state === 'play').map((p) => p.team))];
      if (alive.length <= 1 || M.timeLeft <= 0) {
        M.endT += dt;
        // a moment's grace so a double KO is a draw
        if (M.endT > 1.0 || M.timeLeft <= 0) {
          const still = [...new Set(M.players.filter((p) => p.state === 'play').map((p) => p.team))];
          M.winner = M.timeLeft <= 0 || still.length !== 1 ? -1 : still[0];
          M.reason = M.timeLeft <= 0 ? 'time' : still.length ? 'ko' : 'double';
          endWith(M, 'roundEnd');
        }
      }
      return;
    }
    if (!M.exitOpen && M.enemies.every((e) => e.state !== 'walk')) {
      M.exitOpen = true;
      emit(M, 'exitOpen', { c: M.exit, shown: M.exitShown });
    }
    if (M.players.every((p) => p.state === 'out')) endWith(M, 'over');
  }

  function stageClear(M, p) {
    M.winner = p.i;
    M.score += 500;
    endWith(M, 'clear');
  }

  function endWith(M, state) {
    M.state = state;
    M.stateT = 0;
    for (const b of M.bombs) b.owner.active = Math.max(0, b.owner.active - 1);
    if (M.bombs.length) emit(M, 'fizzle', { bombs: M.bombs.slice() });
    M.bombs = [];
    refreshBombAt(M);
    for (const b of M.buddies) {
      if (b.on) {
        b.on = false;
        b.shield = false;
        emit(M, 'buddyOut', { i: b.i, buddy: b, quiet: true });
      }
    }
    for (const p of M.players) {
      p.moving = false;
      if (state !== 'over' && p.state === 'play') {
        p.state = 'win';
        p.st = 0;
      }
    }
    emit(M, state, { winner: M.winner, reason: M.reason });
  }

  BT.Engine = {
    create, DT, cellOf, centred, danger, bombCells, inLine, pathTo, moveEnt, passWalker, stepToward, speedOf,
    dropBomb, callBuddy, buddyPhase, visitOf, hit,
  };
})();
