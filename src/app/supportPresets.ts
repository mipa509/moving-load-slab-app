/**
 * WP-040: pure helpers for the ControlPanel Supports block. These build the
 * two standard "preset" end-support configurations (fixed-fixed /
 * pinned-pinned) at the current deck skew, and describe the skew sign
 * convention for the Slab Geometry readouts. Kept side-effect free so they
 * can be unit tested without rendering React.
 */
import type { ConstraintSet, SlabGeometry, Support } from "./types";
import type { DeckEdge } from "../solver/geometry/types";

export type SupportPreset = "fixed-fixed" | "pinned-pinned";

/** uz/rx/ry constraint set for a named end-support preset. */
export function presetConstraints(preset: SupportPreset): ConstraintSet {
  if (preset === "fixed-fixed") {
    return {
      uz: { type: "fixed" },
      rx: { type: "fixed" },
      ry: { type: "fixed" },
    };
  }

  return {
    uz: { type: "fixed" },
    rx: { type: "free" },
    ry: { type: "free" },
  };
}

/**
 * Build the two standard end supports (start/end) for the given preset at
 * the current slab geometry. At non-zero skew the supports are expressed as
 * edge-identity supports (kind: 'edge') so they follow the true inclined
 * support line; at zero skew they are expressed as the legacy straight-line
 * coordinate supports so existing zero-skew persistence/behaviour is
 * unchanged.
 */
export function buildPresetSupports(geometry: SlabGeometry, preset: SupportPreset): Support[] {
  if (geometry.skewAngleDeg !== 0) {
    return [
      {
        id: "S1",
        name: "Start edge",
        kind: "edge",
        edge: "start",
        constraints: presetConstraints(preset),
      },
      {
        id: "S2",
        name: "End edge",
        kind: "edge",
        edge: "end",
        constraints: presetConstraints(preset),
      },
    ];
  }

  return [
    {
      id: "S1",
      name: "Start edge",
      kind: "line",
      x1: 0,
      y1: 0,
      x2: 0,
      y2: geometry.widthM,
      constraints: presetConstraints(preset),
    },
    {
      id: "S2",
      name: "End edge",
      kind: "line",
      x1: geometry.lengthM,
      y1: 0,
      x2: geometry.lengthM,
      y2: geometry.widthM,
      constraints: presetConstraints(preset),
    },
  ];
}

/** Short sign-convention sentence for the Slab Geometry skew readouts. */
export function describeSkewSign(skewAngleDeg: number): string {
  if (skewAngleDeg > 0) {
    return "Positive skew: support lines shift toward +x as width increases (y grows).";
  }
  if (skewAngleDeg < 0) {
    return "Negative skew: support lines shift toward -x as width increases (y grows).";
  }
  return "No skew: rectangular deck.";
}

/** Options for the edge-identity picker on an edge-kind support. */
export const DECK_EDGE_OPTIONS: readonly { value: DeckEdge; label: string }[] = [
  { value: "start", label: "Start (s = 0)" },
  { value: "end", label: "End (s = length)" },
  { value: "lower-side", label: "Lower side (t = 0)" },
  { value: "upper-side", label: "Upper side (t = width)" },
];
