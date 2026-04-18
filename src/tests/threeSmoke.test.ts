import { describe, it, expect } from "vitest";
import * as Three from "three";

describe("three.js smoke", () => {
  it("can create a BufferGeometry", () => {
    const geo = new Three.BufferGeometry();
    expect(geo).toBeDefined();
    geo.dispose();
  });
});
