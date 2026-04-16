# Moving Load Slab App

Browser-based structural analysis app for rapid fixed-position and stepped moving-load checks on a rectangular concrete slab model.

## Documentation

- [V3 specification](./docs/v3-specification.md)
- [V2 specification](./docs/v2-specification.md)
- [V1 specification](./docs/v1-specification.md)
- [Benchmark reference](./docs/benchmark-reference.md)

## Stack

- React
- TypeScript
- Vite

## Current scope

- Rectangular slab only
- Linear elastic plate analysis
- One vehicle at a time
- Fixed-position analysis workflow with live rerun
- JSON save/load
- Browser-persisted vehicle library with import/export
- Print-based PDF export with plot-aware print layout
- 2D contour viewer with legend
- Reaction summaries by support and total

## What Changed In V3

- Added a `Vehicle Library` panel for saving reusable vehicle definitions.
- Added `Save Current`, `Load Selected`, `Overwrite Selected`, `Duplicate Selected`, and `Delete Selected` actions.
- Added JSON export/import for the full vehicle library.
- Added duplicate-id protection and sanitization for imported vehicle library items.
- Kept the library separate from slab model JSON save/load.

## What Changed In V2

- Added debounced live auto-run and a sticky top-level `Re-run Analysis` button.
- Added an initial auto-run so the viewport starts populated.
- Added stale-run protection so older async runs cannot overwrite newer results.
- Added a live travel-axis slider for axle-mode placement.
- Reworked contour coloring into a centralized diverging scale and added a vertical legend bar.
- Added viewport padding so the slab is easier to inspect visually.
- Made `reactions` a proper result mode with support summaries, total sums, and raw nodal rows.
- Fixed mesh sizing so `target element size` now actually drives the solver mesh.
- Improved model sanitization and TypeScript/Vite build setup for the nested app repo.

## Main Interaction Notes

- Most valid input changes trigger a rerun automatically after `150 ms`.
- The manual rerun button stays visible at the top of the control panel.
- Vehicle definitions can now be saved to a browser-local library and reloaded later from the panel list.
- In axle mode, the travel direction determines whether the live slider controls vehicle `X` or `Y`.
- PDF export keeps the colour scale on the plot and moves the info panel below the plot for print.
- Reaction totals are shown by support and as a deduplicated global total.

## Run

```powershell
npm install
npm run dev
npm test
npm run build
```
