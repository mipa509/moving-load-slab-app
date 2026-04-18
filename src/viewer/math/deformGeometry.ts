/**
 * Build z-displacement array from nodal displacement data.
 * Used by the surface geometry builder for deformed-shape rendering.
 */

export interface NodalDisplacement {
  nodeId: number;
  wM: number;
}

/**
 * Build a Float32Array of z-displacements indexed by node position.
 * Returns undefined if deformScale <= 0 or no displacements provided.
 * Logs a warning for out-of-range node IDs (should not happen with dense 0..n-1 IDs).
 */
export function buildZDisplacements(
  nodeCount: number,
  deformScale: number,
  nodalDisplacements: NodalDisplacement[],
  zSign: number = 1,
): Float32Array | undefined {
  if (deformScale <= 0 || nodalDisplacements.length === 0) {
    return undefined;
  }
  const zd = new Float32Array(nodeCount);
  for (const nd of nodalDisplacements) {
    if (nd.nodeId < 0 || nd.nodeId >= nodeCount) {
      console.warn(
        `buildZDisplacements: nodeId ${nd.nodeId} out of range [0, ${nodeCount})`,
      );
      continue;
    }
    zd[nd.nodeId] = nd.wM * zSign;
  }
  return zd;
}
