# STARSILK-_Unmaking

**The Unmaking Engine** — a browser-based interactive cosmic destruction instrument.
Reach into an illustrated stellar core, grip a strand of azure Starsilk, and pull it free. The star's sustaining order collapses inward; planets vanish; a permanent region of black absence spreads through the connected cosmic lattice. Repeat across five interacting stellar systems.

## How to run

This is a single, self-contained HTML file with no external dependencies. It works entirely offline after download.

1. Open `index.html` in any modern desktop or mobile browser.
   - Directly: double-click `index.html`.
   - Or serve it locally (e.g. `python3 -m http.server` in this folder, then visit `http://localhost:8000`).
2. No build step, no sign-in, no analytics, no external assets.

## Controls

- **Mouse / trackpad:** Hover or focus a star to reveal its interior layers and graspable azure filaments. Press and hold on a filament (or the star) to grip; the strand becomes taut. Drag outward — the filament stretches, the core deforms, and a tension ring builds. Cross the threshold to commit the extraction; the star surrenders inward. Release before the threshold and the strand returns smoothly.
- **Touch:** Press and hold on a filament/star, then drag outward. Touch scrolling is only suppressed during an active drag.
- **Keyboard:** `Tab` to move focus between a star's filament target, then `Enter` or `Space` to grip. Hold to confirm extraction (a confirmation threshold applies); release to cancel before it. `Escape` cancels any active grip or pull.
- **Sound:** Optional Web Audio synthesis (stellar drone, filament tension, collapse transient, silence). Initializes only after your first gesture. Use the **sound** toggle to mute/unmute. Audio never autoplay before interaction.
- **Reduced motion:** Respects `prefers-reduced-motion`; shaking and flashing are replaced with controlled shape, opacity, and timing changes.

## Interface

- **Main stage:** all five stellar systems (SYSTEM I–V) and their interconnections, filling the viewport.
- **Header:** title **THE UNMAKING ENGINE**, descriptor **Starsilk / Experimental Instrument**, sound toggle, autopsy button, and **Reset Universe**.
- **Destruction Ledger (persistent):** directly extracted stars, stars lost to chain reaction, total collapsed (of 5), planets lost, moons lost, intact systems, chain reactions, plus a chronological event log. All values derive from the live simulation; the initial ledger is all zeros.
- **Aftermath / Autopsy:** non-destructive, read-only view of the pre-collapse inventory and final topology.
- **Reset Universe:** explicit confirmation, then a deterministic reconstruction of the initial graph, all five intact stars, every orbiting body, and zeroed counters.

## Acceptance behavior (summary)

- Exactly five intact systems appear on first load, each with visible planets and at least one reachable filament.
- A short drag below threshold cancels without any counter change.
- A deliberate drag beyond threshold collapses the star, removes its orbiting bodies, and updates the ledger exactly once.
- Chain reactions follow the declared connection graph and stress threshold; every collapse identifies its source.
- Collapsing connected systems builds a persistent, visible lattice of absence.
- All five systems can reach a destroyed state without interface deadlock.
- Counters equal the true number of unique destroyed objects; reset restores everything and zeroes the ledger.
- Keyboard and touch users can complete the primary action; mute and reduced-motion modes function.

## Files

- `index.html` — the complete application (embedded CSS + JavaScript, Canvas 2D rendering).
- `README.md` — this file.

## Notes

This is a self-contained, noncanonical exploratory instrument. It makes no claims about specific canon characters, factions, or events. See the canon boundary note in the repository for details.
