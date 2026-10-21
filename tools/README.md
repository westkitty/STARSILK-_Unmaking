# Verification tools

Headless harnesses for `index.html`. They run the real app in jsdom with a
software rasteriser for pixels, a seeded PRNG, and a manually pumped
`requestAnimationFrame` — so every run is deterministic and comparable.

## Setup

```bash
mkdir -p /tmp/vis && cd /tmp/vis
npm install jsdom @napi-rs/canvas
```

Use `@napi-rs/canvas`, **not** `canvas` — the native `canvas` package needs
node-gyp and fails to build in a sandbox.

> The tools resolve their dependencies from `/tmp/vis/node_modules`, so if
> `/tmp` has been cleared, re-run the install above.

## Running

From the repository root:

```bash
node tools/harness.js      # boot, drive a scripted playthrough, write tools/shots/
node tools/functional.js   # acceptance criteria: the original spec, re-checked
node tools/features.js     # feature suite: undo, persistence, a11y, export
node tools/analyze.js      # scene pixel statistics + viewport/DPR config matrix
node tools/perf.js         # frame-time profile (relative, software rasteriser)
```

All of them exit non-zero on failure, so they can be chained with `&&`.

### Useful options

```bash
OUT=/tmp/shots node tools/harness.js          # write PNGs
VW=390 VH=844 DPR=2 node tools/harness.js     # mobile viewport
REDUCED_MOTION=1 node tools/harness.js        # prefers-reduced-motion
HTML=/path/to/other.html node tools/analyze.js  # compare another build
node tools/perf.js --compare tools/perf-baseline.json
```

## What each one covers

| Tool | Focus |
|---|---|
| `harness.js` | Shared boot. Exports `boot(opts)` for a fresh instance plus a default instance configured from env vars. |
| `functional.js` | The acceptance criteria: five systems, cancel vs. commit, chain reactions, absence lattice, no double counting, reset (including cancelling pending chains). |
| `features.js` | Undo, session persistence (incl. corrupt data), board summary, high contrast, PNG export, keyboard shortcuts. |
| `analyze.js` | Brightness/coverage per scene, per-system colour identity, and the desktop/DPR/mobile/reduced-motion matrix. Writes `tools/baseline.json`. |
| `perf.js` | ms/frame in several states. Writes `tools/perf-baseline.json`. |

## Caveats

- **`perf.js` numbers are relative only.** There is no GPU here, so absolute
  ms/frame far exceeds what a browser does. Compare against a baseline captured
  on the same machine.
- `settle()` (in `harness.js`) steps until nothing is collapsing **and** no
  chains are pending. Chains fire on a 0.7–1.9s delay and hit-stop slows time
  after a collapse, so a single large `update()` is not enough.
- `reset()` rebuilds the node objects. Fetch nodes *after* a reset, never hold a
  reference across one.
