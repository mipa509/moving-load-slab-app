import { describe, expect, it } from "vitest";
import { buildAutoRunSignature } from "../app/autoRun";
import { createDefaultModel } from "../app/defaults";

describe("auto-run signature", () => {
  it("ignores project-name and display-only changes", () => {
    const base = createDefaultModel();
    const changed = {
      ...base,
      projectName: "Viewport review only",
      display: {
        ...base.display,
        plotMode: "structure" as const,
        mesh: false,
        supports: false,
        wheelPatches: false,
        contours: false,
      },
    };

    expect(buildAutoRunSignature(changed)).toBe(buildAutoRunSignature(base));
  });

  it("changes when analysis inputs change", () => {
    const base = createDefaultModel();
    const changed = {
      ...base,
      geometry: {
        ...base.geometry,
        thicknessM: 0.5,
      },
    };

    expect(buildAutoRunSignature(changed)).not.toBe(buildAutoRunSignature(base));
  });

  it("changes when skewAngleDeg changes, invalidating a stale envelope signature", () => {
    const base = createDefaultModel();
    const skewed = {
      ...base,
      geometry: {
        ...base.geometry,
        skewAngleDeg: 19,
      },
    };

    expect(buildAutoRunSignature(skewed)).not.toBe(buildAutoRunSignature(base));
  });
});
