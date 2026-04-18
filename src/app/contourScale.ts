const DIVERGING_STOPS = [
  { offset: 0, color: "#14518e" },
  { offset: 0.25, color: "#4e93c3" },
  { offset: 0.5, color: "#edf1f5" },
  { offset: 0.75, color: "#de6a4c" },
  { offset: 1, color: "#a61c2f" },
] as const;

type Rgb = {
  r: number;
  g: number;
  b: number;
};

export interface ContourScale {
  domainMin: number;
  domainMax: number;
  gradientCss: string;
  hasZeroTick: boolean;
  zeroOffsetPercent: number | null;
  getColor: (value: number) => string;
}

export function createContourScale(min: number, max: number): ContourScale {
  const hasZeroTick = min < 0 && max > 0;
  const domainMin = min;
  const domainMax = max;
  const span = domainMax - domainMin;

  const zeroOffsetPercent = hasZeroTick
    ? ((0 - domainMin) / Math.max(span, 1e-12)) * 100
    : null;

  const getPaletteOffset = (value: number): number => {
    if (Math.abs(span) < 1e-12) {
      if (value > 0) return 0.75;
      if (value < 0) return 0.25;
      return 0.5;
    }

    if (hasZeroTick) {
      if (value <= 0) {
        return clamp((value - domainMin) / Math.max(0 - domainMin, 1e-12), 0, 1) * 0.5;
      }
      return 0.5 + clamp(value / Math.max(domainMax, 1e-12), 0, 1) * 0.5;
    }

    const normalized = clamp((value - domainMin) / span, 0, 1);
    return max <= 0 ? normalized * 0.5 : 0.5 + normalized * 0.5;
  };

  const gradientCss = buildGradientCss(
    domainMin,
    domainMax,
    zeroOffsetPercent,
    getPaletteOffset,
  );

  return {
    domainMin,
    domainMax,
    gradientCss,
    hasZeroTick,
    zeroOffsetPercent,
    getColor(value: number) {
      return interpolateColor(getPaletteOffset(value));
    },
  };
}

function buildGradientCss(
  domainMin: number,
  domainMax: number,
  zeroOffsetPercent: number | null,
  getPaletteOffset: (value: number) => number,
): string {
  if (Math.abs(domainMax - domainMin) < 1e-12) {
    const color = interpolateColor(getPaletteOffset(domainMin));
    return `linear-gradient(to top, ${color} 0%, ${color} 100%)`;
  }

  const positions = new Set<number>(Array.from({ length: 17 }, (_, index) => index / 16));
  if (zeroOffsetPercent !== null) {
    positions.add(clamp(zeroOffsetPercent / 100, 0, 1));
  }

  const stops = Array.from(positions)
    .sort((a, b) => a - b)
    .map((position) => {
      const value =
        zeroOffsetPercent !== null && Math.abs(position - zeroOffsetPercent / 100) < 1e-9
          ? 0
          : domainMin + (domainMax - domainMin) * position;
      return `${interpolateColor(getPaletteOffset(value))} ${(position * 100).toFixed(3)}%`;
    });

  return `linear-gradient(to top, ${stops.join(", ")})`;
}

function interpolateColor(offset: number): string {
  const clamped = clamp(offset, 0, 1);

  for (let index = 0; index < DIVERGING_STOPS.length - 1; index += 1) {
    const start = DIVERGING_STOPS[index];
    const end = DIVERGING_STOPS[index + 1];
    if (clamped > end.offset) {
      continue;
    }

    const span = Math.max(end.offset - start.offset, 1e-12);
    const local = (clamped - start.offset) / span;
    const startRgb = hexToRgb(start.color);
    const endRgb = hexToRgb(end.color);

    return `rgb(${Math.round(lerp(startRgb.r, endRgb.r, local))}, ${Math.round(
      lerp(startRgb.g, endRgb.g, local),
    )}, ${Math.round(lerp(startRgb.b, endRgb.b, local))})`;
  }

  return DIVERGING_STOPS[DIVERGING_STOPS.length - 1].color;
}

function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}
