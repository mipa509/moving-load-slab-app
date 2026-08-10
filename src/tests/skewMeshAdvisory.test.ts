import { describe, expect, it } from "vitest";
import { SKEW_MESH_ADVISORY_DEG, skewMeshAdvisory } from "../app/skewMeshAdvisory";

describe("skewMeshAdvisory", () => {
  it("has a threshold of 30 degrees", () => {
    expect(SKEW_MESH_ADVISORY_DEG).toBe(30);
  });

  it("returns null below the threshold (incl. zero skew)", () => {
    expect(skewMeshAdvisory(0)).toBeNull();
    expect(skewMeshAdvisory(19)).toBeNull();
    expect(skewMeshAdvisory(29.999)).toBeNull();
    expect(skewMeshAdvisory(-19)).toBeNull();
  });

  it("returns an advisory at and above the threshold, symmetric in sign", () => {
    expect(skewMeshAdvisory(30)).toMatch(/screening only/i);
    expect(skewMeshAdvisory(45)).toMatch(/triangular/i);
    expect(skewMeshAdvisory(-35)).not.toBeNull();
    expect(skewMeshAdvisory(-45)).toEqual(skewMeshAdvisory(45));
  });

  it("treats non-finite input as no advisory", () => {
    expect(skewMeshAdvisory(Number.NaN)).toBeNull();
    expect(skewMeshAdvisory(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
