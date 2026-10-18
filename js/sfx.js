/* Game sounds, synthesised on top of Kit.sound.tone / hiss (so mute and volume are shared with the kit).
   Kit.sound already has powerup, click, punch, swish, jump and land; the rest are here. Exposes BT.sfx. */
(function () {
  'use strict';
  const S = () => window.Kit.sound;

  BT.sfx = {
    // a bomb set down, with a little sizzle
    drop() {
      S().tone({ f: 330, to: 160, dur: 0.1, vol: 0.22 });
      S().hiss({ filter: 'highpass', f: 4000, to: 6000, dur: 0.35, vol: 0.05, at: 0.05 });
    },
    // the blast: a soft cartoon "pooof" and a confetti tinkle, not a bang
    boom(big) {
      S().hiss({ filter: 'lowpass', f: 1800, to: 180, dur: 0.55, vol: big ? 0.45 : 0.36, attack: 0.005 });
      S().tone({ type: 'sine', f: 140, to: 48, dur: 0.35, vol: 0.4 });
      [1568, 2093, 1760].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.12, vol: 0.05, at: 0.08 + i * 0.05 }));
    },
    crate() {
      S().tone({ type: 'square', f: 300, to: 140, dur: 0.12, vol: 0.05, lp: 1400 });
      S().hiss({ f: 1400, to: 600, q: 1.5, dur: 0.18, vol: 0.12 });
    },
    // a baddie pops into stars
    pop() {
      S().tone({ type: 'sine', f: 520, to: 1500, dur: 0.12, vol: 0.2 });
      [1319, 1760, 2093].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.1, vol: 0.07, at: 0.1 + i * 0.06 }));
    },
    item() { [880, 1175].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.1, vol: 0.09, at: i * 0.07 })); },
    pickup() { S().powerup(); },
    // OOPS: a slide whistle down and a boing
    oops() {
      S().tone({ type: 'sine', f: 1100, to: 280, dur: 0.55, vol: 0.14 });
      S().tone({ type: 'sine', f: 180, to: 520, dur: 0.18, vol: 0.12, at: 0.55 });
    },
    kick() {
      S().tone({ f: 220, to: 110, dur: 0.1, vol: 0.3 });
      S().hiss({ f: 1600, to: 700, q: 1.4, dur: 0.18, vol: 0.12 });
    },
    thud() { S().tone({ f: 120, to: 70, dur: 0.1, vol: 0.2 }); },
    fizzle() { S().hiss({ filter: 'highpass', f: 3000, to: 1200, dur: 0.4, vol: 0.08 }); },
    exit() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.16, vol: 0.1, at: i * 0.07 })); },
    exitShown() { [784, 988].forEach((f, i) => S().tone({ type: 'sine', f, dur: 0.18, vol: 0.1, at: i * 0.1 })); },
    // the companion: a run-in fanfare, a shield "ding" when he saves you, a no-no when he's resting
    buddy() {
      [659, 784, 988].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.14, vol: 0.12, at: i * 0.07 }));
      S().hiss({ f: 1200, to: 3000, dur: 0.25, vol: 0.06 });
    },
    bye() { [988, 784, 659].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.12, vol: 0.08, at: i * 0.07 })); },
    saved() {
      S().tone({ type: 'sine', f: 1318, dur: 0.5, vol: 0.14 });
      S().tone({ type: 'sine', f: 1976, dur: 0.4, vol: 0.06, at: 0.02 });
      S().hiss({ filter: 'highpass', f: 5000, dur: 0.3, vol: 0.06 });
    },
    nope() { S().tone({ type: 'square', f: 200, to: 160, dur: 0.12, vol: 0.05, lp: 1200 }); },
    treat() { [1047, 1319, 1568].forEach((f, i) => S().tone({ type: 'sine', f, dur: 0.12, vol: 0.1, at: i * 0.06 })); },
    swish() { S().swish(); },
    jump() { S().jump(); },
    click() { S().click(); },
    go() {
      S().bump();
      [523, 659, 784, 1047].forEach((f, i) => S().tone({ type: 'square', f, dur: 0.12, vol: 0.06, lp: 2600, at: i * 0.06 }));
    },
    ready() { [392, 523].forEach((f, i) => S().tone({ type: 'square', f, dur: 0.18, vol: 0.06, lp: 2200, at: i * 0.14 })); },
    fanfare() {
      [[523, 0], [659, 0.15], [784, 0.3], [1047, 0.45], [784, 0.65], [1047, 0.8]].forEach(([f, at]) => {
        S().tone({ type: 'square', f, dur: 0.22, vol: 0.06, lp: 2600, at });
        S().tone({ type: 'triangle', f: f / 2, dur: 0.25, vol: 0.1, at });
      });
    },
    sad() { [392, 349, 330, 262].forEach((f, i) => S().tone({ type: 'triangle', f, dur: 0.25, vol: 0.09, at: i * 0.2 })); },
    tick() { S().tone({ type: 'square', f: 1200, dur: 0.04, vol: 0.03 }); },
  };
})();
