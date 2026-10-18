/* Everything you see that isn't a person: the arena for each theme, crates, cartoon bombs, power-up tiles, the exit,
   and the effects (confetti-smoke blasts, popping stars, dizzy stars, comic words, shields).
   All textures are painted on canvases. Exposes BT.Art. */
(function () {
  'use strict';
  const BT = window.BT;
  const T = THREE;
  const gfx = Kit.gfx;
  const { W, H, SOLID, CRATE, idx } = BT.Grid;
  const TILE = BT.TUNE.tile;
  const wx = (x) => (x - (W - 1) / 2) * TILE;
  const wz = (y) => (y - (H - 1) / 2) * TILE;

  // a tiny deterministic random for texture details
  function lcg(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  const cache = {};
  const once = (key, make) => cache[key] || (cache[key] = make());

  // ---------------------------------------------------------------- textures
  function floorTexture(th) {
    const S = 64;
    const [c, g] = gfx.makeCanvas(W * S, H * S);
    const r = lcg(7);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x * S, py = y * S;
        g.fillStyle = (x + y) % 2 ? th.floorB : th.floorA;
        g.fillRect(px, py, S, S);
        if (th.id === 'yard') {
          g.strokeStyle = gfx.shade(th.floorA, -0.18);
          g.lineWidth = 2;
          for (let k = 0; k < 7; k++) {
            const bx = px + 6 + r() * (S - 12), by = py + 10 + r() * (S - 16);
            g.beginPath();
            g.moveTo(bx, by);
            g.lineTo(bx + (r() - 0.5) * 5, by - 6 - r() * 4);
            g.stroke();
          }
          if (r() < 0.12) {
            g.fillStyle = r() < 0.5 ? '#fff6a0' : '#ffffff';
            g.beginPath();
            g.arc(px + 12 + r() * 40, py + 12 + r() * 40, 3, 0, Math.PI * 2);
            g.fill();
          }
        } else if (th.id === 'toys') {
          g.strokeStyle = gfx.shade(th.floorA, -0.14);
          g.lineWidth = 2;
          for (let k = 0; k < 4; k++) {
            g.beginPath();
            g.moveTo(px, py + k * 16 + 0.5);
            g.lineTo(px + S, py + k * 16 + 0.5);
            g.stroke();
          }
          const off = ((x * 7 + y * 3) % 4) * 16;
          for (let k = 0; k < 4; k++) {
            g.beginPath();
            g.moveTo(px + ((off + k * 23) % S), py + k * 16);
            g.lineTo(px + ((off + k * 23) % S), py + k * 16 + 16);
            g.stroke();
          }
        } else if (th.id === 'snow') {
          g.fillStyle = 'rgba(160,200,240,0.25)';
          g.fillRect(px, py + S - 6, S, 6);
          g.fillStyle = '#ffffff';
          for (let k = 0; k < 5; k++) g.fillRect(px + r() * S, py + r() * S, 2, 2);
        } else {
          g.strokeStyle = 'rgba(140,160,255,0.35)';
          g.lineWidth = 2;
          g.strokeRect(px + 3, py + 3, S - 6, S - 6);
          g.fillStyle = 'rgba(200,210,255,0.55)';
          for (const [ax, ay] of [[8, 8], [S - 8, 8], [8, S - 8], [S - 8, S - 8]]) {
            g.beginPath();
            g.arc(px + ax, py + ay, 2.5, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }
    // soft shade along the arena edge, under the walls
    return gfx.toTexture(c);
  }

  function wallTexture(th) {
    return once('wall-' + th.id, () => {
      const [c, g] = gfx.makeCanvas(128, 128);
      const r = lcg(3);
      g.fillStyle = th.wall;
      g.fillRect(0, 0, 128, 128);
      if (th.id === 'yard') {
        for (let k = 0; k < 70; k++) {
          g.fillStyle = r() < 0.5 ? gfx.shade(th.wall, -0.2) : gfx.shade(th.wall, 0.18);
          g.beginPath();
          g.arc(r() * 128, r() * 128, 6 + r() * 8, 0, Math.PI * 2);
          g.fill();
        }
      } else if (th.id === 'toys') {
        g.fillStyle = '#ffd400';
        g.fillRect(0, 54, 128, 20);
        g.fillStyle = '#ffffff';
        for (let k = 0; k < 4; k++) {
          g.beginPath();
          g.arc(16 + k * 32, 26, 7, 0, Math.PI * 2);
          g.fill();
        }
      } else if (th.id === 'snow') {
        g.strokeStyle = '#cfe4fb';
        g.lineWidth = 4;
        for (let row = 0; row < 4; row++) {
          g.beginPath();
          g.moveTo(0, row * 32 + 2);
          g.lineTo(128, row * 32 + 2);
          g.stroke();
          for (let k = 0; k < 3; k++) {
            const x = ((row % 2) * 32 + k * 64) % 128;
            g.beginPath();
            g.moveTo(x, row * 32);
            g.lineTo(x, row * 32 + 32);
            g.stroke();
          }
        }
      } else {
        g.fillStyle = gfx.shade(th.wall, -0.25);
        g.fillRect(0, 0, 128, 10);
        g.fillRect(0, 118, 128, 10);
        g.fillStyle = '#5ef2ff';
        g.fillRect(0, 58, 128, 10);
        g.fillStyle = gfx.shade(th.wall, 0.3);
        for (const [x, y] of [[10, 24], [118, 24], [10, 100], [118, 100]]) {
          g.beginPath();
          g.arc(x, y, 4, 0, Math.PI * 2);
          g.fill();
        }
      }
      return gfx.toTexture(c);
    });
  }

  function pillarTexture(th) {
    return once('pillar-' + th.id, () => {
      const [c, g] = gfx.makeCanvas(128, 128);
      const r = lcg(11);
      g.fillStyle = th.pillar;
      g.fillRect(0, 0, 128, 128);
      if (th.id === 'yard') {
        // stacked garden stones
        g.lineWidth = 4;
        g.strokeStyle = gfx.shade(th.pillar, -0.3);
        for (let row = 0; row < 3; row++) {
          const h = 128 / 3, off = row % 2 ? 32 : 0;
          for (let k = -1; k < 3; k++) {
            g.fillStyle = gfx.shade(th.pillar, (r() - 0.5) * 0.18);
            gfx.roundRect(g, off + k * 64 + 3, row * h + 3, 58, h - 6, 10);
            g.fill();
            g.stroke();
          }
        }
      } else if (th.id === 'snow') {
        const gr = g.createLinearGradient(0, 0, 128, 128);
        gr.addColorStop(0, '#e8f7ff');
        gr.addColorStop(1, th.pillar);
        g.fillStyle = gr;
        g.fillRect(0, 0, 128, 128);
        g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(18, 100);
        g.lineTo(46, 20);
        g.moveTo(40, 112);
        g.lineTo(60, 60);
        g.stroke();
        g.strokeStyle = 'rgba(80,150,210,0.6)';
        g.lineWidth = 4;
        g.strokeRect(2, 2, 124, 124);
      } else {
        g.fillStyle = gfx.shade(th.pillar, -0.2);
        g.fillRect(0, 0, 128, 14);
        g.fillRect(0, 114, 128, 14);
        g.fillStyle = '#5ef2ff';
        g.fillRect(0, 52, 128, 22);
        g.fillStyle = '#d4fbff';
        g.fillRect(0, 60, 128, 6);
        g.strokeStyle = gfx.shade(th.pillar, -0.3);
        g.lineWidth = 3;
        g.strokeRect(10, 20, 108, 26);
        g.strokeRect(10, 82, 108, 26);
      }
      return gfx.toTexture(c);
    });
  }

  // toy-room pillars are alphabet blocks; the letters spell the boys' names
  const LETTERS = 'TEDDYTOMMYABC';
  const LETTER_COLORS = ['#ff4b5c', '#3d8bff', '#ffd400', '#2fc27a', '#b45cff', '#ff8a1f'];
  function letterMaterials(i) {
    return once('letters-' + i, () => {
      const base = LETTER_COLORS[i % LETTER_COLORS.length];
      const mk = (ch, k) => {
        const [c, g] = gfx.makeCanvas(128, 128);
        g.fillStyle = base;
        g.fillRect(0, 0, 128, 128);
        g.fillStyle = '#ffffff';
        gfx.roundRect(g, 10, 10, 108, 108, 18);
        g.fill();
        g.fillStyle = LETTER_COLORS[(i + k + 2) % LETTER_COLORS.length];
        g.font = `86px ${gfx.FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(ch, 64, 70);
        return gfx.std('#ffffff', { map: gfx.toTexture(c), roughness: 0.6 });
      };
      const L = (k) => LETTERS[(i * 3 + k) % LETTERS.length];
      return [mk(L(0), 0), mk(L(1), 1), mk(L(2), 2), mk(L(2), 2), mk(L(3), 3), mk(L(4), 4)];
    });
  }

  function crateTexture(th, top) {
    return once(`crate-${th.id}-${top ? 'top' : 'side'}`, () => {
      const [c, g] = gfx.makeCanvas(128, 128);
      g.fillStyle = th.crate;
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = th.crateLine;
      g.lineWidth = 10;
      g.strokeRect(5, 5, 118, 118);
      if (th.id === 'yard') {
        // cardboard box: flaps, tape and a star stamp
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(10, 40);
        g.lineTo(118, 40);
        g.stroke();
        g.fillStyle = th.crateMark;
        g.fillRect(52, 0, 24, 128);
        star(g, 64, 84, 16, '#d8553a');
      } else if (th.id === 'toys') {
        g.fillStyle = '#ffffff';
        g.fillRect(10, 34, 108, 10);
        star(g, 64, 80, 26, th.crateMark);
      } else if (th.id === 'snow') {
        // a present with a ribbon
        g.fillStyle = th.crateMark;
        g.fillRect(54, 0, 20, 128);
        if (top) g.fillRect(0, 54, 128, 20);
        g.fillStyle = 'rgba(255,255,255,0.85)';
        for (const [x, y] of [[26, 28], [100, 30], [28, 100], [98, 98]]) {
          g.beginPath();
          g.arc(x, y, 6, 0, Math.PI * 2);
          g.fill();
        }
      } else {
        // cargo crate with a hazard band
        g.save();
        g.beginPath();
        g.rect(10, 50, 108, 28);
        g.clip();
        for (let k = -4; k < 12; k++) {
          g.fillStyle = k % 2 ? '#24232e' : '#ffd400';
          g.beginPath();
          g.moveTo(k * 16, 50);
          g.lineTo(k * 16 + 16, 50);
          g.lineTo(k * 16 + 44, 78);
          g.lineTo(k * 16 + 28, 78);
          g.fill();
        }
        g.restore();
        g.fillStyle = th.crateLine;
        for (const [x, y] of [[18, 18], [110, 18], [18, 110], [110, 110]]) {
          g.beginPath();
          g.arc(x, y, 5, 0, Math.PI * 2);
          g.fill();
        }
      }
      return gfx.toTexture(c);
    });
  }

  function star(g, x, y, r, color) {
    g.fillStyle = color;
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }

  // ---------------------------------------------------------------- the arena
  const geo = {};
  function G(key, make) {
    return geo[key] || (geo[key] = make());
  }

  function buildArena(M) {
    const th = M.theme;
    const group = new T.Group();
    const disposables = [];

    // floor + the world around it
    const ftex = floorTexture(th);
    disposables.push(ftex);
    const floor = new T.Mesh(new T.PlaneGeometry(W * TILE, H * TILE), gfx.std('#ffffff', { map: ftex, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);
    disposables.push(floor.geometry, floor.material);
    const ground = new T.Mesh(new T.PlaneGeometry(260, 260), gfx.std(th.ground, { roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    ground.receiveShadow = true;
    group.add(ground);
    disposables.push(ground.geometry, ground.material);

    // border walls and pillars (instanced: they never change)
    const wallM = [gfx.std('#ffffff', { map: wallTexture(th) }), gfx.std(th.wallTop)];
    const wallMats = [wallM[0], wallM[0], wallM[1], wallM[0], wallM[0], wallM[0]];
    const border = [], pillars = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (M.cells[idx(x, y)] !== SOLID) continue;
        (x === 0 || y === 0 || x === W - 1 || y === H - 1 ? border : pillars).push([x, y]);
      }
    }
    const wallGeo = G('wall', () => new T.BoxGeometry(TILE, 1.25, TILE));
    const walls = new T.InstancedMesh(wallGeo, wallMats, border.length);
    const m4 = new T.Matrix4();
    border.forEach(([x, y], k) => walls.setMatrixAt(k, m4.makeTranslation(wx(x), 0.625, wz(y))));
    walls.castShadow = walls.receiveShadow = true;
    group.add(walls);

    const pillarGeo = G('pillar', () => new T.BoxGeometry(TILE * 0.96, 1.7, TILE * 0.96));
    if (th.pillar === 'letters') {
      const cube = G('letterCube', () => new T.BoxGeometry(TILE * 0.94, TILE * 0.94, TILE * 0.94));
      pillars.forEach(([x, y], k) => {
        const m = new T.Mesh(cube, letterMaterials(k));
        m.position.set(wx(x), TILE * 0.47, wz(y));
        m.rotation.y = ((k * 7) % 4) * (Math.PI / 2) + ((k % 3) - 1) * 0.08;
        m.castShadow = m.receiveShadow = true;
        group.add(m);
      });
    } else {
      const pm = gfx.std('#ffffff', { map: pillarTexture(th), roughness: th.id === 'snow' ? 0.25 : 0.8, metalness: th.id === 'space' ? 0.35 : 0 });
      const top = gfx.std(th.pillarTop, { roughness: th.id === 'snow' ? 0.2 : 0.8 });
      const inst = new T.InstancedMesh(pillarGeo, [pm, pm, top, pm, pm, pm], pillars.length);
      pillars.forEach(([x, y], k) => inst.setMatrixAt(k, m4.makeTranslation(wx(x), 0.85, wz(y))));
      inst.castShadow = inst.receiveShadow = true;
      group.add(inst);
      if (th.id === 'yard' || th.id === 'snow') {
        // a little cap on each: grass tufts or a snow pile
        const capGeo = G('cap', () => new T.CylinderGeometry(0.62, 0.8, 0.28, 8));
        const caps = new T.InstancedMesh(capGeo, gfx.std(th.id === 'yard' ? '#6cc24a' : '#ffffff', { roughness: 0.9 }), pillars.length);
        pillars.forEach(([x, y], k) => caps.setMatrixAt(k, m4.makeTranslation(wx(x), 1.83, wz(y))));
        caps.castShadow = true;
        group.add(caps);
      }
    }

    // crates (one mesh each, they get blown away)
    const crateMats = crateMaterials(th);
    const crateGeo = G('crate', () => new T.BoxGeometry(TILE * 0.86, 1.5, TILE * 0.86));
    const crates = new Map();
    for (let c = 0; c < W * H; c++) {
      if (M.cells[c] !== CRATE) continue;
      const m = new T.Mesh(crateGeo, crateMats);
      m.position.set(wx(c % W), 0.75, wz((c / W) | 0));
      m.castShadow = m.receiveShadow = true;
      group.add(m);
      crates.set(c, m);
    }

    decorate(group, th, disposables);
    return {
      group, crates,
      dispose() {
        disposables.forEach((d) => d.dispose());
        walls.dispose();
      },
    };
  }

  function crateMaterials(th) {
    return once('crateMats-' + th.id, () => {
      const side = gfx.std('#ffffff', { map: crateTexture(th, false), roughness: 0.85 });
      const top = gfx.std('#ffffff', { map: crateTexture(th, true), roughness: 0.85 });
      return [side, side, top, side, side, side];
    });
  }

  // A few things around the arena so it feels like a place.
  function decorate(group, th, disposables) {
    const r = lcg(th.id.length * 31);
    const spots = [];
    for (let k = 0; k < 16; k++) {
      const side = k % 4;
      const along = (r() - 0.5) * (side < 2 ? 44 : 36);
      const out = 3.5 + r() * 9;
      const x = side === 0 ? -W - out : side === 1 ? W + out : along;
      const z = side === 2 ? -H - out : side === 3 ? H + out + 4 : along;
      if (side === 3) continue; // keep the front clear for the camera
      spots.push([x, z]);
    }
    const add = (m, x, y, z) => {
      m.position.set(x, y, z);
      m.castShadow = true;
      group.add(m);
      return m;
    };
    for (const [x, z] of spots) {
      if (th.id === 'yard') {
        add(new T.Mesh(G('trunk', () => new T.CylinderGeometry(0.35, 0.45, 2.4, 7)), gfx.std('#8a5a33')), x, 1.2, z);
        add(new T.Mesh(G('leaf', () => new T.IcosahedronGeometry(2.1, 0)), gfx.std(r() < 0.5 ? '#3f9c3a' : '#58b04a', { flatShading: true })), x, 3.6, z);
      } else if (th.id === 'toys') {
        const s = 1 + r() * 1.6;
        const m = add(new T.Mesh(G('toyblock', () => new T.BoxGeometry(1, 1, 1)), letterMaterials(Math.floor(r() * 6))[0]), x, s / 2, z);
        m.scale.setScalar(s);
        m.rotation.y = r() * 3;
        if (r() < 0.4) add(new T.Mesh(G('ball', () => new T.SphereGeometry(1.1, 16, 12)), gfx.std(LETTER_COLORS[Math.floor(r() * 6)], { roughness: 0.4 })), x + 2.5, 1.1, z + 1);
      } else if (th.id === 'snow') {
        const white = gfx.std('#ffffff', { roughness: 0.6 });
        add(new T.Mesh(G('sn1', () => new T.SphereGeometry(1.2, 14, 10)), white), x, 1.1, z);
        add(new T.Mesh(G('sn2', () => new T.SphereGeometry(0.85, 14, 10)), white), x, 2.7, z);
        add(new T.Mesh(G('nose', () => new T.ConeGeometry(0.14, 0.6, 8)), gfx.std('#ff8a1f')), x, 2.75, z + 0.95).rotation.x = Math.PI / 2;
        add(new T.Mesh(G('hat', () => new T.CylinderGeometry(0.5, 0.55, 0.6, 12)), gfx.std('#24232e')), x, 3.7, z);
      } else {
        add(new T.Mesh(G('ant', () => new T.CylinderGeometry(0.12, 0.25, 4, 6)), gfx.std('#9aa3cf', { metalness: 0.5, roughness: 0.4 })), x, 2, z);
        add(new T.Mesh(G('antb', () => new T.SphereGeometry(0.35, 10, 8)), new T.MeshBasicMaterial({ color: r() < 0.5 ? '#5ef2ff' : '#ff3d7f' })), x, 4.1, z);
      }
    }
    if (th.id === 'space') {
      // a planet and some stars in the sky
      const planet = new T.Mesh(new T.SphereGeometry(9, 24, 16), gfx.std('#b45cff', { roughness: 0.7 }));
      planet.position.set(-40, 6, -70);
      group.add(planet);
      const ring = new T.Mesh(new T.TorusGeometry(13, 0.8, 6, 40), gfx.std('#ffd400', { roughness: 0.6 }));
      ring.position.copy(planet.position);
      ring.rotation.x = 1.2;
      group.add(ring);
      disposables.push(planet.geometry, planet.material, ring.geometry, ring.material);
      const pts = [];
      for (let k = 0; k < 300; k++) pts.push((r() - 0.5) * 260, 2 + r() * 60, -60 - r() * 60);
      const sg = new T.BufferGeometry();
      sg.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
      const stars = new T.Points(sg, new T.PointsMaterial({ color: '#ffffff', size: 0.6, sizeAttenuation: true }));
      group.add(stars);
      disposables.push(sg, stars.material);
    }
  }

  // ---------------------------------------------------------------- bombs
  const bombGeo = () => G('bomb', () => new T.SphereGeometry(0.66, 22, 16));
  function makeBomb(buddy) {
    const root = new T.Group();
    const mat = gfx.std(buddy ? '#2c3f73' : '#25232e', { roughness: 0.32, metalness: 0.25, emissive: '#000000' });
    const body = new T.Mesh(bombGeo(), mat);
    body.position.y = 0.7;
    body.castShadow = true;
    root.add(body);
    const cap = new T.Mesh(G('bombCap', () => new T.CylinderGeometry(0.2, 0.24, 0.2, 10)), gfx.std('#6a6878', { metalness: 0.5, roughness: 0.4 }));
    cap.position.y = 0.66;
    body.add(cap);
    const shine = new T.Mesh(G('bombShine', () => new T.SphereGeometry(0.14, 8, 6)), new T.MeshBasicMaterial({ color: '#ffffff' }));
    shine.position.set(-0.26, 0.3, 0.42);
    shine.scale.set(1, 1.4, 0.6);
    body.add(shine);
    const fuseGeo = G('fuse', () => new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0, 0.7, 0), new T.Vector3(0.1, 0.92, 0.04), new T.Vector3(0.3, 1.02, 0.02)]), 10, 0.055, 6));
    const fuse = new T.Mesh(fuseGeo, gfx.std('#d9b48a'));
    body.add(fuse);
    const spark = new T.Sprite(new T.SpriteMaterial({ map: gfx.glowTexture(), color: '#ffb02e', blending: T.AdditiveBlending, depthWrite: false }));
    spark.position.set(0.3, 1.04, 0.02);
    spark.scale.setScalar(0.7);
    body.add(spark);
    const core = new T.Sprite(new T.SpriteMaterial({ map: gfx.glowTexture(), color: '#ffffff', blending: T.AdditiveBlending, depthWrite: false }));
    core.scale.setScalar(0.3);
    spark.add(core);
    core.position.set(0, 0, 0.01);
    if (buddy) {
      // the companion's bombs wear a little star
      const s = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture('⭐'), depthWrite: false }));
      s.position.set(0, 0.05, 0.7);
      s.scale.setScalar(0.42);
      body.add(s);
    }
    return { root, body, mat, spark, core };
  }

  // ---------------------------------------------------------------- power-ups and the exit
  function itemTexture(type) {
    return once('item-' + type, () => {
      const info = BT.ITEMS[type];
      const [c, g] = gfx.makeCanvas(128, 128);
      g.fillStyle = info.color;
      gfx.roundRect(g, 4, 4, 120, 120, 26);
      g.fill();
      g.lineWidth = 8;
      g.strokeStyle = '#ffffff';
      g.stroke();
      g.font = `78px ${gfx.EMOJI_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(info.emoji, 64, 70);
      return gfx.toTexture(c);
    });
  }
  function makeItem(type) {
    const root = new T.Group();
    const info = BT.ITEMS[type];
    const base = new T.Mesh(G('itemBase', () => new T.CylinderGeometry(0.75, 0.8, 0.12, 20)), gfx.std(info.color, { roughness: 0.5, emissive: info.color, emissiveIntensity: 0.25 }));
    base.position.y = 0.06;
    base.receiveShadow = true;
    root.add(base);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: gfx.glowTexture(), color: info.color, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
    glow.scale.setScalar(2.2);
    glow.position.y = 0.9;
    root.add(glow);
    const card = new T.Sprite(new T.SpriteMaterial({ map: itemTexture(type), depthWrite: false }));
    card.scale.setScalar(1.15);
    card.position.y = 1.0;
    root.add(card);
    return { root, card, glow };
  }

  function swirlTexture(open) {
    return once('swirl-' + open, () => {
      const [c, g] = gfx.makeCanvas(128, 128);
      const cols = open ? ['#ff3d7f', '#ffd400', '#2fc27a', '#18d4ff', '#b45cff'] : ['#8a8fa8', '#6d7290'];
      for (let k = 0; k < 24; k++) {
        g.fillStyle = cols[k % cols.length];
        g.beginPath();
        g.moveTo(64, 64);
        g.arc(64, 64, 64, (k / 24) * Math.PI * 2, ((k + 1) / 24) * Math.PI * 2 + 0.02);
        g.fill();
      }
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, open ? 'rgba(255,255,255,1)' : 'rgba(60,60,80,0.9)');
      gr.addColorStop(0.35, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      return gfx.toTexture(c);
    });
  }
  function makeExit() {
    const root = new T.Group();
    const padMat = new T.MeshBasicMaterial({ map: swirlTexture(false) });
    const pad = new T.Mesh(G('exitPad', () => new T.CircleGeometry(0.88, 32)), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.03;
    root.add(pad);
    const rim = new T.Mesh(G('exitRim', () => new T.TorusGeometry(0.9, 0.1, 8, 32)), gfx.std('#ffffff', { roughness: 0.4 }));
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.05;
    root.add(rim);
    const archMat = gfx.std('#8a8fa8', { roughness: 0.5 });
    const arch = new T.Mesh(G('exitArch', () => new T.TorusGeometry(0.85, 0.13, 10, 28, Math.PI)), archMat);
    arch.position.set(0, 0.05, -0.15);
    arch.castShadow = true;
    root.add(arch);
    const sign = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture('🔒'), depthWrite: false }));
    sign.position.set(0, 1.35, 0);
    sign.scale.setScalar(0.8);
    root.add(sign);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: gfx.glowTexture(), color: '#fff3a0', blending: T.AdditiveBlending, depthWrite: false, opacity: 0 }));
    glow.scale.set(2.6, 3.6, 1);
    glow.position.y = 1.1;
    root.add(glow);
    let open = false;
    return {
      root,
      setOpen(on) {
        open = on;
        padMat.map = swirlTexture(on);
        padMat.needsUpdate = true;
        archMat.color.set(on ? '#ffd400' : '#8a8fa8');
        archMat.emissive.set(on ? '#ff9f1c' : '#000000');
        archMat.emissiveIntensity = on ? 0.5 : 0;
        sign.material.map = gfx.emojiTexture(on ? '⭐' : '🔒');
        sign.material.needsUpdate = true;
      },
      update(t) {
        pad.rotation.z = open ? -t * 2.5 : 0;
        glow.material.opacity = open ? 0.55 + Math.sin(t * 4) * 0.2 : 0;
        sign.position.y = 1.35 + (open ? Math.abs(Math.sin(t * 3)) * 0.35 : 0);
      },
    };
  }

  // ---------------------------------------------------------------- effects
  function puffTexture() {
    return once('puff', () => {
      const [c, g] = gfx.makeCanvas(128, 128);
      const blob = (x, y, r) => {
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(0.55, 'rgba(250,250,255,1)');
        gr.addColorStop(0.8, 'rgba(215,215,235,0.9)');
        gr.addColorStop(1, 'rgba(200,200,225,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      };
      blob(64, 70, 40);
      blob(40, 60, 28);
      blob(88, 58, 30);
      blob(62, 40, 30);
      blob(80, 84, 24);
      return gfx.toTexture(c);
    });
  }

  // Comic words (OOPS!, SWISH!, POP!) on a starburst.
  function wordTexture(word, fill, burst) {
    return once(`word-${word}-${fill}-${burst}`, () => {
      const [c, g] = gfx.makeCanvas(320, 160);
      if (burst) {
        g.fillStyle = burst;
        g.beginPath();
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2, rr = k % 2 ? 50 : 76;
          g.lineTo(160 + Math.cos(a) * rr * 1.9, 80 + Math.sin(a) * rr);
        }
        g.closePath();
        g.fill();
        g.lineWidth = 6;
        g.strokeStyle = '#14121f';
        g.stroke();
      }
      g.font = `58px ${gfx.FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 12;
      g.lineJoin = 'round';
      g.strokeStyle = '#14121f';
      g.strokeText(word, 160, 84);
      g.fillStyle = fill;
      g.fillText(word, 160, 84);
      return gfx.toTexture(c);
    });
  }
  function wordSprite(word, fill, burst) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: wordTexture(word, fill, burst), depthWrite: false, depthTest: false }));
    s.scale.set(2.6, 1.3, 1);
    s.renderOrder = 10;
    return s;
  }

  // A pool of sprites that grow, drift and fade: smoke puffs, stars, sparkles.
  function SpritePool(scene, n, map, blending) {
    const items = [];
    for (let k = 0; k < n; k++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: blending || T.NormalBlending }));
      s.visible = false;
      scene.add(s);
      items.push({ s, life: 0, max: 1, v: new T.Vector3(), s0: 1, s1: 1, a: 1, spin: 0, g: 0 });
    }
    let next = 0;
    return {
      emit(x, y, z, o = {}) {
        const it = items[next];
        next = (next + 1) % n;
        it.s.position.set(x, y, z);
        it.s.visible = true;
        it.life = 0;
        it.max = o.life || 0.7;
        it.v.set(o.vx || 0, o.vy || 0, o.vz || 0);
        it.s0 = o.s0 ?? 1;
        it.s1 = o.s1 ?? 2;
        it.a = o.alpha ?? 1;
        it.spin = o.spin || 0;
        it.g = o.gravity || 0;
        it.drag = o.drag ?? 2;
        it.s.material.color.set(o.color || '#ffffff');
        it.s.material.rotation = o.rot || 0;
        it.s.material.opacity = it.a;
        it.s.scale.setScalar(it.s0);
        return it;
      },
      update(dt) {
        for (const it of items) {
          if (!it.s.visible) continue;
          it.life += dt;
          const k = it.life / it.max;
          if (k >= 1) {
            it.s.visible = false;
            continue;
          }
          it.v.y -= it.g * dt;
          it.v.multiplyScalar(Math.exp(-it.drag * dt));
          it.s.position.addScaledVector(it.v, dt);
          const e = 1 - Math.pow(1 - k, 3);
          it.s.scale.setScalar(it.s0 + (it.s1 - it.s0) * e);
          it.s.material.opacity = it.a * (k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4);
          it.s.material.rotation += it.spin * dt;
        }
      },
      clear() {
        for (const it of items) it.s.visible = false;
      },
    };
  }

  // Confetti: little coloured squares that pop out, tumble and fall.
  const CONFETTI = ['#ff3d7f', '#ffd400', '#18d4ff', '#2fc27a', '#b45cff', '#ff8a1f', '#ffffff'];
  function Confetti(scene, n) {
    const pos = new Float32Array(n * 3).fill(-1000);
    const col = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const life = new Float32Array(n);
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    const pts = new T.Points(geo, new T.PointsMaterial({ size: 0.26, vertexColors: true, sizeAttenuation: true }));
    pts.frustumCulled = false;
    scene.add(pts);
    const c = new T.Color();
    let next = 0;
    return {
      emit(x, y, z, count, o = {}) {
        const sp = o.speed ?? 4, up = o.up ?? 5;
        for (let k = 0; k < count; k++) {
          const i = next;
          next = (next + 1) % n;
          pos[i * 3] = x + (Math.random() - 0.5) * (o.spread ?? 0.8);
          pos[i * 3 + 1] = y + Math.random() * 0.4;
          pos[i * 3 + 2] = z + (Math.random() - 0.5) * (o.spread ?? 0.8);
          const a = Math.random() * Math.PI * 2;
          vel[i * 3] = Math.cos(a) * sp * Math.random() + (o.vx || 0);
          vel[i * 3 + 1] = up * (0.5 + Math.random() * 0.8);
          vel[i * 3 + 2] = Math.sin(a) * sp * Math.random() + (o.vz || 0);
          c.set(o.colors ? gfx.pick(o.colors) : gfx.pick(CONFETTI));
          col[i * 3] = c.r;
          col[i * 3 + 1] = c.g;
          col[i * 3 + 2] = c.b;
          life[i] = o.life || 1.4 + Math.random() * 0.6;
        }
        geo.attributes.color.needsUpdate = true;
      },
      update(dt) {
        let any = false;
        for (let i = 0; i < n; i++) {
          if (life[i] <= 0) continue;
          any = true;
          life[i] -= dt;
          if (life[i] <= 0 || pos[i * 3 + 1] < 0.05) {
            if (life[i] <= 0) pos[i * 3 + 1] = -1000;
            else {
              // landed: lie on the floor for the rest of its life
              pos[i * 3 + 1] = 0.05;
              vel[i * 3] = vel[i * 3 + 1] = vel[i * 3 + 2] = 0;
            }
            continue;
          }
          const drag = Math.exp(-1.8 * dt);
          vel[i * 3] *= drag;
          vel[i * 3 + 2] *= drag;
          vel[i * 3 + 1] = vel[i * 3 + 1] * drag - 9 * dt;
          if (vel[i * 3 + 1] < -2.2) vel[i * 3 + 1] = -2.2; // flutter down
          pos[i * 3] += vel[i * 3] * dt + Math.sin(life[i] * 9 + i) * 0.01;
          pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
          pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        }
        if (any) geo.attributes.position.needsUpdate = true;
      },
      clear() {
        life.fill(0);
        pos.fill(-1000);
        geo.attributes.position.needsUpdate = true;
      },
    };
  }

  // Glowing floor squares under the fire, so you can see exactly which cells are hot.
  function FireFloor(scene) {
    const tex = once('fireTile', () => {
      const [c, g] = gfx.makeCanvas(64, 64);
      const gr = g.createRadialGradient(32, 32, 4, 32, 32, 34);
      gr.addColorStop(0, 'rgba(255,255,220,1)');
      gr.addColorStop(0.55, 'rgba(255,200,60,0.9)');
      gr.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      return gfx.toTexture(c);
    });
    const meshes = [];
    const geoP = new T.PlaneGeometry(TILE * 1.15, TILE * 1.15);
    for (let k = 0; k < 140; k++) {
      const m = new T.Mesh(geoP, new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.renderOrder = 2;
      scene.add(m);
      meshes.push(m);
    }
    return {
      sync(M) {
        let k = 0;
        for (let c = 0; c < W * H && k < meshes.length; c++) {
          const f = M.fireT[c];
          if (f <= 0) continue;
          const m = meshes[k++];
          m.visible = true;
          m.position.set(wx(c % W), 0.06, wz((c / W) | 0));
          m.material.opacity = Math.min(1, f / 0.25);
        }
        for (; k < meshes.length; k++) meshes[k].visible = false;
      },
    };
  }

  // Faint red crosses under ticking bombs (Easy only), so little ones see where the blast will go.
  function DangerFloor(scene) {
    const meshes = [];
    const geoP = new T.PlaneGeometry(TILE * 0.9, TILE * 0.9);
    for (let k = 0; k < 160; k++) {
      const m = new T.Mesh(geoP, new T.MeshBasicMaterial({ color: '#ff3d5a', transparent: true, opacity: 0.22, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.renderOrder = 1;
      scene.add(m);
      meshes.push(m);
    }
    return {
      sync(M, on, t) {
        let k = 0;
        if (on) {
          const seen = new Set();
          for (const b of M.bombs) {
            for (const c of BT.Engine.bombCells(M, b)) {
              if (seen.has(c) || k >= meshes.length) continue;
              seen.add(c);
              const m = meshes[k++];
              m.visible = true;
              m.position.set(wx(c % W), 0.045, wz((c / W) | 0));
              m.material.opacity = 0.16 + (1 - b.fuse / b.fuseMax) * 0.22 + Math.sin(t * 10) * 0.04;
            }
          }
        }
        for (; k < meshes.length; k++) meshes[k].visible = false;
      },
    };
  }

  function shieldBubble(color) {
    const m = new T.Mesh(G('bubble', () => new T.SphereGeometry(1.25, 24, 16)), new T.MeshStandardMaterial({ color, transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.1, emissive: color, emissiveIntensity: 0.35, depthWrite: false }));
    m.renderOrder = 3;
    return m;
  }

  function dizzyStars() {
    const g = new T.Group();
    for (let k = 0; k < 3; k++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: gfx.emojiTexture('⭐'), depthWrite: false, depthTest: false }));
      s.scale.setScalar(0.45);
      s.renderOrder = 9;
      g.add(s);
    }
    g.visible = false;
    return g;
  }

  BT.Art = {
    wx, wz, TILE, buildArena, makeBomb, makeItem, makeExit, wordSprite, wordTexture, puffTexture,
    SpritePool, Confetti, FireFloor, DangerFloor, shieldBubble, dizzyStars, CONFETTI,
  };
})();
