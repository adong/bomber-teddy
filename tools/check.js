#!/usr/bin/env node
/* Runs the headless checks in Node (no browser, no npm):  node tools/check.js [seeds] [--soak]
   Loads the kit roster and the game's own engine files into a sandbox with a fake `window`. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Date };
ctx.window = ctx;
ctx.Kit = {};
vm.createContext(ctx);
for (const f of ['kit/roster.js', 'js/config.js', 'js/levels.js', 'js/engine.js', 'js/brain.js', 'js/check.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const BT = ctx.BT;
const args = process.argv.slice(2);
const seeds = Number(args.find((a) => /^\d+$/.test(a))) || 200;

const all = BT.Check.checkAll({ seeds });
console.log(`stage check: ${all.levels} generated arenas, ${all.failed} with problems`);
for (const f of all.fails) console.log('  FAIL', f.mode, 'stage', f.stage, f.diff, 'seed', f.seed, '-', f.probs.join('; '));

const sab = BT.Check.sabotage();
console.log(`sabotage: ${sab.filter((s) => s.caught).length} of ${sab.length} broken levels caught`);
for (const s of sab) console.log(`  ${s.caught ? 'caught' : 'MISSED'}: ${s.name}${s.caught ? ' (' + s.probs[0] + ')' : ''}`);

// --soak: the autopilot plays all 12 stages; --soak-seeds N repeats that on N different layouts per stage
const soakSeeds = Number((args.find((a) => a.startsWith('--soak-seeds=')) || '').split('=')[1]) || 1;
if (args.includes('--soak')) {
  for (const diff of ['easy', 'normal']) {
    for (const mode of ['adventure', 'coop']) {
      const t0 = Date.now();
      let cleared = 0, runs = 0, caught = 0, traps = 0;
      const fails = [];
      for (let seed = 1; seed <= soakSeeds; seed++) {
        const r = BT.Check.soak({ diff, mode, seed, buddyEvery: args.includes('--buddy') ? 15 : 0 });
        cleared += r.cleared;
        runs += r.of;
        for (const s of r.results) {
          if (s.result !== 'clear') fails.push(`seed ${seed} stage ${s.stage} ${s.result}`);
          caught += s.caught;
          traps += s.spawnTrap;
        }
        if (soakSeeds === 1) for (const s of r.results) console.log(`  ${String(s.stage).padStart(2)} ${s.name.padEnd(14)} ${s.result.padEnd(7)} ${String(s.time).padStart(4)} s  caught ${s.caught}  pops ${s.pops}  bombs ${s.bombs}  buddy bombs ${s.buddyBombs} buddy pops ${s.buddyPops} saves ${s.saves}`);
      }
      console.log(`soak ${mode} ${diff}: cleared ${cleared}/${runs} stages, caught ${caught} times, ${traps} of them right after a respawn near the start (${((Date.now() - t0) / 1000).toFixed(1)} s)${fails.length ? ' NOT CLEARED: ' + fails.join(', ') : ''}`);
    }
  }
}
if (args.includes('--soak')) {
  for (const diff of ['easy', 'normal']) {
    const b = BT.Check.battleSoak(60, diff);
    console.log(`battle ${diff}: ${b.rounds} CPU-vs-CPU rounds, ${b.ko} KOs (Teddy ${b.wins[0]}, Tommy ${b.wins[1]}), ${b.draw} draws, ${b.time} time-outs, ${b.stuck} stuck, longest ${b.longest} s, ${b.buddyVisits} companion visits, ${b.saves} saves`);
  }
}
process.exitCode = all.failed || sab.some((s) => !s.caught) ? 1 : 0;
