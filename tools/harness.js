/* Deterministic headless render harness for The Unmaking Engine.
 *
 * Loads index.html in jsdom, backs HTMLCanvasElement.getContext with
 * @napi-rs/canvas (real pixels), and drives the app through a manually pumped
 * requestAnimationFrame with a seeded PRNG — so frames are deterministic and
 * directly comparable between runs.
 *
 * Requires: npm install jsdom @napi-rs/canvas   (see tools/README.md)
 *
 * Exports:
 *   boot(opts)  -> a fresh { window, shot, settle, errs, el, W, H }
 *                  opts: { W, H, DPR, REDUCED_MOTION, OUT }
 *   window, shot, settle, errs, OUT, W, H
 *                  the default instance, configured from env vars
 *
 * Env: HTML, OUT, VW, VH, DPR, REDUCED_MOTION
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('/tmp/vis/node_modules/jsdom');
const { createCanvas } = require('/tmp/vis/node_modules/@napi-rs/canvas');

const HTML_PATH = process.env.HTML || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

function boot(opts = {}) {
  const W = +(opts.W || 1200), H = +(opts.H || 800);
  const DPR = +(opts.DPR || 1);
  const REDUCED_MOTION = !!(opts.REDUCED_MOTION);
  const OUT = opts.OUT || '';

  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    pretendToBeVisual: false,
    runScripts: 'dangerously',
    beforeParse(window) {
      Object.defineProperty(window, 'innerWidth',  { value: W, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: H, configurable: true });
      Object.defineProperty(window, 'devicePixelRatio', { value: DPR, configurable: true });

      if (REDUCED_MOTION) {
        window.matchMedia = (q) => ({
          matches: /prefers-reduced-motion/.test(q), media: q,
          addEventListener() {}, removeEventListener() {},
          addListener() {}, removeListener() {}
        });
      }

      // seeded PRNG -> deterministic, comparable captures
      let seed = 20261021;
      window.Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

      // manual rAF pump
      let pending = [], now = 0;
      window.__step = (dt) => { now += dt; const cbs = pending; pending = []; cbs.forEach(cb => cb(now)); };
      window.requestAnimationFrame = (cb) => { pending.push(cb); return pending.length; };
      window.cancelAnimationFrame = () => {};
      Object.defineProperty(window, 'performance', { value: { now: () => now }, writable: true, configurable: true });

      // canvas backed by @napi-rs/canvas
      const map = new WeakMap();
      const P = window.HTMLCanvasElement.prototype;
      Object.defineProperty(P, 'width',  { configurable: true,
        get() { return this.__w ?? 300; },
        set(v) { this.__w = v; const c = map.get(this); if (c && c.width !== v) c.width = v; } });
      Object.defineProperty(P, 'height', { configurable: true,
        get() { return this.__h ?? 150; },
        set(v) { this.__h = v; const c = map.get(this); if (c && c.height !== v) c.height = v; } });
      P.getContext = function () {
        let c = map.get(this);
        if (!c) { c = createCanvas(this.__w || 300, this.__h || 150); map.set(this, c); }
        this.__napi = c;
        const cx = c.getContext('2d');
        if (!cx.__patched) {
          // In a real browser drawImage() accepts any HTMLCanvasElement; here we
          // must unwrap the jsdom element to its backing @napi-rs canvas.
          cx.__patched = true;
          const orig = cx.drawImage.bind(cx);
          cx.drawImage = function (img, ...rest) {
            return orig((img && img.__napi) ? img.__napi : img, ...rest);
          };
        }
        return cx;
      };

      window.__capture = () => {
        const el = window.document.getElementById('stage');
        const c = el.__napi;
        try { return c.toBuffer('image/png'); } catch (e) { return Buffer.from(c.encodeSync('png')); }
      };
    }
  });

  const window = dom.window;
  const errs = [];
  window.addEventListener('error', e => errs.push(String(e.message || e)));

  // Some builds start their own rAF loop; give it a chance to register.
  window.__step(0);

  if (OUT) fs.mkdirSync(OUT, { recursive: true });

  function shot(name, steps = 4, dt = 16.7) {
    for (let i = 0; i < steps; i++) window.__step(dt);
    if (OUT) fs.writeFileSync(`${OUT}/${name}.png`, window.__capture());
    return `${OUT}/${name}.png`;
  }

  // Advance the simulation until nothing is mid-collapse and no chains are
  // pending. Chains fire on a 0.7-1.9s delay and hit-stop deliberately slows
  // time right after a collapse, so a single big update() no longer suffices.
  function settle(maxSteps = 200) {
    const S = window.__DBG.Sim;
    for (let i = 0; i < maxSteps; i++) {
      let busy = !!(S.pendingChains && S.pendingChains.length > 0);   // field predates the undo work
      if (!busy) S.nodes.forEach(n => { if (n.state === 'COLLAPSING') busy = true; });
      if (!busy) return true;
      S.update(0.1);
    }
    return false;
  }

  return { window, shot, settle, errs, OUT, W, H };
}

// ------------------------------------------------------------------ default instance
const OUT = process.env.OUT || path.join(__dirname, 'shots');
const W = +(process.env.VW || 1200), H = +(process.env.VH || 800);
if (process.env.OUT || process.env.SHOTS) fs.mkdirSync(OUT, { recursive: true });

const _default = boot({
  W, H,
  DPR: +(process.env.DPR || 1),
  REDUCED_MOTION: process.env.REDUCED_MOTION === '1',
  OUT: (process.env.OUT || process.env.SHOTS) ? OUT : ''
});

const window = _default.window;
const shot = _default.shot;
const settle = _default.settle;
const errs = _default.errs;

module.exports = { boot, window, shot, settle, errs, OUT, W, H };

if (require.main === module) {
  const S = window.__DBG.Sim;
  const Inp = window.__DBG.Input;
  const el = window.document.getElementById('stage');

  shot('01_initial', 6);

  // Grip the filament hard, but not past the threshold.
  const n1 = S.nodes.get('sys1');
  n1.state = 'GRIPPED'; n1.gripProgress = 0.87; n1.angleOffset = 2.4;
  Inp.active = true; Inp.nodeId = 'sys1'; Inp.kind = 'star';
  Inp.start = { x: n1.x, y: n1.y }; Inp.anchor = { x: n1.x, y: n1.y };
  Inp.cur = { x: n1.x + 130, y: n1.y - 40 }; Inp.pull = { x: 130, y: -40 };
  Inp.thresholdMet = false;
  shot('02_gripped', 3);

  Inp.active = false;
  S.commitCollapse('sys1', 'direct', null);
  window.__step(300);
  shot('03_collapsing', 1);
  settle(); shot('04_absence_one', 3);

  ['sys2','sys3','sys4','sys5'].forEach(id => { S.commitCollapse(id, 'direct', null); });
  settle(); shot('05_all_absence', 6);
  const destroyed = JSON.stringify(S.counters());

  S.reset(); shot('06_after_reset', 6);

  console.log('errors:', errs.length ? errs : 'none');
  console.log('counters after all-destroyed:', destroyed);
  console.log('counters after reset:', JSON.stringify(S.counters()));
  console.log(`viewport=${W}x${H} dpr=${window.devicePixelRatio} backing=${el.width}x${el.height} css=${el.style.width}x${el.style.height}`);
}
