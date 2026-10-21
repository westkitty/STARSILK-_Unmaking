#!/usr/bin/env node
/**
 * Frame-time profiler for STARSILK: THE UNMAKING ENGINE.
 *
 * Measures the cost of a rendered frame in a few representative states. Runs on
 * a software rasteriser (@napi-rs/canvas) under jsdom, so the absolute numbers
 * are NOT what a GPU-backed browser will do — treat them as RELATIVE only, and
 * always compare against a measurement taken on the same machine.
 *
 * Usage:  node tools/perf.js [--compare <file.json>] [--html <path>]
 */
'use strict';
const fs = require('fs');
const { boot } = require('./harness.js');

const W = 1200, H = 800;

function timeFrames(window, n) {
  // warm up so JIT/gradient caches are populated before we start measuring
  for (let i = 0; i < 10; i++) window.__step(16.7);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) window.__step(16.7);
  const t1 = process.hrtime.bigint();
  return Number(t1 - t0) / 1e6 / n;   // ms per frame
}

function measure(label, opts, scene) {
  const inst = boot(Object.assign({ W, H, DPR: 1 }, opts));
  const { window, shot, settle } = inst;
  const S = window.__DBG.Sim;
  S.reset(); shot('p', 3);
  scene(S, window, shot, settle);
  const ms = timeFrames(window, 120);
  const errs = inst.errs.length;
  console.log(`  ${label.padEnd(34)} ${ms.toFixed(2)} ms/frame${errs ? '  ✗ ' + errs + ' error(s)' : ''}`);
  return { label, ms: +ms.toFixed(2), errs };
}

function main() {
  console.log(`FRAME PROFILE  (${W}x${H} @dpr1, software rasteriser — relative only)\n`);
  const out = [];

  out.push(measure('idle (5 intact systems)', {}, (S, w, shot) => { shot('p', 4); }));

  out.push(measure('one system collapsed', {}, (S, w, shot, settle) => {
    S.commitCollapse("sys1", "direct", null); w.__step(300); settle(); shot('p', 4);
  }));

  out.push(measure('all absent + particle burst', {}, (S, w, shot, settle) => {
    ['sys1','sys2','sys3','sys4','sys5'].forEach(id => S.commitCollapse(id, 'direct', null));
    w.__step(300); settle(); shot("p", 4);
  }));

  out.push(measure('all absent, mid-burst (particles live)', {}, (S, w, shot) => {
    ['sys1','sys2','sys3','sys4','sys5'].forEach(id => S.commitCollapse(id, 'direct', null));
    // step just past collapseTime so the burst is actually on screen
    for (let i = 0; i < 60; i++) w.__step(16.7);
  }));

  out.push(measure('reduced motion', { REDUCED_MOTION: true }, (S, w, shot) => { shot('p', 4); }));

  // particle pool behaviour
  const inst = boot({ W, H, DPR: 1 });
  const S = inst.window.__DBG.Sim, P = inst.window.__DBG.Particles;
  let peak = 0;
  ['sys1','sys2','sys3','sys4','sys5'].forEach(id => S.commitCollapse(id, 'direct', null));
  const liveCount = () => (typeof P.activeCount === 'function' ? P.activeCount() : P.activeCount) || 0;
  for (let i = 0; i < 120; i++) { inst.window.__step(16.7); peak = Math.max(peak, liveCount()); }
  console.log(`\n  peak active particles: ${peak}`);

  const p = 'tools/perf-baseline.json';
  const compareIdx = process.argv.indexOf('--compare');
  if (compareIdx > -1 && process.argv[compareIdx + 1]) {
    const old = JSON.parse(fs.readFileSync(process.argv[compareIdx + 1], 'utf8'));
    console.log('\nCOMPARISON vs ' + process.argv[compareIdx + 1]);
    old.forEach((o, i) => {
      const nw = out[i];
      if (!nw) return;
      const d = nw.ms - o.ms, pct = o.ms ? (100 * d / o.ms) : 0;
      const sign = d > 0 ? '+' : '';
      console.log(`  ${o.label.padEnd(34)} ${o.ms.toFixed(2)} -> ${nw.ms.toFixed(2)} ms  ${sign}${pct.toFixed(1)}%`
        + (d <= 0 ? '  (faster)' : '  (slower)'));
    });
  } else {
    fs.writeFileSync(p, JSON.stringify(out, null, 2));
    console.log(`\nwrote ${p}  (pass --compare ${p} after a change to diff)`);
  }
}

main();
