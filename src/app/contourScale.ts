const DIVERGING_STOPS = [
  { offset: 0, color: "#2166ac" },
  { offset: 0.25, color: "#67a9cf" },
  { offset: 0.5, color: "#f7f7f7" },
  { offset: 0.75, color: "#ef8a62" },
  { offset: 1, color: "#b2182b" },
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
  const domain =
    hasZeroTick
      ? (() => {
          const bound = Math.max(Math.abs(min), Math.abs(max));
          return {
            min: -bound,
            max: bound,
            paletteStart: 0,
            paletteEnd: 1,
          };
        })()
      : max <= 0
        ? {
            min,
            max,
            paletteStart: 0,
            paletteEnd: 0.5,
          }
        : {
            min,
            max,
            paletteStart: 0.5,
            paletteEnd: 1,
          };

  const zeroOffsetPercent = hasZeroTick
    ? ((0 - domain.min) / Math.max(domain.max - domain.min, 1e-12)) * 100
    : null;
  const gradientCss = `linear-gradient(to top, ${DIVERGING_STOPS.map(
    (stop) => `${stop.color} ${stop.offset * 100}%`,
  ).join(", ")})`;

  return {
    domainMin: domain.min,
    domainMax: domain.max,
    gradientCss,
    hasZeroTick,
    zeroOffsetPercent,
    getColor(value: number) {
      if (Math.abs(domain.max - domain.min) < 1e-12) {
        return DIVERGING_STOPS[2].color;
      }

      const normalized = clamp(
        (value - domain.min) / (domain.max - domain.min),
        0,
        1,
      );
      const paletteOffset =
        domain.paletteStart +
        normalized * (domain.paletteEnd - domain.paletteStart);

      return interpolateColor(paletteOffset);
    },
  };
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
