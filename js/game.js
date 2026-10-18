/* The game you see: scene, camera, characters, effects, HUD, menus, the companion's visits, the main loop and the
   window.game test hooks. It only reads the engine's state (js/engine.js) and turns its events into effects.
   Sections: setup · world · characters · effects · events · companion · camera · HUD · screens · flow · loop · hooks */
(function () {
  'use strict';
  const BT = window.BT;
  const T = THREE;
  const gfx = Kit.gfx;
  const People = Kit.people;
  const A = BT.Art;
  const E = BT.Engine;
  const TUNE = BT.TUNE, BUD = TUNE.buddy;
  const { W, H, CRATE } = BT.Grid;
  const TILE = TUNE.tile;
  const wx = A.wx, wz = A.wz;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const damp = (k, dt) => 1 - Math.exp(-k * dt);
  const FACE_ANGLE = [0, -Math.PI / 2, Math.PI, Math.PI / 2]; // up, right, down (toward the camera), left
  const nice = (name) => name[0] + name.slice(1).toLowerCase();
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const SCALE = { player: 1.22, enemy: 1.08 };

  // ---------------------------------------------------------------- saved settings
  const SAVE_KEY = 'bomberTeddy.v1';
  let saved = { unlocked: 0, diff: 'easy', heroes: ['teddy', 'tommy'], cpu2: false };
  try { Object.assign(saved, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* storage blocked */ }
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); } catch (e) { /* storage blocked */ } };

  // ---------------------------------------------------------------- state
  const G = {
    screen: 'loading', mode: 'adventure', diff: saved.diff, heroes: saved.heroes.slice(), cpu2: !!saved.cpu2,
    M: null, attract: false, phase: 'intro', phaseT: 0, time: 0, hold: false, autoPause: true,
    camp: null, bat: null, startStage: 0, acc: 0, shake: 0, touch: false,
  };

  // ---------------------------------------------------------------- setup
  const canvas = $('game');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const FOV = 30, TILT = (53 * Math.PI) / 180;
  const camera = new T.PerspectiveCamera(FOV, 1, 0.5, 500);
  const hemi = new T.HemisphereLight('#ffffff', '#7a6a58', 0.75);
  scene.add(hemi);
  const sun = new T.DirectionalLight('#fff4e0', 1.15);
  sun.position.set(-12, 30, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);

  const fx = {
    puffs: A.SpritePool(scene, 260, A.puffTexture()),
    stars: A.SpritePool(scene, 120, gfx.emojiTexture('⭐')),
    glows: A.SpritePool(scene, 40, gfx.glowTexture(), T.AdditiveBlending),
    confetti: A.Confetti(scene, 2400),
    fire: A.FireFloor(scene),
    danger: A.DangerFloor(scene),
    words: [],
  };
  const PASTEL = ['#ffffff', '#ffe066', '#ff9ecd', '#8fe3ff', '#a8f08a', '#d0a8ff', '#ffc38a'];

  let thumbs = {};

  // ---------------------------------------------------------------- world (arena + things on it)
  const world = { arena: null, crates: new Map(), bombs: new Map(), items: new Map(), exit: null, marker: null, theme: null };

  function buildWorld(M) {
    if (world.arena) {
      scene.remove(world.arena.group);
      world.arena.dispose();
    }
    for (const b of world.bombs.values()) scene.remove(b.root);
    for (const it of world.items.values()) scene.remove(it.root);
    world.bombs.clear();
    world.items.clear();
    world.arena = A.buildArena(M);
    world.crates = world.arena.crates;
    scene.add(world.arena.group);
    const th = M.theme;
    world.theme = th;
    scene.background = new T.Color(th.sky);
    scene.fog = new T.Fog(th.sky, 70, 170);
    hemi.color.set(th.id === 'space' ? '#c8d0ff' : '#ffffff');
    hemi.intensity = th.id === 'space' ? 0.6 : 0.75;
    if (!world.exit) {
      world.exit = A.makeExit();
      scene.add(world.exit.root);
      world.marker = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture('⬇️'), depthWrite: false, depthTest: false }));
      world.marker.scale.setScalar(1.1);
      world.marker.renderOrder = 8;
      scene.add(world.marker);
    }
    world.exit.root.visible = false;
    world.exit.setOpen(false);
    world.marker.visible = false;
    if (M.exit >= 0) world.exit.root.position.set(wx(M.exit % W), 0, wz((M.exit / W) | 0));
    fx.puffs.clear();
    fx.stars.clear();
    fx.confetti.clear();
    for (const w of fx.words) w.s.visible = false;
    buildCast(M);
    G.camFit = null;
  }

  // ---------------------------------------------------------------- characters
  // Models are pooled by look, so stage after stage reuses the same people.
  const pool = {};
  function lookFor(id, variant) {
    const e = Kit.roster.get(id);
    if (!variant) return e.look;
    // a second copy of the same person (2P picked the same hero, or the buddy is already playing): new colours
    return Object.assign({}, e.look, { top: variant === 'p2' ? '#ff8a5a' : '#ffd27a', shoes: variant === 'p2' ? '#3d8bff' : e.look.shoes });
  }
  function getModel(id, variant) {
    const key = id + ':' + (variant || '');
    const list = pool[key] || (pool[key] = []);
    const free = list.find((m) => !m.used);
    if (free) {
      free.used = true;
      free.root.visible = true;
      return free;
    }
    const m = People.build(lookFor(id, variant));
    m.used = true;
    m.key = key;
    m.root.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    scene.add(m.root);
    list.push(m);
    return m;
  }
  function releaseModel(m) {
    if (!m) return;
    m.used = false;
    m.root.visible = false;
    for (const extra of m.extras || []) m.root.remove(extra);
    m.extras = [];
  }

  const cast = { players: [], enemies: new Map(), buddies: [] };

  function buildCast(M) {
    for (const v of cast.players) {
      releaseModel(v.m);
      dropTreat(v);
      // the old dizzy stars and OOPS! burst go too (a stage left mid-OOPS would otherwise leave it floating)
      scene.remove(v.stars, v.oops.s);
      v.stars.children.forEach((st) => st.material.dispose());
      v.oops.s.material.dispose();
    }
    for (const v of cast.enemies.values()) releaseModel(v.m);
    for (const v of cast.buddies) releaseModel(v.m);
    cast.players = [];
    cast.enemies.clear();
    cast.buddies = [];
    const twoUp = M.players.length > 1;
    const heroIds = M.players.map((p) => p.id);
    M.players.forEach((p, i) => {
      const variant = i === 1 && heroIds[0] === p.id ? 'p2' : '';
      const m = getModel(p.id, variant);
      m.root.scale.setScalar(SCALE.player);
      m.extras = [];
      const v = { m, entry: Kit.roster.get(p.id), variant, ang: Math.PI, ph: 0, tag: null, bubble: null, stars: null, oops: null, treat: null, ball: null, lastState: 'play' };
      if (twoUp) {
        v.tag = gfx.nameTag(p.id === 'teddy' || p.id === 'tommy' || !variant ? Kit.roster.get(p.id).name : 'P2', i === 0 ? '#8cc2ff' : '#ffb0b0');
        v.tag.position.y = 2.75;
        v.tag.scale.multiplyScalar(0.9);
        m.root.add(v.tag);
        m.extras.push(v.tag);
      }
      v.bubble = A.shieldBubble(Kit.roster.get(M.buddies[i].id).tag || '#ffb02e');
      v.bubble.visible = false;
      v.bubble.position.y = 1.1;
      m.root.add(v.bubble);
      m.extras.push(v.bubble); // pooled models drop it again on release
      v.stars = A.dizzyStars();
      scene.add(v.stars);
      v.oops = { s: A.wordSprite('OOPS!', '#ffd400', '#ff6a8a'), t: 9 };
      v.oops.s.visible = false;
      scene.add(v.oops.s);
      cast.players.push(v);
    });
    for (const e of M.enemies) {
      const m = getModel(e.kind === 'robot' ? 'bolt' : 'zombie');
      m.root.scale.setScalar(SCALE.enemy);
      m.extras = [];
      cast.enemies.set(e.id, { m, ph: Math.random() * 6, ang: 0, gone: false });
    }
    M.buddies.forEach((b, i) => {
      const clash = heroIds.includes(b.id) || M.buddies.some((o, k) => k < i && o.id === b.id);
      const entry = Kit.roster.get(b.id);
      const m = getModel(b.id, clash ? 'buddy' : '');
      m.root.visible = false;
      const s = SCALE.player * (entry.buddyScale || 0.8);
      m.root.scale.setScalar(s);
      m.extras = [];
      const tag = gfx.nameTag(entry.name, M.battle ? (i === 0 ? '#8cc2ff' : '#ffb0b0') : entry.tag || '#ffb02e');
      tag.position.y = 2.75;
      m.root.add(tag);
      m.extras.push(tag);
      cast.buddies.push({ m, entry, scale: s, ang: Math.PI, ph: 0, shown: 0, cheerT: 0, ball: null, shot: false, mode: '', modeT: 0, leaving: 0 });
    });
  }

  // Ease the extra channels the kit's pose() doesn't touch back to standing.
  function settle(m, k) {
    m.rig.position.y += (0.55 - m.rig.position.y) * k;
    m.head.rotation.z += (0 - m.head.rotation.z) * k;
    m.legL.rotation.z += (0 - m.legL.rotation.z) * k;
    m.legR.rotation.z += (0 - m.legR.rotation.z) * k;
    m.rig.rotation.z += (0 - m.rig.rotation.z) * k;
  }
  // Standing celebrations: the kit's wave and peace poses stride in place, so keep the feet mostly planted.
  function plantFeet(m) {
    m.legL.rotation.x *= 0.25;
    m.legR.rotation.x *= 0.25;
  }
  // Caught: sitting on the floor, legs out, propped on the hands, head wobbling under the stars.
  function poseDizzy(m, t, k) {
    People.pose(m, 0, 'stand', k);
    const to = (o, p, v) => { o[p] += (v - o[p]) * k; };
    to(m.rig.position, 'y', -0.2);
    to(m.legL.rotation, 'x', 1.45);
    to(m.legR.rotation, 'x', 1.4);
    to(m.legL.rotation, 'z', -0.2);
    to(m.legR.rotation, 'z', 0.2);
    to(m.armL.rotation, 'x', -0.55);
    to(m.armR.rotation, 'x', -0.5);
    to(m.armL.rotation, 'z', -0.45);
    to(m.armR.rotation, 'z', 0.45);
    to(m.hips.rotation, 'x', 0.12);
    m.head.rotation.z = Math.sin(t * 3) * 0.3;
    m.head.rotation.x = 0.1 + Math.sin(t * 2.1) * 0.18;
    m.rig.rotation.z = Math.sin(t * 2.4) * 0.06;
  }

  // Signature celebration: Teddy shadow-boxes then sinks a jump shot, Tommy does his Y, everyone else waves.
  // Returns the hop height; calls shoot() at the top of each jump shot.
  function celebrate(m, entry, t, k, v) {
    const sig = (entry && entry.signature) || ['wave'];
    if (sig.includes('jumpshot')) {
      const cyc = t % 2.7;
      if (cyc < 1.5) {
        People.pose(m, t * 7, 'boxing', k);
        v.shot = false;
        return 0;
      }
      const u = (cyc - 1.5) / 1.2;
      People.pose(m, 0, 'jumpshot', k);
      if (u > 0.42 && !v.shot) {
        v.shot = true;
        shootBall(m, v);
      }
      return u < 1 ? Math.max(0, Math.sin(u * Math.PI)) * 0.9 : 0;
    }
    const mode = sig[0];
    People.pose(m, t * 4, mode, k);
    plantFeet(m);
    return mode === 'peace' ? Math.abs(Math.sin(t * 5)) * 0.18 : 0;
  }

  function turnTo(v, target, dt, rate = 14) {
    let d = target - v.ang;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    v.ang += d * damp(rate, dt);
    return v.ang;
  }

  const tmpV = new T.Vector3();
  function syncPlayers(M, dt) {
    M.players.forEach((p, i) => {
      const v = cast.players[i];
      if (!v) return;
      const m = v.m;
      const k = damp(18, dt);
      v.ph += dt * (p.moving ? 10 + p.speedUps * 1.4 : 3);
      let hop = 0;
      const st = p.state;
      if (st !== v.lastState) {
        if (st === 'play' && v.lastState === 'dizzy') v.ang = Math.PI;
        v.lastState = st;
      }
      m.root.visible = st !== 'out' || M.battle;
      if (st === 'dizzy' || (st === 'out' && M.battle)) {
        poseDizzy(m, p.st + i, k);
        turnTo(v, Math.PI, dt, 6);
      } else if (st === 'win') {
        settle(m, k);
        turnTo(v, Math.PI, dt, 8);
        hop = celebrate(m, v.entry, p.st, k, v);
      } else {
        settle(m, k);
        if (p.moving) {
          People.pose(m, v.ph, 'run', k);
          turnTo(v, FACE_ANGLE[p.face], dt);
        } else {
          People.pose(m, v.ph, 'stand', k);
          // after standing still for a bit, look at the camera
          if (G.phase === 'intro') turnTo(v, Math.PI, dt, 8);
          else turnTo(v, FACE_ANGLE[p.face], dt);
        }
      }
      m.root.rotation.y = v.ang;
      m.root.position.set(wx(p.x), hop, wz(p.y));
      // blinking while safe after a respawn or a save
      if (p.safe > 0 && st === 'play') m.root.visible = Math.floor(G.time * 12) % 2 === 0;
      // the companion's shield
      const bud = M.buddies[i];
      const shielded = bud && bud.on && bud.shield && (st === 'play' || st === 'win');
      v.bubble.visible = shielded && !G.attractHideBubble;
      if (shielded) v.bubble.scale.setScalar(1 + Math.sin(G.time * 5) * 0.04);
      // dizzy stars and OOPS!
      const dizzy = st === 'dizzy' || (st === 'out' && M.battle);
      v.stars.visible = dizzy;
      if (dizzy) {
        m.root.updateMatrixWorld(true);
        m.head.getWorldPosition(tmpV);
        v.stars.position.set(tmpV.x, tmpV.y + 0.75, tmpV.z);
        v.stars.children.forEach((s, j) => {
          const a = G.time * 4 + (j * Math.PI * 2) / 3;
          s.position.set(Math.cos(a) * 0.6, Math.sin(a * 2) * 0.08, Math.sin(a) * 0.6);
        });
      }
      v.oops.t += dt;
      const o = v.oops;
      o.s.visible = o.t < 1.5;
      if (o.s.visible) {
        const pop = o.t < 0.15 ? o.t / 0.15 : 1;
        o.s.position.set(wx(p.x), 3.6 + o.t * 0.5, wz(p.y));
        o.s.scale.set(2.6 * pop, 1.3 * pop, 1);
        o.s.material.opacity = o.t > 1.1 ? 1 - (o.t - 1.1) / 0.4 : 1;
      }
      updateBall(v, dt);
    });
  }

  function syncEnemies(M, dt) {
    for (const e of M.enemies) {
      const v = cast.enemies.get(e.id);
      if (!v || v.gone) continue;
      const m = v.m;
      if (e.state === 'pop') {
        // spin, swell and pop into stars
        if (e.st > 0.32) {
          v.gone = true;
          releaseModel(m);
          continue;
        }
        const u = e.st / 0.32;
        m.root.rotation.y += dt * 22;
        m.root.scale.setScalar(SCALE.enemy * (1 + u * 0.7));
        m.root.position.y = u * 0.8;
        continue;
      }
      v.ph += dt * (e.kind === 'robot' ? 9 : 6);
      People.pose(m, v.ph, e.moving ? 'walk' : 'stand', damp(12, dt));
      turnTo(v, FACE_ANGLE[e.dir], dt, 10);
      m.root.rotation.y = v.ang;
      const bob = e.kind === 'robot' ? Math.abs(Math.sin(v.ph * 2)) * 0.06 : 0;
      m.root.position.set(wx(e.x), bob, wz(e.y));
      if (e.kind === 'zombie') m.root.rotation.z = Math.sin(v.ph * 0.5) * 0.06;
    }
  }

  // ---------------------------------------------------------------- bombs, crates, power-ups, exit
  const BLAST_TEXT = { pop: ['POP!', '#ffd400', '#ff3d7f'] };
  function syncThings(M, dt) {
    // bombs
    const live = new Set();
    for (const b of M.bombs) {
      live.add(b.id);
      let v = world.bombs.get(b.id);
      if (!v) {
        v = A.makeBomb(b.kind === 'buddy');
        world.bombs.set(b.id, v);
        scene.add(v.root);
        v.root.scale.setScalar(0.01);
      }
      v.root.position.set(wx(b.x), 0, wz(b.y));
      const left = b.fuse / b.fuseMax;
      const beat = Math.sin(b.t * (8 + (1 - left) * 22));
      const grow = Math.min(1, b.t / 0.12);
      v.root.scale.setScalar(grow * (1 + beat * 0.06 * (1.4 - left)));
      if (b.slide) v.body.rotation[b.slide.dx ? 'z' : 'x'] += (b.slide.dx ? -b.slide.dx : b.slide.dy) * dt * 12;
      const flash = left < 0.35 && Math.sin(b.t * 30) > 0;
      v.mat.emissive.set(flash ? '#ff2a2a' : '#000000');
      v.mat.emissiveIntensity = flash ? 0.7 : 0;
      v.spark.scale.setScalar(0.55 + Math.random() * 0.35);
      v.spark.position.y = 1.04 - (1 - left) * 0.2;
    }
    for (const [id, v] of world.bombs) {
      if (!live.has(id)) {
        scene.remove(v.root);
        v.mat.dispose();
        world.bombs.delete(id);
      }
    }
    // crates that are gone (their burst is played from the event)
    for (const [c, m] of world.crates) {
      if (M.cells[c] !== CRATE) {
        m.scale.y -= dt * 8;
        m.scale.x = m.scale.z = 1 + (1 - m.scale.y) * 0.3;
        m.position.y = 0.75 * m.scale.y;
        if (m.scale.y <= 0.05) {
          world.arena.group.remove(m);
          world.crates.delete(c);
        }
      }
    }
    // power-ups
    for (let c = 0; c < W * H; c++) {
      const type = M.items[c];
      let v = world.items.get(c);
      if (type && !v) {
        v = A.makeItem(type);
        v.t = 0;
        v.root.position.set(wx(c % W), 0, wz((c / W) | 0));
        scene.add(v.root);
        world.items.set(c, v);
      }
      if (!type && v) {
        scene.remove(v.root);
        world.items.delete(c);
      } else if (v) {
        v.t += dt;
        const pop = Math.min(1, v.t / 0.25);
        v.root.scale.setScalar(pop * (1 + Math.max(0, 0.3 - v.t) * 0.8));
        v.card.position.y = 1.0 + Math.sin(G.time * 3 + c) * 0.12;
      }
    }
    // the exit: shown when its crate breaks, opens when every baddie has popped
    const ex = world.exit;
    if (M.exit >= 0) {
      ex.root.visible = M.exitShown;
      if (ex.open !== M.exitOpen) {
        ex.open = M.exitOpen;
        ex.setOpen(M.exitOpen);
      }
      ex.update(G.time);
      // a hint arrow when it's open but still hiding (right away on Easy, after a while on Normal)
      const hint = M.exitOpen && !M.exitShown && M.state === 'play' && (M.diff === 'easy' || G.exitOpenT > 12);
      world.marker.visible = hint;
      if (hint) world.marker.position.set(wx(M.exit % W), 2.6 + Math.abs(Math.sin(G.time * 4)) * 0.6, wz((M.exit / W) | 0));
    } else {
      ex.root.visible = false;
      world.marker.visible = false;
    }
    fx.fire.sync(M);
    fx.danger.sync(M, M.diff === 'easy' && !M.battle && M.state === 'play', G.time);
  }

  // ---------------------------------------------------------------- effects
  function word(text, fill, burst, x, y, z, size = 1) {
    let w = fx.words.find((o) => !o.s.visible);
    if (!w) {
      w = { s: A.wordSprite(text, fill, burst), t: 0 };
      scene.add(w.s);
      fx.words.push(w);
    }
    w.s.material.map = A.wordTexture(text, fill, burst);
    w.s.material.needsUpdate = true;
    w.s.visible = true;
    w.t = 0;
    w.x = x;
    w.y = y;
    w.z = z;
    w.size = size;
  }
  function updateWords(dt) {
    for (const w of fx.words) {
      if (!w.s.visible) continue;
      w.t += dt;
      if (w.t > 1.1) {
        w.s.visible = false;
        continue;
      }
      const pop = w.t < 0.12 ? w.t / 0.12 : 1 + Math.max(0, 0.25 - w.t) * 0.5;
      w.s.scale.set(2.6 * pop * w.size, 1.3 * pop * w.size, 1);
      w.s.position.set(w.x, w.y + w.t * 0.8, w.z);
      w.s.material.opacity = w.t > 0.8 ? 1 - (w.t - 0.8) / 0.3 : 1;
    }
  }

  function puffAt(x, z, n, o = {}) {
    for (let k = 0; k < n; k++) {
      fx.puffs.emit(x + (Math.random() - 0.5) * (o.spread ?? 0.6), (o.y ?? 0.6) + Math.random() * 0.5, z + (Math.random() - 0.5) * (o.spread ?? 0.6), {
        color: o.color || gfx.pick(PASTEL), s0: o.s0 ?? 1.0, s1: (o.s1 ?? 2.4) * (0.8 + Math.random() * 0.4), life: (o.life ?? 0.75) * (0.8 + Math.random() * 0.4),
        vx: (Math.random() - 0.5) * (o.v ?? 1.5), vy: o.vy ?? 1.6, vz: (Math.random() - 0.5) * (o.v ?? 1.5), rot: Math.random() * 6, spin: (Math.random() - 0.5) * 2, drag: 2.5,
      });
    }
  }

  function boomFx(ev) {
    const cx = wx(ev.x), cz = wz(ev.y);
    fx.glows.emit(cx, 1.0, cz, { color: '#fff2a0', s0: 3, s1: 6.5, life: 0.35, alpha: 1, drag: 0 });
    for (const c of ev.cells) {
      const x = wx(c % W), z = wz((c / W) | 0);
      const centre = x === cx && z === cz;
      puffAt(x, z, centre ? 4 : 3, { s0: 1.5, s1: centre ? 3.4 : 2.8, life: 0.85 });
      fx.confetti.emit(x, 0.8, z, centre ? 26 : 10, { speed: 3.5, up: 6 });
    }
    G.shake = Math.min(0.5, G.shake + 0.28);
  }

  function burstStars(x, y, z, n = 9) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      fx.stars.emit(x, y, z, { s0: 0.7, s1: 0.25, life: 0.9, vx: Math.cos(a) * 5, vy: 3 + Math.random() * 3, vz: Math.sin(a) * 5, gravity: 7, drag: 1.2, spin: 6, rot: Math.random() * 6 });
    }
  }

  function crateFx(c) {
    const x = wx(c % W), z = wz((c / W) | 0);
    const th = world.theme;
    fx.confetti.emit(x, 0.9, z, 14, { colors: [th.crate, th.crateLine, th.crateMark], speed: 3, up: 5, life: 1.2 });
  }

  // Teddy's basketball: arcs up and away from his hands, then SWISH!
  const ballTex = () => gfx.emojiTexture('🏀');
  function shootBall(m, v) {
    if (!v.ball) {
      v.ball = { s: new T.Sprite(new T.SpriteMaterial({ map: ballTex(), depthWrite: false })), t: -1, from: new T.Vector3(), to: new T.Vector3() };
      v.ball.s.scale.setScalar(0.6);
      scene.add(v.ball.s);
    }
    m.root.updateMatrixWorld(true);
    People.handWorld(m, 1, v.ball.from);
    v.ball.to.set(v.ball.from.x + 0.5, v.ball.from.y + 1.2, v.ball.from.z - 4.5);
    v.ball.t = 0;
    v.ball.s.visible = true;
    sfx('jump');
  }
  function updateBall(v, dt) {
    const b = v.ball;
    if (!b || b.t < 0) return;
    b.t += dt / 0.8;
    const k = Math.min(1, b.t);
    b.s.position.lerpVectors(b.from, b.to, k);
    b.s.position.y += Math.sin(k * Math.PI) * 2.6;
    b.s.material.rotation = -b.t * 8;
    if (k >= 1) {
      b.t = -1;
      b.s.visible = false;
      fx.confetti.emit(b.to.x, b.to.y, b.to.z, 20, { colors: ['#ff9f1c', '#ffffff', '#ffd400'], speed: 2.5, up: 2 });
      word('SWISH!', '#ffffff', '#ff9f1c', b.to.x, b.to.y + 0.6, b.to.z, 0.8);
      sfx('swish');
    }
  }

  // ---------------------------------------------------------------- sound helpers
  function sfx(name, ...args) {
    if (G.attract || G.silent) return;
    if (BT.sfx[name]) BT.sfx[name](...args);
  }

  // ---------------------------------------------------------------- engine events -> effects
  function handleEvents(M) {
    for (const ev of M.events) {
      switch (ev.type) {
        case 'bomb':
          sfx('drop');
          break;
        case 'kick':
          sfx('kick');
          break;
        case 'bombStop':
          sfx('thud');
          break;
        case 'boom':
          boomFx(ev);
          sfx('boom', ev.cells.length > 7);
          break;
        case 'crate':
          crateFx(ev.c);
          sfx('crate');
          break;
        case 'item': {
          const x = wx(ev.c % W), z = wz((ev.c / W) | 0);
          fx.stars.emit(x, 1.2, z, { s0: 0.2, s1: 1.2, life: 0.5, spin: 4 });
          sfx('item');
          break;
        }
        case 'pickup': {
          const info = BT.ITEMS[ev.item];
          const x = wx(ev.c % W), z = wz((ev.c / W) | 0);
          fx.confetti.emit(x, 1, z, 18, { colors: [info.color, '#ffffff', '#ffd400'], speed: 2, up: 5 });
          const who = M.players.length > 1 ? `${Kit.roster.get(ev.who.id).name}: ` : '';
          toast(`${info.emoji} ${who}${info.name}!`, 'good');
          bumpPw(ev.who.i, info.key);
          sfx('pickup');
          break;
        }
        case 'exitShown':
          if (M.exitOpen) toast('⭐ THERE\'S THE EXIT!', 'good');
          sfx('exitShown');
          break;
        case 'exitOpen':
          G.exitOpenT = 0;
          toast(ev.shown ? '⭐ ALL POPPED! RUN TO THE EXIT!' : '⭐ ALL POPPED! FIND THE EXIT!', 'good');
          sfx('exit');
          break;
        case 'pop': {
          const e = ev.enemy;
          const x = wx(e.x), z = wz(e.y);
          burstStars(x, 1.4, z, 10);
          fx.confetti.emit(x, 1.2, z, 24, { speed: 3, up: 6 });
          word('POP!', BLAST_TEXT.pop[1], BLAST_TEXT.pop[2], x, 2.6, z, 0.75);
          if (ev.buddy) toast(`⭐ ${Kit.roster.get(ev.by.id).name} GOT ONE!`, 'good');
          sfx('pop');
          break;
        }
        case 'caught': {
          const v = cast.players[ev.who.i];
          if (v) {
            v.oops.t = 0;
            dropTreat(v);
          }
          if (!M.battle) $('hearts').classList.remove('hit'), void $('hearts').offsetWidth, $('hearts').classList.add('hit');
          sfx('oops');
          break;
        }
        case 'saved': {
          const p = ev.who, b = ev.buddy;
          const x = wx(p.x), z = wz(p.y);
          burstStars(x, 1.4, z, 12);
          puffAt(x, z, 4, { color: '#bdefff', s1: 2.8 });
          toast(`🛡️ ${Kit.roster.get(b.id).name} SAVED YOU!`, 'save');
          const bv = cast.buddies[b.i];
          if (bv) bv.cheerT = 1.4;
          sfx('saved');
          break;
        }
        case 'respawn': {
          const p = ev.who;
          puffAt(wx(p.x), wz(p.y), 5, { s1: 2.6 });
          break;
        }
        case 'out': {
          const p = ev.who;
          puffAt(wx(p.x), wz(p.y), 6, { s1: 2.8 });
          if (M.players.length > 1 && M.players.some((q) => q.state !== 'out')) toast(`${Kit.roster.get(p.id).name} IS OUT OF HEARTS`, 'oops');
          break;
        }
        case 'buddyIn':
          buddyArrives(M, ev.buddy);
          break;
        case 'buddyAgain':
          sfx('buddy');
          break;
        case 'treat':
          giveTreat(M, ev.buddy);
          break;
        case 'buddyOut':
          buddyLeaves(M, ev.buddy, ev.quiet);
          break;
        case 'buddyNope': {
          const el = $('bud' + ev.i);
          el.classList.remove('no');
          void el.offsetWidth;
          el.classList.add('no');
          sfx('nope');
          break;
        }
        case 'fizzle':
          for (const b of ev.bombs) puffAt(wx(b.x), wz(b.y), 3, { color: '#ffffff', s1: 1.8 });
          sfx('fizzle');
          break;
        case 'clear':
          stageCleared(M);
          break;
        case 'over':
          stageLost(M);
          break;
        case 'roundEnd':
          roundOver(M);
          break;
      }
    }
    M.events.length = 0;
  }

  // ---------------------------------------------------------------- the companion (the other brother)
  // The engine runs his visit (when he helps, his bombs, his one-hit shield); here he pops in with a puff and a
  // name tag, does his signature move, hands over a treat, runs about, and waves (or shoots a 🏀) goodbye.
  function buddyArrives(M, b) {
    const v = cast.buddies[b.i];
    if (!v) return;
    v.m.root.visible = true;
    v.shown = 0;
    v.leaving = 0;
    v.ang = Math.PI;
    v.shot = false;
    puffAt(wx(b.x), wz(b.y), 6, { s1: 2.6 });
    fx.confetti.emit(wx(b.x), 1.2, wz(b.y), 30, { speed: 3, up: 6 });
    if (!G.attract) toast(`${v.entry.name}'S HERE!`, 'good');
    sfx('buddy');
  }
  function buddyLeaves(M, b, quiet) {
    const v = cast.buddies[b.i];
    if (!v) return;
    v.leaving = 0.001;
    if (!quiet) sfx('bye');
  }

  function giveTreat(M, b) {
    const v = cast.buddies[b.i], pv = cast.players[b.i], p = M.players[b.i];
    if (!v || !pv) return;
    const [emoji, label] = gfx.pick(TREATS);
    dropTreat(pv);
    const s = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture(emoji), depthWrite: false }));
    s.scale.setScalar(0.7);
    scene.add(s);
    v.m.root.updateMatrixWorld(true);
    const from = People.handWorld(v.m, 1, new T.Vector3());
    s.position.copy(from);
    pv.treat = { s, t: 0, from, held: false, emoji };
    if (!G.attract) toast(`${emoji} ${label} FROM ${v.entry.name}!`, 'good');
    sfx('treat');
    void p;
  }
  function dropTreat(pv) {
    if (!pv || !pv.treat) return;
    const s = pv.treat.s;
    if (s.parent) s.parent.remove(s);
    s.material.dispose();
    pv.treat = null;
  }
  function updateTreats(dt) {
    for (const pv of cast.players) {
      const tr = pv.treat;
      if (!tr) continue;
      tr.t += dt;
      if (!tr.held) {
        // arc from his hand into yours
        const k = Math.min(1, tr.t / 0.5);
        pv.m.root.updateMatrixWorld(true);
        const to = People.handWorld(pv.m, 1, tmpV);
        tr.s.position.lerpVectors(tr.from, to, k);
        tr.s.position.y += Math.sin(k * Math.PI) * 1.2;
        if (k >= 1) {
          tr.held = true;
          tr.t = 0;
          pv.m.armR.add(tr.s);
          tr.s.position.set(0.12, -0.95, 0.3);
          tr.s.scale.setScalar(1.05);
          fx.stars.emit(to.x, to.y + 0.3, to.z, { s0: 0.3, s1: 0.9, life: 0.4, spin: 5 });
        }
      } else if (tr.t > 5) dropTreat(pv);
    }
  }

  function syncBuddies(M, dt) {
    M.buddies.forEach((b, i) => {
      const v = cast.buddies[i];
      if (!v) return;
      const m = v.m;
      if (!b.on) {
        if (v.leaving > 0) {
          // shrink away in a puff
          v.leaving += dt;
          const u = v.leaving / 0.25;
          m.root.scale.setScalar(v.scale * Math.max(0.01, 1 - u));
          if (u >= 1) {
            v.leaving = 0;
            m.root.visible = false;
            puffAt(m.root.position.x, m.root.position.z, 5, { s1: 2.4 });
          }
        } else m.root.visible = false;
        updateBall(v, dt);
        return;
      }
      m.root.visible = true;
      v.shown += dt;
      const pop = Math.min(1, v.shown / 0.2);
      const k = damp(16, dt);
      const phase = E.buddyPhase(M, b);
      v.cheerT = Math.max(0, v.cheerT - dt);
      let mode = phase === 'hello' || v.cheerT > 0 ? Kit.roster.signature(v.entry, 'hello') : phase === 'bye' ? Kit.roster.signature(v.entry, 'goodbye') : phase === 'give' ? 'give' : b.moving ? 'run' : 'stand';
      v.modeT = mode === v.mode ? v.modeT + dt : 0;
      if (mode !== v.mode) v.shot = false;
      v.mode = mode;
      settle(m, k);
      let hop = 0;
      v.ph += dt * (b.moving ? 11 : 4);
      if (mode === 'jumpshot') {
        const u = Math.min(1, v.modeT / 0.8);
        People.pose(m, 0, 'jumpshot', k);
        hop = Math.sin(u * Math.PI) * 0.8;
        if (u > 0.45 && !v.shot) {
          v.shot = true;
          shootBall(m, v);
        }
      } else {
        People.pose(m, mode === 'boxing' ? b.t * 7 : v.ph, mode, k);
        if (mode === 'peace' || mode === 'wave' || mode === 'give') plantFeet(m);
        if (mode === 'peace') hop = Math.abs(Math.sin(b.t * 5)) * 0.15;
      }
      // face the camera to pose, the player to hand over the treat, and his way when running
      const owner = M.players[i];
      let target = FACE_ANGLE[b.face];
      if (mode === 'give' && owner) target = Math.atan2(-(owner.x - b.x), -(owner.y - b.y));
      else if (!b.moving) target = Math.PI;
      m.root.rotation.y = turnTo(v, target, dt, 10);
      m.root.scale.setScalar(v.scale * (pop < 1 ? 0.3 + pop * 0.7 + Math.sin(pop * Math.PI) * 0.3 : 1));
      m.root.position.set(wx(b.x) + 0.0, hop, wz(b.y));
      updateBall(v, dt);
    });
  }

  function callBuddy(i) {
    if (!G.M || G.screen !== 'play' || G.phase !== 'play') return;
    Kit.sound.init();
    G.M.callBuddy(i);
  }

  // ---------------------------------------------------------------- camera
  const corners = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, 1.3]) corners.push(new T.Vector3((sx * W * TILE) / 2, y, (sz * H * TILE) / 2));
  const cam = { d: 40, tx: 0, tz: 0 };

  function placeCam(d, tx, tz) {
    camera.position.set(tx, d * Math.sin(TILT), tz + d * Math.cos(TILT));
    camera.lookAt(tx, 0, tz);
    camera.updateMatrixWorld();
  }
  // The distance (and a small forward/back nudge) that fits the whole arena between the HUD and the bottom.
  function fitArena() {
    const w = innerWidth || 800, h = innerHeight || 600;
    const top = 1 - (2 * Math.min(110, h * 0.2)) / h;
    // tablets: keep the bottom row clear of the thumb pads (phones follow the players instead)
    const bottom = -0.97 + (G.touch && h >= 500 ? (2 * 110) / h : 0);
    const fits = (d, tz) => {
      placeCam(d, 0, tz);
      for (const c of corners) {
        tmpV.copy(c).project(camera);
        if (Math.abs(tmpV.x) > 0.97 || tmpV.y > top || tmpV.y < bottom) return false;
      }
      return true;
    };
    let best = { d: 200, tz: 0 };
    for (const tz of [-3, -2, -1, 0, 1]) {
      let lo = 8, hi = 200;
      if (!fits(hi, tz)) continue;
      for (let k = 0; k < 24; k++) {
        const mid = (lo + hi) / 2;
        if (fits(mid, tz)) hi = mid;
        else lo = mid;
      }
      if (hi < best.d) best = { d: hi, tz };
    }
    // on small screens, don't let tiles get tiny: get closer and follow the players instead
    const minTile = Math.min(w, h) < 500 ? 40 : 0;
    const dMax = minTile ? (TILE * h) / (2 * Math.tan((FOV * Math.PI) / 360) * minTile) : Infinity;
    return { d: best.d, tz: best.tz, dMax, follow: best.d > dMax };
  }

  function updateCamera(M, dt) {
    if (!G.camFit) G.camFit = fitArena();
    const f = G.camFit;
    let d = Math.min(f.d, f.dMax), tx = 0, tz = f.tz;
    const live = M ? M.players.filter((p) => p.state === 'play' || p.state === 'win' || p.state === 'dizzy') : [];
    if (f.follow && live.length) {
      const fx0 = live.reduce((s, p) => s + wx(p.x), 0) / live.length;
      const fz0 = live.reduce((s, p) => s + wz(p.y), 0) / live.length;
      const visW = d * Math.tan((FOV * Math.PI) / 360) * camera.aspect;
      const visD = (d * Math.tan((FOV * Math.PI) / 360)) / Math.sin(TILT);
      // on touch screens the camera may scroll a little past the edge, so nobody hides under the thumb pads
      const over = G.touch ? 4 : 0;
      const mx = Math.max(0, (W * TILE) / 2 + 1 - visW * 0.9) + over, mz = Math.max(0, (H * TILE) / 2 + 1 - visD * 0.8) + over * 0.75;
      tx = clamp(fx0, -mx, mx);
      tz = clamp(fz0, -mz, mz);
    }
    // stage clear / round win: lean in on the winner
    if (M && (M.state === 'clear' || (M.state === 'roundEnd' && M.winner >= 0)) && !G.attract) {
      const p = M.state === 'clear' ? M.players[M.winner] : M.players.find((q) => q.team === M.winner);
      if (p) {
        const u = Math.min(1, M.stateT / 1.2);
        d += (Math.min(d, 15) - d) * u;
        tx += (wx(p.x) - tx) * u;
        tz += (wz(p.y) - 2.2 - tz) * u; // the winner sits low in the frame, under the banner
      }
    }
    if (G.camOverride) {
      const o = G.camOverride;
      d = o.d;
      tx = wx(o.x);
      tz = wz(o.y) + (o.dz || 0);
    }
    const k = damp(4, dt);
    cam.d += (d - cam.d) * k;
    cam.tx += (tx - cam.tx) * k;
    cam.tz += (tz - cam.tz) * k;
    if (G.snapCam) {
      cam.d = d;
      cam.tx = tx;
      cam.tz = tz;
      G.snapCam = false;
    }
    G.shake = Math.max(0, G.shake - dt * 1.6);
    const s = G.shake * G.shake;
    placeCam(cam.d, cam.tx + (Math.random() - 0.5) * s, cam.tz + (Math.random() - 0.5) * s);
    sun.position.set(cam.tx - 12, 30, cam.tz + 16);
    sun.target.position.set(cam.tx, 0, cam.tz);
  }

  function resize() {
    const w = innerWidth || 800, h = innerHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    G.camFit = null;
  }
  addEventListener('resize', resize);

  // ---------------------------------------------------------------- HUD
  const hud = {};
  const cacheText = {};
  const setText = (el, key, v) => {
    if (cacheText[key] !== v) {
      cacheText[key] = v;
      el.textContent = v;
    }
  };
  function toast(text, cls) {
    if (G.attract) return;
    const el = document.createElement('div');
    el.className = 'toast' + (cls ? ' ' + cls : '');
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 1600);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  }
  // banners are timed in game time, so step() in tests controls them too
  function banner(html, cls, ms) {
    const b = $('banner');
    b.className = 'banner';
    void b.offsetWidth;
    b.innerHTML = html;
    b.className = 'banner show' + (cls ? ' ' + cls : '');
    G.bannerT = ms ? ms / 1000 : Infinity;
  }
  function hideBanner() {
    G.bannerT = 0;
    $('banner').classList.remove('show');
  }
  function bumpPw(i, key) {
    const el = document.querySelector(`#pb${i} .pw [data-k="${key}"]`);
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  function setupHud(M) {
    const two = M.players.length > 1;
    $('hud').classList.toggle('battle', M.battle);
    document.body.classList.toggle('two', two && !(M.battle && G.cpu2));
    $('pb1').style.visibility = two ? 'visible' : 'hidden';
    M.players.forEach((p, i) => {
      const pb = $('pb' + i);
      const entry = Kit.roster.get(p.id);
      pb.querySelector('.face img').src = thumbs[i === 1 && M.players[0].id === p.id ? 'p2:' + p.id : p.id] || thumbs[p.id];
      pb.querySelector('.nm').textContent = entry.name;
      pb.querySelector('.who').textContent = M.battle && i === 1 && G.cpu2 ? 'CPU' : i === 0 ? '1P' : '2P';
      const b = M.buddies[i], be = Kit.roster.get(b.id);
      pb.querySelector('.bud img').src = thumbs[b.id];
      pb.querySelector('.bud').title = `Call ${nice(be.name)}`;
      pb.querySelector('.bud .k').textContent = i === 0 ? 'T' : 'Enter';
      pb.querySelector('.bud .k').style.display = M.battle && i === 1 && G.cpu2 ? 'none' : '';
      const btn = $('bud' + i);
      btn.querySelector('img').src = thumbs[b.id];
      btn.querySelector('small').textContent = be.name;
      btn.title = `Call ${nice(be.name)} (${i === 0 ? 'T' : 'Enter'})`;
      btn.style.display = M.battle && i === 1 && G.cpu2 ? 'none' : '';
    });
    $('bud1').style.display = two && !(M.battle && G.cpu2) ? '' : 'none';
    $('stageName').textContent = M.battle ? `ROUND ${G.bat.round + 1}` : `STAGE ${M.n + 1} · ${M.L.name}`;
    if (M.battle) {
      [0, 1].forEach((i) => $('pb' + i).querySelectorAll('.wins i').forEach((el, k) => el.classList.toggle('on', G.bat.wins[i] > k)));
    }
    for (const k in cacheText) delete cacheText[k];
  }

  function updateHud(M) {
    if (!M || G.attract) return;
    M.players.forEach((p, i) => {
      const pb = $('pb' + i);
      setText(pb.querySelector('[data-k="bomb"] b'), `b${i}`, String(p.bombs));
      setText(pb.querySelector('[data-k="fire"] b'), `f${i}`, String(p.range));
      setText(pb.querySelector('[data-k="speed"] b'), `s${i}`, String(p.speedUps));
      pb.querySelector('[data-k="kick"]').classList.toggle('off', !p.kick);
      pb.classList.toggle('out', p.state === 'out');
      const b = M.buddies[i];
      const bud = pb.querySelector('.bud'), bar = bud.querySelector('i'), btn = $('bud' + i);
      const visit = E.visitOf(M);
      const fill = b.on ? clamp(1 - b.t / visit, 0, 1) : b.rest > 0 ? 1 - b.rest / BUD.battleRest : 1;
      bud.classList.toggle('on', b.on);
      bud.classList.toggle('rest', !b.on && b.rest > 0);
      bud.classList.toggle('shield', b.on && b.shield);
      bar.style.setProperty('--fill', b.on || b.rest > 0 ? fill.toFixed(3) : '0');
      btn.classList.toggle('on', b.on);
      btn.classList.toggle('rest', !b.on && b.rest > 0);
      btn.style.setProperty('--fill', fill.toFixed(3));
    });
    if (!M.battle) {
      const max = Math.max(M.hearts, G.camp ? G.camp.heartsMax : 3);
      setText($('hearts'), 'hearts', '❤️'.repeat(M.hearts) + '🤍'.repeat(Math.max(0, max - M.hearts)));
      const z = M.enemies.filter((e) => e.kind === 'zombie' && e.state === 'walk').length;
      const r = M.enemies.filter((e) => e.kind === 'robot' && e.state === 'walk').length;
      setText($('zN'), 'z', String(z));
      setText($('rN'), 'r', String(r));
      document.querySelector('#foes .zomb').classList.toggle('zero', z === 0);
      document.querySelector('#foes .robo').classList.toggle('zero', r === 0);
      document.querySelector('#foes .robo').style.display = M.enemies.some((e) => e.kind === 'robot') ? '' : 'none';
      $('foes').classList.toggle('clear', M.exitOpen && M.state === 'play');
      setText($('score'), 'score', `SCORE ${M.score.toLocaleString()}`);
    } else {
      const t = Math.max(0, Math.ceil(M.timeLeft));
      setText($('timer'), 'timer', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
      $('timer').classList.toggle('low', t <= 15);
    }
  }

  // ---------------------------------------------------------------- screens
  const SCREENS = ['title', 'select', 'pause', 'results'];
  function show(name) {
    G.screen = name;
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== name);
    $('hud').classList.toggle('hidden', !(name === 'play' || name === 'pause'));
    Kit.sound.music(name === 'play' ? 'play' : name === 'pause' ? 'pause' : name === 'results' ? 'over' : 'title');
  }

  function titleScreen() {
    G.camp = G.bat = null;
    hideBanner();
    show('title');
    startAttract();
    focusMode(0);
  }

  // A computer-vs-computer battle plays behind the menus.
  function startAttract() {
    G.attract = true;
    G.mode = 'battle';
    G.bat = { round: Math.floor(Math.random() * 4), wins: [0, 0] };
    const M = E.create({ mode: 'battle', diff: 'normal', n: G.bat.round, seed: (Math.random() * 1e9) >>> 0, heroes: ['teddy', 'tommy'], cpu: [true, true] });
    M.players.forEach((p) => (p.level = 'normal'));
    G.M = M;
    buildWorld(M);
    G.phase = 'play';
    G.phaseT = 0;
    G.snapCam = true;
  }

  // ---- title: pick a mode and difficulty
  const modeBtns = ['modeAdv', 'modeCoop', 'modeBattle'];
  let modeFocus = 0;
  function focusMode(k) {
    modeFocus = (k + modeBtns.length) % modeBtns.length;
    modeBtns.forEach((id, j) => $(id).classList.toggle('focus', j === modeFocus && G.keyNav));
  }
  function setDiff(d) {
    G.diff = d;
    saved.diff = d;
    persist();
    document.querySelectorAll('.lvl').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === d)));
  }

  // ---- select: heroes, stage, computer or player 2
  const sel = { k: [0, 1], stage: 0 };
  function selectScreen(mode) {
    G.mode = mode;
    const heroes = BT.HEROES;
    sel.k = [Math.max(0, heroes.indexOf(G.heroes[0])), Math.max(0, heroes.indexOf(G.heroes[1] || 'tommy'))];
    sel.stage = Math.min(saved.unlocked, BT.Levels.count - 1);
    const two = mode !== 'adventure';
    $('slot1').style.display = two ? '' : 'none';
    $('selVs').style.display = two ? '' : 'none';
    $('selVs').textContent = mode === 'battle' ? 'VS' : '&';
    $('cpuToggle').style.display = mode === 'battle' ? '' : 'none';
    $('stagePick').style.display = mode === 'battle' ? 'none' : '';
    $('selTitle').textContent = mode === 'adventure' ? 'PICK YOUR HERO' : mode === 'coop' ? 'PICK YOUR TEAM' : 'WHO VS WHO?';
    const k = (...keys) => keys.map((x) => `<kbd>${x}</kbd>`).join('');
    $('selHint').innerHTML = mode === 'adventure'
      ? `${k('A', 'D')} or ${k('←', '→')} hero · ${k('W', 'S')} stage · ${k('Enter')} go · ${k('Esc')} back`
      : mode === 'coop'
        ? `1P ${k('A', 'D')} · 2P ${k('←', '→')} · ${k('W', 'S')} stage · ${k('Enter')} go · ${k('Esc')} back`
        : `1P ${k('A', 'D')} · 2P ${k('←', '→')} · ${k('C')} computer or player · ${k('Enter')} go · ${k('Esc')} back`;
    renderSelect();
    show('select');
  }
  function renderSelect() {
    const heroes = BT.HEROES;
    [0, 1].forEach((i) => {
      const id = heroes[sel.k[i]];
      const slot = $('slot' + i);
      const same = i === 1 && heroes[sel.k[0]] === id;
      slot.querySelector('.pick img').src = thumbs[same ? 'p2:' + id : id];
      slot.querySelector('.nm').textContent = Kit.roster.get(id).name;
      const bid = Kit.roster.buddyFor(id);
      slot.querySelector('.pal img').src = thumbs[bid];
      slot.querySelector('.pal b').textContent = Kit.roster.get(bid).name;
    });
    $('cpuToggle').classList.toggle('on', G.cpu2);
    $('cpuToggle').textContent = G.cpu2 ? '🤖 COMPUTER' : '👤 PLAYER 2';
    $('slot1').querySelector('.who').textContent = G.mode === 'battle' && G.cpu2 ? 'CPU' : '2P';
    const st = BT.Levels.STAGES[sel.stage], th = BT.Levels.THEMES[st.theme];
    $('stageLabel').innerHTML = `STAGE ${sel.stage + 1}<small>${th.name} ${Math.floor(sel.stage / 3) + 1}-${(sel.stage % 3) + 1}${sel.stage < saved.unlocked ? ' ✓' : ''}</small>`;
  }
  function cycleHero(i, d) {
    sel.k[i] = (sel.k[i] + d + BT.HEROES.length) % BT.HEROES.length;
    sfx('click');
    renderSelect();
  }
  function cycleStage(d) {
    sel.stage = clamp(sel.stage + d, 0, Math.min(saved.unlocked, BT.Levels.count - 1));
    sfx('click');
    renderSelect();
  }

  // ---------------------------------------------------------------- game flow
  function startGame() {
    const heroes = BT.HEROES;
    G.heroes = [heroes[sel.k[0]], heroes[sel.k[1]]];
    saved.heroes = G.heroes.slice();
    saved.cpu2 = G.cpu2;
    persist();
    G.attract = false;
    if (G.mode === 'battle') {
      G.bat = { round: 0, wins: [0, 0] };
      startRound();
    } else {
      const coop = G.mode === 'coop';
      const hearts = (coop ? TUNE.coopHearts : TUNE.hearts)[G.diff];
      G.camp = { stage: sel.stage, hearts, heartsMax: hearts, score: 0, stats: [{}, {}], startStats: null, startHearts: hearts };
      startStage();
    }
  }

  function startStage() {
    const c = G.camp;
    c.startStats = c.stats.map((s) => Object.assign({}, s));
    c.startHearts = c.hearts;
    c.startScore = c.score;
    const coop = G.mode === 'coop';
    const M = E.create({
      mode: G.mode, diff: G.diff, n: c.stage, seed: (Math.random() * 1e9) >>> 0,
      heroes: coop ? G.heroes.slice(0, 2) : [G.heroes[0]], cpu: [false, false], stats: c.stats, hearts: c.hearts, score: c.score,
    });
    begin(M);
    banner(`STAGE ${c.stage + 1}<small>${M.L.name}</small>`, 'cool', 1500);
    BT.Input.setTwoPlayer(coop);
  }

  function startRound() {
    const b = G.bat;
    const M = E.create({ mode: 'battle', diff: G.diff, n: b.round % BT.Levels.ARENAS.length, seed: (Math.random() * 1e9) >>> 0, heroes: G.heroes.slice(0, 2), cpu: [false, G.cpu2] });
    M.players[1].level = G.diff;
    begin(M);
    const last = b.wins[0] === TUNE.battle.winsNeeded - 1 && b.wins[1] === TUNE.battle.winsNeeded - 1;
    banner(last ? 'FINAL ROUND' : `ROUND ${b.round + 1}`, 'cool', 1500);
    BT.Input.setTwoPlayer(!G.cpu2);
  }

  function begin(M) {
    G.M = M;
    G.attract = false;
    buildWorld(M);
    setupHud(M);
    BT.Input.clear();
    G.phase = 'intro';
    G.phaseT = 0;
    G.acc = 0;
    G.exitOpenT = 0;
    G.snapCam = true;
    G.readySaid = G.goSaid = false;
    show('play');
    sfx('ready');
  }

  function stageCleared(M) {
    G.phase = 'outro';
    G.phaseT = 0;
    const p = M.players[M.winner];
    const name = Kit.roster.get(p.id).name;
    const last = M.n + 1 >= BT.Levels.count;
    banner(last ? `YOU DID IT!<small>${name} cleared every stage!</small>` : `STAGE CLEAR!<small>${name} found the exit</small>`, 'win');
    fx.confetti.emit(wx(p.x), 3, wz(p.y), 120, { speed: 6, up: 8 });
    sfx('fanfare');
    const c = G.camp;
    c.stats = M.players.map((q) => ({ bombs: q.bombs, range: q.range, speedUps: q.speedUps, kick: q.kick }));
    c.hearts = Math.min(TUNE.maxHearts, Math.max(1, M.hearts + 1)); // a heart for every stage cleared
    c.heartsMax = Math.max(c.heartsMax, c.hearts);
    c.score = M.score;
    c.stage++;
    saved.unlocked = Math.min(BT.Levels.count - 1, Math.max(saved.unlocked, c.stage));
    persist();
    G.after = () => {
      if (c.stage >= BT.Levels.count) results('done', M);
      else startStage();
    };
  }

  function stageLost(M) {
    G.phase = 'outro';
    G.phaseT = 0;
    banner('OOPS!<small>Out of hearts</small>', '');
    sfx('sad');
    G.after = () => results('over', M);
  }

  function roundOver(M) {
    G.phase = 'outro';
    G.phaseT = 0;
    const b = G.bat;
    if (G.attract) {
      G.after = () => startAttract();
      return;
    }
    if (M.winner >= 0) {
      b.wins[M.winner]++;
      const name = Kit.roster.get(M.players[M.winner].id).name;
      banner(`${name} WINS!<small>${M.reason === 'ko' ? 'last one standing' : ''}</small>`, 'win');
      sfx('fanfare');
      setupHud(M);
    } else {
      banner(M.reason === 'time' ? 'TIME!<small>nobody wins this one</small>' : 'DRAW!<small>both got bonked</small>', 'cool');
      sfx('sad');
    }
    b.round++;
    G.after = () => {
      const need = TUNE.battle.winsNeeded;
      if (b.wins[0] >= need || b.wins[1] >= need || b.round >= TUNE.battle.maxRounds) results('battle', M);
      else startRound();
    };
  }

  // results: 'over' (out of hearts), 'done' (every stage cleared), 'battle' (match over)
  function results(kind, M) {
    hideBanner();
    G.resKind = kind;
    const stats = $('resStats');
    stats.innerHTML = '';
    const line = (k, v) => (stats.innerHTML += `<div><b>${k}</b>${v}</div>`);
    if (kind === 'battle') {
      const b = G.bat;
      const w = b.wins[0] === b.wins[1] ? -1 : b.wins[0] > b.wins[1] ? 0 : 1;
      const ids = G.heroes;
      $('resFace').src = w < 0 ? thumbs.tommy : thumbs[w === 1 && ids[0] === ids[1] ? 'p2:' + ids[1] : ids[w]];
      $('resTitle').textContent = w < 0 ? "IT'S A TIE!" : `${Kit.roster.get(ids[w]).name} WINS!`;
      $('resSub').textContent = w < 0 ? 'Everybody gets a cookie 🍪' : 'Best of 3 · what a match!';
      line(`${Kit.roster.get(ids[0]).name}`, `${b.wins[0]} ★`);
      line(`${Kit.roster.get(ids[1]).name}${G.cpu2 ? ' (CPU)' : ''}`, `${b.wins[1]} ★`);
      $('againBtn').textContent = '↻ REMATCH';
    } else if (kind === 'over') {
      $('resFace').src = thumbs[G.heroes[0]];
      $('resTitle').textContent = 'OOPS!';
      $('resSub').textContent = `Out of hearts on stage ${M.n + 1}. Try again: your power-ups stay!`;
      line('SCORE', M.score.toLocaleString());
      $('againBtn').textContent = '↻ TRY AGAIN';
    } else {
      $('resFace').src = thumbs[G.heroes[0]];
      $('resTitle').textContent = 'YOU DID IT!';
      $('resSub').textContent = 'Every stage cleared. High five! ✋';
      line('SCORE', M.score.toLocaleString());
      $('againBtn').textContent = '↻ PLAY AGAIN';
    }
    show('results');
  }

  function again() {
    if (G.resKind === 'battle') {
      G.bat = { round: 0, wins: [0, 0] };
      startRound();
    } else if (G.resKind === 'over') {
      const c = G.camp;
      c.stats = c.startStats;
      c.hearts = (G.mode === 'coop' ? TUNE.coopHearts : TUNE.hearts)[G.diff];
      c.score = c.startScore;
      startStage();
    } else {
      sel.stage = 0;
      startGame();
    }
  }

  function pause(on) {
    if (on && G.screen === 'play') {
      show('pause');
      BT.Input.clear();
    } else if (!on && G.screen === 'pause') show('play');
  }

  // ---------------------------------------------------------------- the loop
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (G.hold) {
      last = now;
      return;
    }
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    tick(dt);
    renderer.render(scene, camera);
  }

  function tick(dt) {
    G.time += dt;
    const M = G.M;
    if (!M) return;
    const playing = G.screen === 'play' || (G.attract && (G.screen === 'title' || G.screen === 'select'));
    if (playing) {
      G.phaseT += dt;
      if (G.phase === 'intro') {
        if (!G.readySaid && G.phaseT > 0.2) {
          G.readySaid = true;
        }
        if (G.phaseT > 1.6) {
          G.phase = 'play';
          G.phaseT = 0;
          banner('GO!', '', 600);
          sfx('go');
        }
      } else {
        const inputs = G.attract ? [] : [BT.Input.read(0), BT.Input.read(1)];
        G.acc += dt;
        while (G.acc >= E.DT) {
          M.step(E.DT, inputs);
          for (const inp of inputs) inp.bomb = inp.buddy = false;
          G.acc -= E.DT;
        }
        if (M.exitOpen) G.exitOpenT += dt;
        handleEvents(M);
        if (G.phase === 'outro' && G.phaseT > (M.state === 'over' ? 2.2 : 4.2) && G.after) {
          const f = G.after;
          G.after = null;
          f();
          return;
        }
      }
    }
    syncThings(G.M, dt);
    syncPlayers(G.M, dt);
    syncEnemies(G.M, dt);
    syncBuddies(G.M, dt);
    updateTreats(dt);
    fx.puffs.update(dt);
    fx.stars.update(dt);
    fx.glows.update(dt);
    fx.confetti.update(dt);
    updateWords(dt);
    updateCamera(G.M, dt);
    if (G.screen === 'play') updateHud(G.M);
    if (G.bannerT > 0) {
      G.bannerT -= dt;
      if (G.bannerT <= 0) $('banner').classList.remove('show');
    }
  }

  // ---------------------------------------------------------------- input wiring
  function wire() {
    const tap = (id, fn) => $(id).addEventListener('click', (e) => {
      Kit.sound.init();
      sfx('click');
      fn(e);
      e.currentTarget.blur();
    });
    modeBtns.forEach((id) => tap(id, () => selectScreen($(id).dataset.mode)));
    document.querySelectorAll('.lvl').forEach((b) => b.addEventListener('click', () => {
      Kit.sound.init();
      setDiff(b.dataset.level);
      sfx('click');
    }));
    document.querySelectorAll('.slot').forEach((slot, i) => slot.querySelectorAll('.arrow').forEach((a) => a.addEventListener('click', () => cycleHero(i, +a.dataset.d))));
    document.querySelectorAll('#stagePick .arrow').forEach((a) => a.addEventListener('click', () => cycleStage(+a.dataset.s)));
    tap('cpuToggle', () => {
      G.cpu2 = !G.cpu2;
      renderSelect();
    });
    tap('selGo', startGame);
    tap('selBack', titleScreen);
    tap('pauseBtn', () => pause(true));
    tap('resumeBtn', () => pause(false));
    tap('quitBtn', titleScreen);
    tap('againBtn', again);
    tap('menuBtn', titleScreen);
    document.querySelectorAll('.muteBtn').forEach((b) => b.addEventListener('click', () => {
      Kit.sound.init();
      Kit.sound.toggleMute();
      muteIcon();
    }));
    // the companion buttons: big, with his face
    BT.Input.bindButton(0, $('bud0'), 'buddy', () => callBuddy(0));
    BT.Input.bindButton(1, $('bud1'), 'buddy', () => callBuddy(1));
    BT.Input.bindPad(0, $('pad0'));
    BT.Input.bindPad(1, $('pad1'));
    BT.Input.bindButton(0, $('bomb0'), 'bomb');
    BT.Input.bindButton(1, $('bomb1'), 'bomb');

    addEventListener('pointerdown', (e) => {
      Kit.sound.init();
      if (e.pointerType === 'touch' && !G.touch) setTouch(true);
    }, true);
    addEventListener('keydown', (e) => {
      Kit.sound.init();
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      onKey(e);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (G.autoPause) pause(true);
        Kit.sound.suspend();
      } else Kit.sound.resume();
    });
  }

  function setTouch(on) {
    G.touch = on;
    G.camFit = null;
    document.body.classList.toggle('touch', on);
  }

  function muteIcon() {
    document.querySelectorAll('.muteBtn').forEach((b) => (b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊'));
  }

  function onKey(e) {
    const k = e.code;
    if (k === 'KeyM') {
      Kit.sound.toggleMute();
      muteIcon();
      return;
    }
    if (G.screen === 'title') {
      G.keyNav = true;
      if (k === 'ArrowLeft' || k === 'KeyA') focusMode(modeFocus - 1);
      else if (k === 'ArrowRight' || k === 'KeyD') focusMode(modeFocus + 1);
      else if (k === 'ArrowUp' || k === 'KeyW' || k === 'ArrowDown' || k === 'KeyS') setDiff(G.diff === 'easy' ? 'normal' : 'easy');
      else if (k === 'Digit1') selectScreen('adventure');
      else if (k === 'Digit2') selectScreen('coop');
      else if (k === 'Digit3') selectScreen('battle');
      else if (k === 'Enter' || k === 'Space') {
        e.preventDefault();
        selectScreen($(modeBtns[modeFocus]).dataset.mode);
      }
      focusMode(modeFocus);
    } else if (G.screen === 'select') {
      const two = G.mode !== 'adventure';
      if (k === 'KeyA') cycleHero(0, -1);
      else if (k === 'KeyD') cycleHero(0, 1);
      else if (k === 'ArrowLeft') cycleHero(two ? 1 : 0, -1);
      else if (k === 'ArrowRight') cycleHero(two ? 1 : 0, 1);
      else if (G.mode !== 'battle' && (k === 'KeyW' || k === 'ArrowUp')) cycleStage(1);
      else if (G.mode !== 'battle' && (k === 'KeyS' || k === 'ArrowDown')) cycleStage(-1);
      else if (G.mode === 'battle' && k === 'KeyC') {
        G.cpu2 = !G.cpu2;
        renderSelect();
      } else if (k === 'Enter' || k === 'Space' || k === 'KeyF') {
        e.preventDefault();
        startGame();
      } else if (k === 'Escape') titleScreen();
    } else if (G.screen === 'play') {
      if (k === 'KeyP' || k === 'Escape') pause(true);
    } else if (G.screen === 'pause') {
      if (k === 'KeyP' || k === 'Escape' || k === 'Space' || k === 'Enter') {
        e.preventDefault();
        pause(false);
      } else if (k === 'KeyQ') titleScreen();
    } else if (G.screen === 'results') {
      if (k === 'Enter' || k === 'Space') {
        e.preventDefault();
        again();
      } else if (k === 'Escape') titleScreen();
    }
  }

  // Switching language mid-game: redraw the OOPS! bursts already made (other words are drawn fresh each time).
  if (Kit.lang) {
    Kit.lang.onChange(() => {
      for (const v of cast.players) {
        v.oops.s.material.map = A.wordTexture('OOPS!', '#ffd400', '#ff6a8a');
        v.oops.s.material.needsUpdate = true;
      }
    });
  }

  // ---------------------------------------------------------------- boot
  function boot() {
    document.title = `${BT.TITLE.replace(/!$/, '')}: Teddy & Tommy`;
    $('logoMain').innerHTML = BT.TITLE.replace(/TT/g, '<span class="tt">TT</span>');
    $('tagline').textContent = BT.SUBTITLE;
    resize();
    // portraits for menus and the HUD (and second-player colours for every hero)
    const entries = Kit.roster.list.slice();
    for (const id of BT.HEROES) entries.push({ id: 'p2:' + id, look: lookFor(id, 'p2'), pose: Kit.roster.get(id).pose });
    thumbs = Kit.portraits(entries, { size: 152 });
    $('zImg').src = thumbs.zombie;
    $('rImg').src = thumbs.bolt;
    setDiff(G.diff);
    muteIcon();
    wire();
    if (matchMedia('(hover: none) and (pointer: coarse)').matches) setTouch(true);
    $('loading').classList.add('hidden');
    titleScreen();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- test hooks (window.game)
  // The hidden Browser pane throttles requestAnimationFrame, so step() ticks and renders synchronously.
  window.game = {
    G, cast, world, scene, camera,
    step(seconds = 0.5) {
      G.autoPause = false;
      const n = Math.max(1, Math.round(seconds / (1 / 60)));
      for (let k = 0; k < n; k++) tick(1 / 60);
      renderer.render(scene, camera);
      return this.state();
    },
    hold(on = true) {
      G.hold = on;
      G.autoPause = false;
      return on;
    },
    render() {
      renderer.render(scene, camera);
    },
    // jump straight into a game: { mode, diff, heroes, stage, cpu2 }
    start(o = {}) {
      Kit.sound.init();
      G.autoPause = false;
      G.diff = o.diff || G.diff;
      G.cpu2 = !!o.cpu2;
      G.mode = o.mode || 'adventure';
      const heroes = o.heroes || ['teddy', 'tommy'];
      sel.k = heroes.map((h) => BT.HEROES.indexOf(h));
      if (sel.k.length < 2) sel.k.push(1);
      sel.stage = o.stage || 0;
      startGame();
      if (o.go !== false) this.step(1.8);
      return this.state();
    },
    state() {
      const M = G.M;
      if (!M) return { screen: G.screen };
      return {
        screen: G.screen, phase: G.phase, mode: M.mode, state: M.state, stage: M.n + 1, name: M.L.name, hearts: M.hearts, score: M.score,
        players: M.players.map((p) => ({ id: p.id, x: +p.x.toFixed(2), y: +p.y.toFixed(2), state: p.state, bombs: p.bombs, range: p.range, safe: +p.safe.toFixed(2) })),
        buddies: M.buddies.map((b) => ({ id: b.id, on: b.on, t: +b.t.toFixed(2), phase: E.buddyPhase(M, b), shield: b.shield, rest: +b.rest.toFixed(2), x: b.x, y: b.y })),
        enemies: M.enemies.filter((e) => e.state === 'walk').length, bombs: M.bombs.length, exitOpen: M.exitOpen, exitShown: M.exitShown,
      };
    },
    // drive player i for a moment: game.press(0, 'right', 0.5) / game.press(0, 'bomb')
    press(i, what, seconds = 0.05) {
      const M = G.M;
      const inp = { dx: 0, dy: 0, bomb: what === 'bomb', buddy: what === 'buddy' };
      const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[what];
      if (v) [inp.dx, inp.dy] = v;
      const n = Math.max(1, Math.round(seconds * 60));
      for (let k = 0; k < n; k++) {
        const inputs = [];
        inputs[i] = Object.assign({}, inp);
        M.step(E.DT, inputs);
        inp.bomb = inp.buddy = false;
        handleEvents(M);
        tick(0);
      }
      renderer.render(scene, camera);
      return this.state();
    },
    // close-up camera for screenshots: game.cam({ x, y, d }) in grid cells; game.cam(null) to let go
    cam(o) {
      G.camOverride = o;
      G.snapCam = true;
      return this.step(0.02);
    },
    buddy(i = 0) {
      G.M.callBuddy(i);
      return this.step(0.05);
    },
    // pop every baddie (to test the exit)
    clearEnemies() {
      for (const e of G.M.enemies) if (e.state === 'walk') G.M.enemies.find((q) => q === e) && Object.assign(e, { state: 'pop', st: 0 });
      return this.step(0.1);
    },
    // finish the stage: pop the baddies, uncover the exit and put player i on it
    win(i = 0) {
      const M = G.M;
      for (const e of M.enemies) if (e.state === 'walk') Object.assign(e, { state: 'pop', st: 0 });
      M.cells[M.exit] = 0;
      M.exitShown = true;
      this.step(0.1);
      Object.assign(M.players[i], { x: M.exit % W, y: (M.exit / W) | 0, safe: 0 });
      return this.step(0.1);
    },
    check: (seeds = 50) => BT.Check.checkAll({ seeds }),
    sabotage: () => BT.Check.sabotage(),
    soak: (o) => BT.Check.soak(o),
    title: titleScreen,
    toast,
    setTouch,
  };

  try {
    boot();
  } catch (err) {
    $('loading').textContent = 'Oops, something went wrong: ' + err.message;
    throw err;
  }
})();
