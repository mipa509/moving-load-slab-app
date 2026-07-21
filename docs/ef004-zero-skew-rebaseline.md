# EF-004 deliberate zero-skew MITC4 rebaseline

## Status and provenance

This document records an intentional numerical baseline change. It is not a
claim of physical validation, benchmark agreement, design suitability, or
release approval.

| Role | Commit |
|---|---|
| Pre-MITC4 SRI fixture source | `352556d65785aee71319b809f8a0762fd729d4a4` |
| MITC4 production formulation producing the new values | `0088e11f889b01cece5e867351663a32e33dbe11` |
| EF-004 dispatch checkpoint used for capture | `44084dd5bab36095c2058976e88676286da50a72` |
| Ledger-only provenance correction present during final checks | `ba3e89da099ed2691d477e7fc340d454f2411212` |

The old values characterized the one-point selectively reduced shear
formulation. EF-001 subsequently demonstrated that formulation to be
rank-defective: it had extra non-physical zero-energy modes. Those values were
never validated engineering results.

The new values are produced by the original Bathe-Dvorkin MITC4 implementation
accepted in EF-003. MITC4 replaces raw one-point shear integration with four
covariant edge ties and full 2 by 2 integration while retaining the compatible
bending operator and public three-DOF API. The resulting changes are therefore
deliberate formulation changes, not skew effects and not tolerance changes.

## Characterization model

| Item | Value |
|---|---|
| Slab | 2.0 m by 2.0 m, thickness 0.3 m, zero skew |
| Material | E = 30,000 MPa, Poisson ratio = 0.2, default shear factor 5/6 |
| Baseline mesh | 2 by 2 Q4 elements; 9 nodes; 27 DOFs |
| Supports | All three DOFs fixed on all four perimeter lines |
| Load | Central +100 kN wheel; 0.5 m by 0.5 m square patch |
| Patch bounds | x = 0.75 to 1.25 m; y = 0.75 to 1.25 m |
| Solver settings | Relative tolerance 1e-10; absolute tolerance 1e-12; maximum 3000 iterations |

Topology, material, thickness, support definitions, patch geometry, applied
load, load-vector assembly, DOF order, and solver settings are unchanged.

## Old/new engineering-relevant changes

Positive `w` and applied wheel load follow the repository's element-local
`+z` convention. Fixed-support vertical reactions have the opposite sign.

| Quantity | Pre-MITC4 SRI | MITC4 | Absolute change | Relative change |
|---|---:|---:|---:|---:|
| Element stiffness `K[0,0]` (kN/m) | 1,562,500 | 2,083,333.3333333335 | +520,833.3333333335 | +33.333333% |
| Assembled applied load (kN) | 100 | 100 | 0 | 0% |
| Centre/max nodal deflection (m) | 0.00001225 | 0.0000091875 | -0.0000030625 | -25% |
| Centre/max nodal deflection (mm) | 0.01225 | 0.0091875 | -0.0030625 | -25% |
| Nodal `rx`, `ry` on 2 by 2 case | all zero | all zero | 0 | 0% |
| Max absolute `Mx`, `My`, `Mxy` on 2 by 2 case | 0 | 0 | 0 | not meaningful |
| Max absolute `Qx`, `Qy` (kN/m) | 19.140625 | 14.355468750000002 | -4.785156249999998 | -25% |
| Total deduplicated vertical reaction (kN) | -100 | -100 | 0 | 0% |
| Each duplicated corner vertical reaction row (kN) | -19.53125 | -9.9609375 | +9.5703125 | magnitude -49% |
| Each edge-mid vertical reaction row (kN) | -5.46875 | about -15.0390625 | about -9.5703125 | magnitude +175% |
| CG iterations | 1 | 1 | 0 | 0% |
| Initial residual norm | 76.5625 | 76.5625 | 0 | 0% |
| Final residual norm | 0 | 2.879893969834564e-15 | +2.879893969834564e-15 | undefined from zero |

The unchanged load vector proves that EF-004 did not alter patch integration.
The changed displacement, shear and support distribution follow from the
element formulation. The 2 by 2 mesh has only one free interior node and its
two directors are zero by symmetry; its zero recovered moments must not be
interpreted as a physical moment prediction.

The current fixture contains all 144 element-stiffness entries, all 27 load
entries, all nine complete nodal displacement records, all 36 support-reaction
records (vertical and generalized rotational), the complete summary, and the
complete diagnostics. Current generalized rotational reaction magnitudes are
approximately 2.392578125 kN m at corners and 9.5703125 kN m at edge
midpoints, with symmetry-zero components at floating-point roundoff.

## Deterministic array trace

Hashes use SHA-256 over `JSON.stringify(value)`; the algorithm identifier in
the fixture is `sha256-json-stringify-v1`.

| Data | Pre-MITC4 hash | MITC4 hash |
|---|---|---|
| Element stiffness | `580b5155e26d170c89fa9f58f850f1d60bf591f6593d01d5fb6ee5f4794d5012` | `d39e6d3f80877d833e7811f6ec35e85ffde0fc75604611d206cbc54f49d56f60` |
| Global load vector | `26861442529cffab66f5d5d09f647f52267c54c1c81d77adf6de668aac29ef7b` | `26861442529cffab66f5d5d09f647f52267c54c1c81d77adf6de668aac29ef7b` |
| Nodal response | `w: bd0363194f2b8b7ca9ce18d9f07092d2b09c2281064d05d3ea4894f400868274`; `rx/ry: 2ec39b8e5281419b8e38ee0825032600b5f9708a1c3289347a7e3507991facae` | `07f12380c0e8598d1f8940b4cd52cd5f2783b8e430c32f82f5e28b4911dbeacf` |
| Reactions | vertical rows: `0faf7fa824f6c7ce685e8e08901890d4b45212c5d38644b6052e02318b11eb95` | all support rows: `9b22617c79379c24e0bd02e1f17e408276c9ab71884b0976fb8e4c114012b4b8` |
| Summary | `533fce436e24261a974e69a37023489bc5e4ca027ab4618cded28854a48eb892` | `5d63a00503d22f18778faeb5e39fbc8a7feb52ad1d5078746dc2f24394494cc4` |
| Diagnostics | `cd7ba615e2096a5db7814f15a8b9784a40fdf87c41e1844928002b5b532f1d3e` | `c628ac75567a7b9e4a849f761e8de9edcf0d5c0347846eaae3852ac8ecfc309c` |

The old fixture did not store generalized rotational reaction rows. They
remain reproducible from commit `352556d`; EF-004 does not invent an old
array that was not part of the frozen characterization.

## Internal refinement evidence

The same physical model was solved on uniform 2, 4, 8 and 16 element-per-side
meshes. This is current-model internal convergence evidence only.

| Mesh | Nodes / elements | Centre = max `w` (m) | Fine-relative change in `w` | Max abs `Mx` (kN m/m) | Max abs `Mxy` (kN m/m) | Max abs `Qx` (kN/m) | Iterations | Force equilibrium residual (kN) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2 by 2 | 9 / 4 | 9.187500000000000e-6 | - | 0 | 0 | 14.355468750000002 | 1 | 0 |
| 4 by 4 | 25 / 16 | 3.0970248921321906e-5 | 70.3344328% | 5.341399145382521 | 1.2707135943455699 | 23.15556425870272 | 5 | 0 |
| 8 by 8 | 81 / 64 | 3.551492616737431e-5 | 12.7965274% | 9.652940266156357 | 2.612363519958303 | 37.607779699387166 | 20 | -3.6763481148227584e-11 |
| 16 by 16 | 289 / 256 | 3.672999966174878e-5 | 3.3081228% | 12.041269619286492 | 2.9747642689033995 | 46.81777084946396 | 36 | 1.2217213907206315e-9 |

`My` and `Qy` match `Mx` and `Qx` respectively within the existing
solver tolerance, as required by square-model symmetry. All solves converged,
all recorded values were finite, and signed equilibrium remained bounded by
the CG residual and the number of fixed DOFs.

The successive centre-deflection changes are
`[0.7033443282, 0.1279652737, 0.0330812280]`. They contract and the final
change is below the pre-recorded 4% internal property gate.

The raw element-centre extrema are not converged release quantities at 16 by
16. Successive relative changes are:

- `Mx: [1.0, 0.4466557341, 0.1983453098]`;
- `Mxy: [1.0, 0.5135770406, 0.1218250309]`; and
- `Qx: [0.3800423695, 0.3842879201, 0.1967199844]`.

Their sampling locations move with refinement. The `Qx` maxima occur at
`(0.5,0.5)`, `(1.25,1.25)`, `(0.625,1.125)`, and
`(1.3125,0.9375)` m; the fine locations approach the discontinuous patch
edges at 0.75 and 1.25 m. The implementation plan explicitly prohibits using
raw moving extrema, patch-edge values, or inconsistent shear recovery as
release gates. EF-004 therefore records these increasing values and does not
claim moment or shear convergence.

## Test policy and limitations

- Existing comparison tolerances are unchanged: pure stiffness/load relative
  tolerance `1e-12` with the existing scaled roundoff floor; solve/reaction
  relative tolerance `1e-9` with the existing `1e-12` absolute floor.
- Complete current arrays are additionally protected by exact deterministic
  hashes. No tolerance was widened to accept MITC4.
- Refinement assertions cover unchanged topology/load, finite results, solver
  convergence, sign and equilibrium, square symmetry, centre/max-deflection
  identity, and contraction of successive deflection changes.
- The refinement properties are not analytical reference values and do not
  validate the element, recovered moments, or recovered shear.
- MITC4's documented shear-recovery limitations remain relevant. Raw maxima
  require defined fixed-location extraction and later WP-004/end-stage
  comparison before engineering use.
- The pre-MITC4 SRI results were characterization of a rank-defective
  formulation, not validated results. The deliberate MITC4 changes also remain
  unvalidated pending WP-004, EF-005, the deferred Chartered Engineer review,
  and all end-stage verification/release gates.

Chartered Engineer review is required before these results are used for design,
assessment submission, warning removal, or release.
