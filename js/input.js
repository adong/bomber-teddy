/* Controls: the keyboard for one or two players, and a d-pad plus buttons for touch.
   P1: WASD move, Space / F bomb, T call your brother.  P2: arrows move, L bomb, Enter call your brother.
   In 1-player modes both sets drive player 1. The most recently pressed direction wins, like an arcade stick.
   Bomb and companion presses are latched until the game reads them, so a quick tap always counts.
   Exposes BT.Input. */
(function () {
  'use strict';

  const KEYS = {
    KeyW: [0, 'up'], KeyS: [0, 'down'], KeyA: [0, 'left'], KeyD: [0, 'right'],
    Space: [0, 'bomb'], KeyF: [0, 'bomb'], KeyT: [0, 'buddy'],
    ArrowUp: [1, 'up'], ArrowDown: [1, 'down'], ArrowLeft: [1, 'left'], ArrowRight: [1, 'right'],
    KeyL: [1, 'bomb'], Slash: [1, 'bomb'], Numpad0: [1, 'bomb'], Enter: [1, 'buddy'], NumpadEnter: [1, 'buddy'],
  };
  const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  // per key set: directions in the order they were pressed, plus latched presses
  const sets = [{ dirs: [], bomb: false, buddy: false }, { dirs: [], bomb: false, buddy: false }];
  const touch = [{ dir: null, bomb: false, buddy: false }, { dir: null, bomb: false, buddy: false }];
  let twoPlayer = false;

  function key(code, down, repeat) {
    const m = KEYS[code];
    if (!m) return false;
    const [side, act] = m;
    const s = sets[side];
    if (VEC[act]) {
      s.dirs = s.dirs.filter((d) => d !== act);
      if (down) s.dirs.push(act);
    } else if (down && !repeat) s[act] = true;
    return true;
  }

  function read(i) {
    const out = { dx: 0, dy: 0, bomb: false, buddy: false };
    const srcs = twoPlayer ? [i] : i === 0 ? [0, 1] : [];
    let dir = null;
    for (const k of srcs) {
      const s = sets[k];
      if (s.dirs.length) dir = s.dirs[s.dirs.length - 1];
      if (s.bomb) out.bomb = true;
      if (s.buddy) out.buddy = true;
      s.bomb = s.buddy = false;
    }
    const t = touch[i];
    if (t.dir) dir = t.dir;
    if (t.bomb) out.bomb = true;
    if (t.buddy) out.buddy = true;
    t.bomb = t.buddy = false;
    if (dir) [out.dx, out.dy] = VEC[dir];
    return out;
  }

  function clear() {
    for (const s of sets) {
      s.dirs = [];
      s.bomb = s.buddy = false;
    }
    for (const t of touch) {
      t.dir = null;
      t.bomb = t.buddy = false;
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (key(e.code, true, e.repeat) && (e.code.startsWith('Arrow') || e.code === 'Space')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => key(e.code, false, false));
  window.addEventListener('blur', clear);

  // ---------------------------------------------------------------- touch
  const capture = (el, e) => {
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events have no active pointer */ }
  };

  // A round d-pad: slide your thumb around it. Four ways only, picked by whichever axis you lean on most.
  function bindPad(i, pad) {
    let finger = null;
    const zone = (e) => {
      const r = pad.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      let dir = null;
      if (Math.hypot(dx, dy) > 0.22) dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      touch[i].dir = dir;
      pad.dataset.dir = dir || '';
    };
    const release = (e) => {
      if (e.pointerId !== finger) return;
      finger = null;
      touch[i].dir = null;
      pad.dataset.dir = '';
    };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      finger = e.pointerId;
      capture(pad, e);
      zone(e);
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId === finger) zone(e);
    });
    pad.addEventListener('pointerup', release);
    pad.addEventListener('pointercancel', release);
  }

  function bindButton(i, el, act, onPress) {
    const up = () => el.classList.remove('down');
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      capture(el, e);
      el.classList.add('down');
      if (onPress) onPress();
      else touch[i][act] = true;
    });
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  BT.Input = {
    read, clear, bindPad, bindButton, KEYS,
    setTwoPlayer(on) { twoPlayer = !!on; },
    held(i) { return sets[i].dirs.length > 0 || !!touch[i].dir; },
  };
})();
