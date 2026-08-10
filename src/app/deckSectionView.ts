// WP-041B: pure adapter between the app-level deck-local (s/t) section
// contract (`./types` `SectionCurve`, produced by `computeDeckSection` in
// `./sectionCurve.ts`) and the LOCAL `SectionCurve` shape consumed by the
// existing `SectionPlot` component (`../components/SectionPlot.tsx`, backed
// by `./sectionCurve.ts`'s own `SectionCurve`/`SectionSample`).
//
// Both modules export a type named `SectionCurve` with different shapes, so
// (mirroring the aliasing pattern already used inside `sectionCurve.ts`) both
// are imported here under aliases to avoid the name collision.
import type { SectionCurve as DeckSectionCurve, SectionOrdinate } from "./types";
import type { SectionCurve as LocalSectionCurve } from "./sectionCurve";

/**
 * Maps a deck-local `SectionCurve` (types.ts, produced by `computeDeckSection`)
 * onto the LOCAL `SectionCurve` shape `SectionPlot` renders. Pure and total:
 * a `null` input (no deck-local curve was computed) maps to `null`, and an
 * empty deck curve (`state: 'empty'`, `samples: []`) maps to a local curve
 * with `samples: []` so `SectionPlot` falls back to its built-in "No nodes in
 * section band" empty state rather than needing special-case handling here.
 */
export function toSectionPlotCurve(deck: DeckSectionCurve | null): LocalSectionCurve | null {
  if (!deck) {
    return null;
  }
  return {
    axis: deck.stationAxis === "s" ? "x" : "y",
    centerPerpM: deck.requestedCenterM,
    widthM: deck.requestedWidthM,
    samples: deck.samples.map((sample) => ({
      distanceM: sample.stationM,
      value: sample.value,
    })),
    min: deck.min ?? 0,
    max: deck.max ?? 0,
    units: deck.units,
  };
}

/**
 * Human-readable station-axis label for the deck-local section plot's
 * horizontal axis, keyed off the section's `mode`. Accepts anything carrying
 * a `mode` field (both `DeckSectionSettings` and `DeckSectionCurve` qualify)
 * so it can be called from either the settings object or a computed curve.
 */
export function deckSectionAxisLabel(deck: { mode: "longitudinal" | "transverse" }): string {
  return deck.mode === "longitudinal" ? "Distance along s (m)" : "Distance along t (m)";
}

/** Human-readable label for a deck-local section ordinate. */
export function deckSectionValueLabel(ordinate: SectionOrdinate): string {
  if (ordinate === "mx") return "Mxx";
  if (ordinate === "my") return "Myy";
  return "Mxy";
}
