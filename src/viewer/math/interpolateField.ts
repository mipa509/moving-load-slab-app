import type { ContourScale } from "../../app/contourScale";

export function buildVertexColors(
  nodalValues: Float32Array,
  scale: ContourScale,
): Float32Array {
  const colors = new Float32Array(nodalValues.length * 3);
  for (let i = 0; i < nodalValues.length; i++) {
    const css = scale.getColor(nodalValues[i]);
    const [r, g, b] = parseCssColor(css);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  return colors;
}

// Handles "rgb(r, g, b)" (returned by interpolateColor) and "#rrggbb" (hex stops)
function parseCssColor(css: string): [number, number, number] {
  if (css.startsWith("rgb")) {
    const m = css.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (m) {
      return [
        parseInt(m[1], 10) / 255,
        parseInt(m[2], 10) / 255,
        parseInt(m[3], 10) / 255,
      ];
    }
  }
  if (css.startsWith("#")) {
    const h = css.slice(1);
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    ];
  }
  return [0.5, 0.5, 0.5];
}
