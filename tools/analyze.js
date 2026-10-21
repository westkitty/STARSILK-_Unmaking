#!/usr/bin/env node
/**
 * Pixel + configuration analyser for STARSILK: THE UNMAKING ENGINE.
 *
 * Rebuilt here (rather than in /tmp) because /tmp is not persistent.
 *
 * Two jobs:
 *   1. Scene statistics — brightness, coverage and per-system luminance at each
 *      stage of play, so a visual regression shows up as a number rather than
 *      as a vibe.
 *   2. Config matrix   — boots the app at several viewport / DPR /
 *      reduced-motion combinations and asserts no runtime errors.
 *
 * Usage:  node tools/analyze.js [--matrix-only] [--baseline file.json]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { boot } = require('./harness.js');

const OUT = process.env.OUT || '';

// ------------------------------------------------------------------ pixel helpers
function stats(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  let sum = 0, bright = 0;
  const n = w * h, hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    sum += l; hist[Math.min(255, l | 0)]++;
    if (l > 60) bright++;
  }
  const mean = sum / n;
  let vsum = 0;
  for (let v = 0; v < 256; v++) if (hist[v]) vsum += hist[v] * (v - mean) * (v - mean);
  return {
    mean: +mean.toFixed(2),
    std: +Math.sqrt(vsum / n).toFixed(2),
    brightPct: +(100 * bright / n).toFixed(2)
  };
}

function lumAt(ctx, x, y) {
  const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  return +(0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]).toFixed(1);
}

// Mean colour of an annulus around a point — used to read a star's true colour,
// since the very centre is usually blown out to white by the bloom.
function meanAnnulus(ctx, cx, cy, r0, r1, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  let R = 0, G = 0, B = 0, n = 0;
  for (let y = Math.max(0, cy - r1); y < Math.min(h, cy + r1); y++)
    for (let x = Math.max(0, cx - r1); x < Math.min(w, cx + r1); x++) {
      const dd = Math.hypot(x - cx, y - cy);
      if (dd < r0 || dd >= r1) continue;
      const i = (y * w + x) * 4; R += d[i]; G += d[i + 1]; B += d[i + 2]; n++;
    }
  return n ? [Math.round(R / n), Math.round(G / n), Math.round(B / n)] : [0, 0, 0];
}

// ------------------------------------------------------------------ scene pass
function analyseScenes() {
  const W = 1200, H = 800;
  const { window: win, shot, settle, errs } = boot({ W, H, DPR: 1, OUT });
  const S = win.__DBG.Sim;
  const el = win.document.getElementById('stage');
  const ctx = el.__napi.getContext('2d');

  const results = {};
  function row(key, label, extra) {
    const st = stats(ctx, W, H);
    results[key] = st;
    console.log(`  ${label.padEnd(17)} mean=${String(st.mean).padStart(6)} std=${String(st.std).padStart(6)}`
      + ` bright=${String(st.brightPct).padStart(6)}%   ${extra || ''}`);
  }

  console.log('SCENE STATISTICS  (viewport 1200x800 @dpr1)\n');

  S.reset(); shot('01_initial', 6);
  let n1 = S.nodes.get('sys1');
  row('initial', 'initial', `sys1 core=${lumAt(ctx, n1.x, n1.y)} halo=${lumAt(ctx, n1.x + 45, n1.y)}`);

  // grip without crossing the threshold
  const Inp = win.__DBG.Input;
  n1.state = 'GRIPPED'; n1.gripProgress = 0.87; n1.angleOffset = 2.4;
  Inp.active = true; Inp.nodeId = 'sys1'; Inp.kind = 'star';
  Inp.start = { x: n1.x, y: n1.y }; Inp.anchor = { x: n1.x, y: n1.y };
  Inp.cur = { x: n1.x + 130, y: n1.y - 40 }; Inp.pull = { x: 130, y: -40 };
  Inp.thresholdMet = false;
  shot('02_gripped', 3);
  row('gripped', 'gripped', `sys1 core=${lumAt(ctx, n1.x, n1.y)}`);

  Inp.active = false; n1.state = 'INTACT'; n1.gripProgress = 0; n1.angleOffset = 0;
  S.commitCollapse('sys1', 'direct', null);
  shot('03_collapsing', 12);
  row('collapsing', 'collapsing', `sys1 core=${lumAt(ctx, n1.x, n1.y)}`);

  settle(); shot('04_absence_one', 6);
  row('absence_one', 'sys1 absence', `core=${lumAt(ctx, n1.x, n1.y)} (dark ⇒ light eaten)`);

  ['sys2', 'sys3', 'sys4', 'sys5'].forEach(id => S.commitCollapse(id, 'direct', null));
  settle(); shot('05_all_absence', 6);
  const c = S.counters();
  row('all_absence', 'all absence', `direct=${c.direct} chain=${c.chain} planetsLost=${c.planetsLost} moonsLost=${c.moonsLost} intact=${c.intact}`);

  S.reset(); shot('06_after_reset', 6);
  // reset() rebuilds the node objects, so re-fetch rather than using the old ref
  const r1 = S.nodes.get('sys1');
  row('after_reset', 'after reset', `sys1 core=${lumAt(ctx, r1.x, r1.y)}`);

  // per-system identity
  console.log('\nSYSTEM IDENTITY  (photosphere colour, annulus r=12..24)');
  const cols = [];
  S.nodes.forEach(n => {
    const rgb = meanAnnulus(ctx, Math.round(n.x), Math.round(n.y), 12, 24, W, H);
    cols.push(rgb);
    console.log(`  ${n.id}  hue=${String(n.hue).padStart(3)} sat=${String(n.sat).padStart(2)}  rgb(${rgb[0]},${rgb[1]},${rgb[2]})`);
  });
  let min = Infinity, max = 0;
  for (let i = 0; i < cols.length; i++)
    for (let j = i + 1; j < cols.length; j++) {
      const d = Math.hypot(cols[i][0] - cols[j][0], cols[i][1] - cols[j][1], cols[i][2] - cols[j][2]);
      min = Math.min(min, d); max = Math.max(max, d);
    }
  console.log(`  closest pair=${min.toFixed(1)}  furthest pair=${max.toFixed(1)}  (higher ⇒ more distinct)`);
  results._identity = { closestPair: +min.toFixed(1), furthestPair: +max.toFixed(1) };

  console.log('\n  errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  return { errs, results };
}

// ------------------------------------------------------------------ config matrix
function runMatrix() {
  console.log('\nCONFIGURATION MATRIX\n');
  const cases = [
    [1200, 800, 1, 0, 'desktop dpr1'],
    [1200, 800, 2, 0, 'desktop dpr2'],
    [1200, 800, 3, 0, 'desktop dpr3'],
    [ 390, 844, 2, 0, 'mobile portrait'],
    [1200, 800, 1, 1, 'reduced motion']
  ];
  let bad = 0;
  for (const [w, h, dpr, rm, label] of cases) {
    let inst, errs = [];
    try {
      inst = boot({ W: w, H: h, DPR: dpr, REDUCED_MOTION: !!rm });
      inst.shot('m', 4);
      errs = inst.errs;
    } catch (e) {
      errs = ['threw: ' + e.message];
    }
    const ok = errs.length === 0;
    if (!ok) bad++;
    let geom = '';
    if (inst) {
      const el = inst.window.document.getElementById('stage');
      geom = `backing=${el.width}x${el.height} css=${el.style.width}x${el.style.height}`;
    }
    console.log(`  ${label.padEnd(16)} viewport=${String(w + 'x' + h).padEnd(8)} dpr=${dpr}  `
      + `${geom.padEnd(34)} ${ok ? '✓' : '✗ ' + errs.join(' | ')}`);
  }
  console.log(bad ? `\n  ${bad} configuration(s) errored` : '\n  all configurations clean');
  return bad;
}

// ------------------------------------------------------------------ main
const onlyMatrix = process.argv.includes('--matrix-only');
let errs = [], results = null;
if (!onlyMatrix) ({ errs, results } = analyseScenes());
const bad = runMatrix();

if (results) {
  const p = path.join(__dirname, 'baseline.json');
  fs.writeFileSync(p, JSON.stringify(results, null, 2));
  console.log(`\nwrote ${path.relative(process.cwd(), p)}`);
}

process.exit(bad || errs.length ? 1 : 0);
