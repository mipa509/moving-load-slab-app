import { describe, expect, it } from "vitest";
import {
  supportAxisFrame,
  transformMomentTensor,
  transformMomentsToSupportAxes,
} from "../solver/post/momentTensor";

const DEG = Math.PI / 180;

function close(actual: number, expected: number, precision = 10): void {
  expect(actual).toBeCloseTo(expected, precision);
}

describe("plate moment tensor transformation", () => {
  it("is the identity at zero rotation", () => {
    const t = transformMomentTensor({ mx: 5, my: -3, mxy: 2 }, 0);
    close(t.mNN, 5);
    close(t.mTT, -3);
    close(t.mNT, 2);
  });

  it("swaps normal/tangent and flips twist at 90 degrees", () => {
    const t = transformMomentTensor({ mx: 5, my: -3, mxy: 2 }, 90 * DEG);
    close(t.mNN, -3);
    close(t.mTT, 5);
    close(t.mNT, -2);
  });

  it("maps pure twist to +/-T principal moments with zero cross term at 45 degrees", () => {
    const t = transformMomentTensor({ mx: 0, my: 0, mxy: 7 }, 45 * DEG);
    close(t.mNN, 7);
    close(t.mTT, -7);
    close(t.mNT, 0);
  });

  it("leaves an isotropic tensor invariant under any rotation", () => {
    for (const deg of [0, 17, 45, 90, 123, -60]) {
      const t = transformMomentTensor({ mx: 4, my: 4, mxy: 0 }, deg * DEG);
      close(t.mNN, 4);
      close(t.mTT, 4);
      close(t.mNT, 0);
    }
  });

  it("preserves the trace invariant mNN+mTT for a uniaxial tensor", () => {
    for (const deg of [0, 30, 45, 75, 90]) {
      const t = transformMomentTensor({ mx: 10, my: 0, mxy: 0 }, deg * DEG);
      close(t.mNN + t.mTT, 10);
    }
  });

  it("preserves the trace invariant with a non-zero twist and mx != my", () => {
    // Exercises the +2 mxy cs and -2 mxy cs cancellation in the trace.
    for (const deg of [0, 30, 45, 75, 90]) {
      const t = transformMomentTensor({ mx: 6, my: -2, mxy: 3 }, deg * DEG);
      close(t.mNN + t.mTT, 4);
    }
  });

  it("matches an independently hand-computed tensor at a general 30-degree angle", () => {
    // Ground truth computed offline from mNN=n^T M n, mTT=t^T M t, mNT=n^T M t
    // with n=(cos30, sin30), t=(-sin30, cos30) and M=[[6,3],[3,-2]].
    const t = transformMomentTensor({ mx: 6, my: -2, mxy: 3 }, 30 * DEG);
    close(t.mNN, 6.598076211353316, 9);
    close(t.mTT, -2.598076211353316, 9);
    close(t.mNT, -1.964101615137754, 9);
  });

  it("round trips through a rotation and its inverse", () => {
    const m = { mx: 6, my: -2, mxy: 3 };
    const theta = 37 * DEG;
    const forward = transformMomentTensor(m, theta);
    const back = transformMomentTensor(
      { mx: forward.mNN, my: forward.mTT, mxy: forward.mNT },
      -theta,
    );
    close(back.mNN, m.mx);
    close(back.mTT, m.my);
    close(back.mNT, m.mxy);
  });

  it("has even mNN/mTT and odd mNT under a mirror (theta -> -theta, mxy -> -mxy)", () => {
    const theta = 28 * DEG;
    const plus = transformMomentTensor({ mx: 6, my: -2, mxy: 3 }, theta);
    const minus = transformMomentTensor({ mx: 6, my: -2, mxy: -3 }, -theta);
    close(minus.mNN, plus.mNN);
    close(minus.mTT, plus.mTT);
    close(minus.mNT, -plus.mNT);
  });
});

describe("support normal/tangent axes", () => {
  it("builds an orthonormal frame from an inclined skew edge", () => {
    const frame = supportAxisFrame({ x: 0, y: 0 }, { x: 2, y: 1 });
    close(Math.hypot(frame.normal.x, frame.normal.y), 1);
    close(Math.hypot(frame.tangent.x, frame.tangent.y), 1);
    close(frame.normal.x * frame.tangent.x + frame.normal.y * frame.tangent.y, 0);
    close(frame.tangent.x, 2 / Math.sqrt(5));
    close(frame.tangent.y, 1 / Math.sqrt(5));
  });

  it("gives a support-normal moment equal to mx for an edge along global y", () => {
    // Edge along global y -> normal along global x (angle 0) -> mNN=mx, mTT=my, mNT=mxy.
    const t = transformMomentsToSupportAxes({ mx: 5, my: -3, mxy: 2 }, { x: 0, y: 0 }, { x: 0, y: 4 });
    close(t.mNN, 5);
    close(t.mTT, -3);
    close(t.mNT, 2);
  });

  it("uses a proper orthonormal frame (not oblique s/t) for a skew edge", () => {
    // A 45-degree inclined edge has normal (1,-1)/sqrt2 (angle -45); pure twist
    // becomes signed principal moments mNN=-7, mTT=+7 with zero cross term.
    const t = transformMomentsToSupportAxes({ mx: 0, my: 0, mxy: 7 }, { x: 0, y: 0 }, { x: 1, y: 1 });
    close(t.mNN, -7);
    close(t.mTT, 7);
    close(t.mNT, 0);
  });

  it("throws for a degenerate zero-length support edge", () => {
    expect(() => supportAxisFrame({ x: 1, y: 1 }, { x: 1, y: 1 })).toThrow(/zero-length|degenerate/i);
  });
});
