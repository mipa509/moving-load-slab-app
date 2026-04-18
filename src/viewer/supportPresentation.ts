import type { Dof, Support } from "../app/types";

export type SupportChipTone = "fixed" | "spring" | "free";

export interface SupportChipVisual {
  dof: Dof;
  label: Uppercase<Dof>;
  tone: SupportChipTone;
}

export interface SupportVisual {
  id: string;
  kind: Support["kind"];
  anchor: [number, number];
  labelAnchor: [number, number];
  glyphAnchors: [number, number][];
  linePoints?: [[number, number], [number, number]];
  chips: SupportChipVisual[];
}

export function buildSupportVisuals(supports: Support[]): SupportVisual[] {
  return supports.map((support) => {
    const chips = buildSupportChips(support);

    if (support.kind === "point") {
      return {
        id: support.id,
        kind: "point",
        anchor: [support.x, support.y],
        labelAnchor: [support.x, support.y],
        glyphAnchors: [[support.x, support.y]],
        chips,
      };
    }

    const anchor: [number, number] = [
      0.5 * (support.x1 + support.x2),
      0.5 * (support.y1 + support.y2),
    ];

    return {
      id: support.id,
      kind: "line",
      anchor,
      labelAnchor: anchor,
      glyphAnchors: sampleLineGlyphAnchors(support),
      linePoints: [
        [support.x1, support.y1],
        [support.x2, support.y2],
      ],
      chips,
    };
  });
}

function buildSupportChips(support: Support): SupportChipVisual[] {
  return (["uz", "rx", "ry"] as const).map((dof) => ({
    dof,
    label: dof.toUpperCase() as Uppercase<Dof>,
    tone: toChipTone(support.constraints[dof].type),
  }));
}

function toChipTone(type: Support["constraints"]["uz"]["type"]): SupportChipTone {
  if (type === "fixed") {
    return "fixed";
  }
  if (type === "spring") {
    return "spring";
  }
  return "free";
}

function sampleLineGlyphAnchors(
  support: Extract<Support, { kind: "line" }>,
): [number, number][] {
  const dx = support.x2 - support.x1;
  const dy = support.y2 - support.y1;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-9) {
    return [[support.x1, support.y1]];
  }

  const count = clamp(Math.round(length / 1.8) + 1, 2, 6);
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1);
    return [support.x1 + dx * t, support.y1 + dy * t];
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
