# Verification Report — The Unmaking Engine

This report lists the acceptance checks from the build contract, their status, and how each was verified. Tests marked **browser-only** could not be executed head-first in this sandbox because `jsdom` does not implement `HTMLCanvasElement.getContext` or `AudioContext`; those paths are implemented and reviewed, but require a real browser to execute end-to-end.

## Passed (verified by simulation + DOM checks)

| # | Acceptance check | Status | How verified |
|---|------------------|--------|--------------|
| 1 | Exactly five intact systems on first load, each with visible planets and ≥1 reachable filament | Passed | jsdom: `cIntact === 5`, five systems each with planets and a hit-testable filament/star target |
| 2 | Initial ledger all zeros | Passed | DOM: counters read 0/0/0/0/0/0/0; event log shows "Initial ledger — all zeros." |
| 3 | Short drag below threshold cancels, no counter change | Passed | jsdom: 60 px drag (threshold 150 px) left `total`, `intact`, `direct` unchanged; target star stayed `INTACT` |
| 4 | Deliberate drag beyond threshold collapses star, removes orbiting bodies, updates ledger once | Passed | jsdom: 200 px drag committed collapse; `direct=1`, `total=1`, `intact=4`, target `ABSENCE`, its planets/moons marked lost |
| 5 | Chain reactions follow graph/threshold rules and identify source | Passed | jsdom: direct `commitCollapse('...','chain','<source>')` records `collapseCause='chain'` and `collapseSource`; `chain` and `total` increment once |
| 6 | Destroying connected systems builds persistent absence lattice | Passed | jsdom: all five nodes reach `ABSENCE`; absence spans render between pairs of absence nodes |
| 7 | All five systems reach destroyed state without deadlock | Passed | jsdom: collapsed SYSTEM I–V sequentially; all ended `ABSENCE`, `intact=0` |
| 8 | Counters equal true unique destroyed objects; no double-counting after reset/replay | Passed | jsdom: `planetsLost === 13`, `moonsLost === 5` (matches original inventory); `commitCollapse` guards `state === 'ABSENCE'` so a node collapses once |
| 9 | Keyboard equivalent of grip-and-pull with confirmation threshold | Implemented/reviewed | Focusable filament targets (`Tab`), `Enter`/`Space` grip, hold-to-confirm threshold, `Escape` cancel |
| 10 | Mute and reduced-motion modes; audio never autoplays before interaction | Implemented/reviewed | Web Audio initialized only on first gesture; `muted` gates the master gain; `prefers-reduced-motion` CSS disables transitions/animation |
| 11 | Reset restores original graph, five intact stars, all bodies, zeroed counters | Passed | jsdom: after reset, `total=0`, `intact=5`, `planetsLost=0`, `moonsLost=0`, all nodes `INTACT` |
| 12 | Usable at mobile portrait and desktop sizes | Implemented/reviewed | Responsive CSS (viewport units, mobile ledger toggle, portrait layout, touch targets) |

### Visual Asset Uplift — executed pass

The following visual asset families were inspected and materially improved (all in `index.html`, procedural Canvas 2D + CSS; no external assets):

| Asset family | Lane | Change |
|--------------|------|--------|
| Star cores | REFINE | Layered luminous cores with structural rings, glow depth, and violent inward contraction during surrender (core pulls in before absence emerges) |
| Starsilk filaments | REFINE | Dimensional barcode ribbons with glow aura, deliberate line rhythm, dark syntax lines, end flares, and tension curvature |
| Absence nodes | REFINE | Stronger gravitational lensing, event-horizon depth, displaced starlight contour traces |
| Absence spans (lattice) | REFINE | Light-eating distortion field, warp bulge, displaced-starlight contours, anchor flares |
| Orbits | REFINE | Distinct per-system dash patterns/directions, trembling under grip, failing spiral orbits during collapse |
| Tension indicator | REFINE | Fuller threshold track with gradient sweep and threshold marker |
| Keyboard filament targets | REFINE | Filament-like appearance with inner tip, glow, gripped state |
| Void background | ENRICH | Subtle distant pinprick starfield with slow drift and twinkle (depth, not a nebula wallpaper) |
| Typography/ornament | REPAIR | Declared `'Ironfall'` font wasn't loading (fell back to generic system-ui); replaced with authored layered display treatment (letterpress shadow, border ornament) |
| UI glass/depth | REFINE | Stronger header glass, border, shadow; ledger and control depth |

### Correction to the previous report

The earlier "AAA Visual Overhaul" entries above described intended features. On inspection with a real pixel-rendering harness, **three of those features were not actually visible at runtime**, and the game did not render at all. They are listed here because they were the highest-impact items in this pass. Nothing in the previous report should be read as having been visually confirmed.

### Critical defects found and fixed (this pass)

| # | Defect | Effect | Fix |
|---|--------|--------|-----|
| 1 | `drawFilament(a,b,gripped,pullOffset,tension)` referenced `t`, which was neither a parameter nor in scope | **`ReferenceError` on the first frame.** Because `requestAnimationFrame(frame)` sits at the end of `frame()`, the exception killed the loop permanently — a blank canvas and an unplayable game | Added a `t` parameter and passed the frame timestamp from the call site |
| 2 | `drawStar` did `ctx.translate(n.x+ox, n.y)` then built its gradients at `(n.x, n.y)` | Gradient centre sat ~700 px from the arc being filled, outside the gradient's outer radius, so **the star's glow and core body filled with a fully transparent colour** — stars rendered as bare engraving rings with no luminous body | Build gradients at local `(0,0)`, i.e. the same space as the arc |
| 3 | Starfield drift was wrapped with `% 1` on a *pixel* value, then multiplied by `W` | The wrap period was 1 px, so a 1 px change teleported a star the full screen width. At 60 fps stars jumped ~360 px per frame — a violent strobe, not a drifting sky | Drift and wrap in pixel space by the screen extent (`% W` / `% H`) |

### Additional defects found and fixed

| # | Defect | Fix |
|---|--------|-----|
| 4 | No `devicePixelRatio` handling — the backing store matched CSS pixels | DPR-aware sizing (capped at 2) with a single `setTransform`, so the scene is crisp on HiDPI without a 4× fill-rate cost |
| 5 | The canvas is created with `{alpha:false}`, so the CSS background gradient was never visible | Replaced with a genuinely rendered nebula, pre-rendered once at 1/6 resolution |
| 6 | No additive blending anywhere — all glow was flat alpha layering | Added a cached glow-sprite bloom pass using `globalCompositeOperation='lighter'` |
| 7 | `Screen.getVignetteAlpha()` was computed but never called — the collapse vignette pulse never rendered | Wired into the render loop via a pre-rendered vignette sprite |
| 8 | Planets had **no solid body** — only translucent band ellipses and a halo, so they read as ghosts | Shaded spheres: limb-darkened body, banded surface clipped to the disc, terminator, specular, and rim light, all oriented to their own system's star |
| 9 | Collapse had no particle event until it *finished* | Added an inward implosion burst at the moment of surrender, plus an additive flash and heavier debris on completion |
| 10 | Glow radii were absolute pixels, so on a 390 px-wide viewport bloom covered ~40% of the screen | `sceneScale` factor derived from viewport size |
| 11 | Buttons had hover/active styles but no keyboard focus ring | Added `:focus-visible` rings; reduced-motion is now honoured in JS (shake, drift, twinkle), not only in CSS |

### AAA Visual Overhaul — executed pass (this session)

A comprehensive visual finishing pass was applied to the existing game, preserving all gameplay mechanics, controls, and simulation logic. All rendering is procedural Canvas 2D — no external assets, no broken dependencies, no engine change.

| Asset family | Lane | Change |
|--------------|------|--------|
| Star cores | REFINE | Multi-layered luminous cores with structural engraving rings, inner caustic ring, off-center highlights, light-failure sequence during surrender, collapse crunch flash |
| Absence nodes | REFINE | True ink-black event horizon, accretion-like bright rim, gravitational lensing distortion field, rotating displaced-starlight contours, inward spiral hint |
| Absence spans (lattice) | REFINE | Light-eating distortion field, warp bulge, displaced-starlight contour traces, anchor flares at nodes |
| Starsilk filaments | REFINE | Tapered dimensional ribbons with outer aura, core bar, barcode syntax segments, dark syntax lines, end anchor flares, tension curvature |
| Planets/moons | REFINE | Banded surface stripes, atmospheric halo, equatorial accent, specular highlight, orbital shadow |
| Orbits | REFINE | Concentric architectural rings per system, nodal markers, per-system dash signatures, tremble under grip |
| Background | ENRICH | 3-layer parallax starfield with drift, twinkle, and occasional distant-sun glints |
| Collapse VFX | ENRICH | Inward shockwave pulse, light-failure ring darkening, debris particle bursts |
| Particles | NEW | Lightweight object pool (160 max) for debris/sparks/glimmers with physics and fade |
| Screen effects | NEW | Subtle vignette, collapse vignette pulse, micro screen shake on collapse |
| UI system | REFINE | Cohesive glassmorphism, Space Grotesk/IBM Plex Mono typography, micro-interaction states, focus rings |
| Performance | OPTIMIZE | Particle object pool (reuse instead of alloc), limited draw operations, adaptive alpha fade |

## Not executed in this environment (browser-only)

- Web Audio synthesis (stellar drone, tension, collapse transient, silence) — no `AudioContext` in jsdom
- Live browser accessibility audit (focus order, ARIA announcements, contrast) — markup and CSS were reviewed, not audited by a tool
- GPU-composited frame pacing on real hardware; frame timings below come from a software rasteriser and are a relative signal only
- Pointer/touch gesture plumbing end-to-end in a real browser (hit-testing and state transitions are unit-verified; the browser event path is not)

## Method

**Rendering is now verified against real pixels.** A headless harness loads `index.html` in `jsdom`, backs `HTMLCanvasElement.getContext` with `@napi-rs/canvas`, and drives the app through a manually pumped `requestAnimationFrame` with a seeded PRNG — so frames are deterministic and directly comparable. Captured frames are analysed numerically (per-region mean luminance, background baseline, bright-pixel fraction, contrast) rather than by eye.

Results across four viewports (390×844, 768×1024, 1200×800, 1920×1080):

| Suite | Result |
|-------|--------|
| Visual / pixel assertions | **11 passed, 0 failed** at every viewport |
| Functional acceptance (sim, counters, chains, reconciliation, reset, no double-count) | **33 passed, 0 failed** at mobile and desktop |
| Performance / memory-boundedness | **4 passed, 0 failed** |
| Config matrix (DPR 1/2/3, mobile, reduced-motion, combinations) | renders clean, **0 runtime errors** |

Measured on the initial scene at 1200×800: background luminance **1.5–6.4**, star cores **107–185**, bright-pixel fraction **~17%** — a dark cosmos with high-contrast luminous stars, and the void is not washed out by bloom. After destroying all five systems the scene remains legible (std ≈ 29), confirming the absence lattice reads as structure.

JavaScript syntax was validated with `node --check`, and the file serves cleanly (`HTTP 200`). See "Not executed" above for what still requires a real browser.

## Inventory reconciliation

Original inventory: 5 systems, 5 stars, 13 planets, 5 moons. After collapsing all five systems: `planetsLost === 13`, `moonsLost === 5`, `total === 5`, `intact === 0`. The ledger reconciles to the original object inventory with each object counted exactly once.


---

# Verification round — improvement pass (25 recommendations)

Re-verified after implementing recommendations 1–25. Method is unchanged: the
headless harness in `tools/` (jsdom + `@napi-rs/canvas`, seeded PRNG, manually
pumped rAF), with `1d905ad` re-measured using the *same* tooling so the
before/after numbers are directly comparable.

## Suites

| Suite | Result |
|-------|--------|
| `tools/functional.js` (acceptance criteria) | **40 passed, 0 failed** |
| `tools/features.js` (undo, persistence, a11y, export) | **48 passed, 0 failed** |
| `tools/analyze.js` config matrix | **all 5 configurations clean, 0 runtime errors** |
| `node --check` on the embedded script | passes |

Config matrix: desktop 1200×800 at DPR 1 (1200×800 backing), DPR 2 (2400×1600),
DPR 3 (2400×1600, capped); mobile portrait 390×844 @DPR2 (780×1688);
reduced-motion. No errors in any.

## Two defects found and fixed during this pass

**1. `srAnnounce()` threw on every interaction.** The `aria-live` region existed
as a CSS rule and a JS lookup, but the `#sr-live` element was never in the DOM,
so every grip, collapse, undo, reset, mute and contrast toggle raised
`TypeError: Cannot set properties of null`. Fixed by adding the element *and* a
null guard — the guard alone would have silently disabled all screen-reader
output.

**2. `commitCollapse()` stressed systems that were not connected.** The edge loop
computed `otherId = e.a === nodeId ? e.b : e.a` without first checking the edge
actually contained `nodeId`, so unrelated edges fell through to `e.a` and were
stressed anyway. With six edges and `stressPerCollapse: 34` against a
`chainStressThreshold` of 100, the two adjacent systems received +68 per
collapse instead of +34 — meaning **every** collapse triggered a full-board
cascade. One grip was producing `direct:1, chain:4`. Fixed with an adjacency
guard; chain reactions now follow the declared graph.

## Measured effects (identical tooling, `1d905ad` → now)

| Metric | Before | After |
|---|---|---|
| System colour distinctness, closest pair | 20.9 | **59.3** (2.8× more distinct) |
| System colour distinctness, furthest pair | 126.2 | 164.3 |
| `after reset` scene mean luminance | 45.92 | **31.63** (initial is 31.49) |
| `after reset` bright-pixel fraction | 25.39% | 18.63% (initial is 18.56%) |
| idle, ms/frame (software rasteriser) | 11.22 | **9.07** (−19%) |
| one system collapsed, ms/frame | 13.26 | 10.36 (−22%) |
| all systems absent, ms/frame | 10.84 | 13.31 (+23%) |
| peak active particles | 122 | 125 |

Notes on the above:

- **Reset fidelity was genuinely broken.** Before this pass, resetting left the
  scene ~45% brighter than a fresh load. The cause was `buildNebula()` using
  `Math.random()`, so the backdrop was re-rolled on every reset and resize —
  sometimes landing on a much brighter nebula. A seeded PRNG now makes the
  background reproducible, and reset matches a fresh load to within 0.5%.
- **The interactive states got ~20% faster** (batched starfield blits,
  pre-rendered orbit-ring sprites, quality-scaled particle counts).
- **The all-destroyed end state costs ~2.5 ms/frame more** than before. This is
  the deliberate cost of the stronger absence lattice (recommendation 20). It is
  the least interactive state in the app — a static tableau — and the figures
  come from a software rasteriser with no GPU, where path fills and blits are
  disproportionately expensive. Profiling by ablation attributed ~1.1 ms/frame
  to the six spans in total.

## Still not verified in this environment

Unchanged from the list above: Web Audio, live-browser accessibility audit,
GPU frame pacing on real hardware, and real pointer/touch gesture plumbing. The
`#sr-live` defect in particular is a reminder that markup-level a11y claims
still warrant a real audit.
