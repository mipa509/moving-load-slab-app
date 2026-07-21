# Skew Implementation Status

## Current integration

- Integration hash: `4253976`
- Worktree: `C:\MyEngineering\04-Apps\moving-load-slab-app`
- Branch: `feat/skew-plate-analysis`
- Active wave/package: Wave 2A / WP-020 skew structured mesh and quality diagnostics plus WP-022 wheel-patch polygon generation; WP-004 and formal approvals remain deferred to the end-of-plan review register
- Package state: `G1 passed; WP-020 stopped cleanly at each lease boundary and is reissued under CD-WP020-001-R1/002; WP-022 remains active; G2 open`
- Gate state: G1 remains passed for implementation progression. WP-020 must pass before WP-021/WP-023; WP-022 may integrate independently but WP-024 remains blocked until WP-020, WP-022, and WP-023 pass. No physical-validation, standards-compliance, engineering-reliance, or release claim is authorized
- Worktree at dispatch: clean at `1060d4b` except user-owned untracked plan and frozen untracked WP-004 verification files

## Decision digests

- WP-001 has no prerequisites and is limited to restoring/recording the executable zero-skew baseline.
- Declared dependency versions and production/feature code are frozen for WP-001.
- Baseline fixtures are characterization evidence only, not physical validation.
- Non-zero-skew analysis remains experimental/screening-only; warning authority remains locked to G7/WP-065.
- Only the lead stages or commits. No commit is authorized until packet review and acceptance.
- The lead commits and pushes reviewed integration checkpoints to GitHub at each completed phase/gate before dispatching dependent work.
- WP-002 is documentation-only: derive conventions from current equations and behaviour without editing solver, app, report, types, fixtures, or the implementation plan.
- Current `rx/ry` names and report prose are evidence to reconcile, not authoritative physical definitions.
- Applied/load, displacement, plate-result, fixed/spring reaction, generalized-couple, support-axis, global-equilibrium, and mirror signs must be frozen through explicit virtual-work equations and testable predictions.
- If current code/report meanings cannot be reconciled, the ADR must require a later explicit conversion layer; WP-002 must not implement it.
- Proposed WP-002 frame: right-handed `ex x ey = ez`, with positive `ez`, `w`, wheel force, and pressure downward.
- Proposed kinematic mapping: current `[rx,ry] = [betaX,betaY]`; physical right-hand rotations are `phiX=-betaY`, `phiY=betaX`.
- Proposed conjugate-couple mapping: `Cx=-GbetaY`, `Cy=GbetaX`, fixed by virtual-work invariance.
- Proposed support-action convention: fixed `K*u-f` already has the external-action sign; raw spring `+k*u` requires later normalization to external action `-k*u`.
- Proposed signed equilibrium origin is the start-support centre `(0,W/2,0)`; support axes, tensor/vector separation, and full skew-mirror parity are specified in the ADR.
- Independent review rejected the proposed local mirror table: increasing-`t` reverses under the point mirror, so `tauMinus=-H*tauPlus` and `Aminus=H*Aplus*diag(1,-1)`. Local polar/generalized normal components are even and tangent components odd; local axial normal components are odd and tangent components even; `m_nn/m_tt` are even and `m_nt` is odd.
- The ADR correction must also separate generalized `beta/G` units from physical `phi/C`, add curvature/shear-strain and applied-generalized-couple mirror parity, and freeze point/total-line spring units and report/theory obligations.
- Correction applied: the ADR now derives the `S=diag(1,-1)` local mirror transforms, fixes all affected parities, separates generalized and physical units, adds the omitted global parity rows, freezes component/total-line spring units and Euclidean distribution, and records unit-bearing/Reissner-Mindlin presentation obligations.
- Mathematical re-review found no remaining sign, mirror, equilibrium, spring, unit, geometry, validation-status, or WP-001 contract defect; acceptance remains conditional on removing one notation collision and one public-field naming ambiguity.
- Final correction applied: curvature uses `K_curv`, generalized rotational spring stiffness uses `K_s^(beta)`, displacement outputs use `rotationX/rotationY`, and normalized physical action outputs use the distinct `coupleX/coupleY` fields.
- Final independent correction review passed with no critical, major, moderate, or minor findings; the mathematical/sign ADR is accepted.
- WP-002 checkpoint `7f4c77f` is pushed to GitHub; WP-003 and WP-004 prerequisites are satisfied.
- WP-003 owns only the shared data/API contract ADR. It may inspect all relevant boundaries but must not edit live types, adapters, app, solver, viewer, tests, or the implementation plan.
- WP-004 owns only the verification-source protocol and its documentation fixture-data directory. It must freeze source interpretation and the commercial-shell protocol before tolerances or observed comparison results.
- WP-003 passed independent architecture/numerical review after all type-safety, compatibility-bridge, persistence, warning, and package-ownership findings were closed. Its shared data/API ADR is accepted.
- WP-003 checkpoint `4236dcd` is pushed to GitHub; WP-005's sole prerequisite is satisfied.
- WP-005 is a serial compile-safe scaffold only: canonical/staged types and a focused type fixture; it must not activate `EdgeSupport`, change runtime behaviour, or consume the blocked WP-004 evidence.
- CD-WP005-001 is approved by the lead: replace the erased ambient support-normalizer value declaration with a callable type contract for WP-021; explicitly stage every colliding target app contract in `StagedSkewAppContract`; add the omitted generalized-support DOF union; remove inline target lookalikes; and strengthen compile fixtures. WP-032B promotes/removes the additional app collision members. Shared facade/result transport types remain app-owned for this scaffold; the solver's dependency is type-only and WP-026/WP-032A remove it when their boundaries activate.
- WP-005 passed independent correction re-review with no open findings. The scaffold is compile-safe, keeps every live app union/legacy contract unchanged, and consumes no WP-004 evidence.
- WP-005 checkpoint `020064b` is pushed to GitHub. G0 remains fail-closed solely on WP-004; Wave 1 is not dispatched.
- User/owner direction on 2026-07-21 defers WP-004 verification work until the end of implementation. `CD-G0-001` permits implementation packages to treat the code-contract prerequisites as satisfied, but it does not pass WP-004 or G0 verification evidence.
- Under `CD-G0-001`, published-benchmark, commercial-shell, physical-validation, standards-compliance, and release claims remain prohibited; the non-zero-skew experimental warning remains mandatory and G6/G7 cannot pass until WP-004 is completed and independently reviewed.
- WP-010 passed independent numerical review and checkpoint `799e190` is pushed to GitHub.
- `CD-WP012-001` is integrated: the mathematical kernel uses the open +/-90-degree domain, while WP-014B retains the app/persistence +/-45-degree limit and containment remains separate from total affine transforms.
- WP-012 passed independent correction review and checkpoint `6ed093c` is pushed to GitHub.
- WP-013 passed independent correction review after all five geometry/tolerance/immutability evidence findings were closed; checkpoint `8aa6c78` is pushed to GitHub.
- Wave 1A is accepted. G1 remains open until WP-011 passes; no G1 claim is made from WP-010/WP-012/WP-013 alone.
- `CD-WP014A-001` is approved: adding required live `skewAngleDeg` makes the typed `createDefaultModel` object invalid before WP-014B. WP-014A may add only the zero-valued field to that constructor as a compile bridge with no physical-behaviour change; WP-014B still exclusively owns sanitization, migration, range handling, and defaults tests.
- `CD-WP014A-002` is approved after the worker's lease stop: strict typing also reaches the sanitizer return and two mesh-sizing fixtures. WP-014A may carry only `fallback.skewAngleDeg` through the sanitizer and add explicit zero to those fixtures; it must not read, validate, clamp, or migrate imported skew input before WP-014B.
- WP-014A passed independent type/compatibility review with no findings and checkpoint `1a6eaf1` is pushed. WP-014B's sole prerequisite is now satisfied.
- WP-011 has produced EF-001 stop evidence: element nullity 5 versus 3 physical modes, assembled 2x2 nullity 4 versus 3, near-zero checkerboard energy, and CG breakdown at iteration zero. These are formulation failures, not tolerance failures; independent numerical review is mandatory before replacement selection.
- WP-014B stopped before edits on a persistence lease contradiction. The accepted ADR requires exact implicit-V1/explicit-V2 parsing before sanitization; permissive partial unversioned objects are not valid saved models. `CD-WP014B-001` narrowly adds the live App save call so every pre-WP-027 save can actually write V2.
- WP-011's corrected EF-001 failure-evidence packet passed independent review. The formulation verdict remains failed: the extra SRI hourglass modes are genuine and checkpoint `4d7d4f1` preserves the exact defect signature.
- WP-031A passed independent correction review with no remaining findings and checkpoint `2bc2e77` is pushed.
- EF-002 selected original Bathe-Dvorkin MITC4 behind the stable API. Independent numerical formulation review `EF-002-R1` and fixture-plan review `EF-002-R2` passed after correction.
- User/owner direction on 2026-07-21, recorded as `CD-EF002-001`, defers formal verification and human approvals to the end-of-plan review register. The outstanding Chartered Engineer review does not block EF-003 implementation, but it still blocks engineering reliance, warning removal, and release.
- Executable evidence of a wrong transform/sign, extra non-physical null mode, non-finite response, loss of positive definiteness, locking, or unstable recovery remains an immediate stop condition and cannot be deferred by CD-EF002-001.
- EF-003 implements original MITC4 with four covariant edge ties, full `2 x 2` bending/shear integration, direct ordered stiffness accumulation, and the same assumed-shear operator for recovery behind the unchanged three-DOF API.
- EF-003 focused tests pass 29/29 and independently confirm full-J transforms, exact three-mode nullity, positive checkerboard energy, solver progress/SPD, locking discrimination, affine mirror parity, non-affine refinement convergence, thick-patch response, and stiffness/recovery energy consistency.
- Independent EF-003 correction review passed with no remaining findings. The full suite has 259 passing tests and exactly two expected EF-004 stale zero-skew snapshot failures; no tolerance or snapshot was changed in EF-003.
- EF-004 deliberately rebaselined the complete zero-skew fixture without changing tolerances: `K[0,0]` increased 33.333333%, the coarse 2 by 2 centre deflection decreased 25%, the load vector and total vertical equilibrium were unchanged, and old/new arrays remain hash-traceable.
- EF-004 internal refinement solves at 2/4/8/16 elements per side all converged; centre-deflection changes contracted to 3.3081% at the final step. Moving raw moment/shear extrema were explicitly recorded as non-converged, non-release evidence.
- EF-004 passed independent numerical impact review with no findings and checkpoint `b4cbbec` is pushed. Formal WP-004/CEng/release review remains in the end-of-plan register.
- EF-005 successfully re-entered the main path: 11 available G1 suites passed 170/170. This is not a G1 pass because WP-015 translation and mesh-sizing behavior is still required.
- WP-015 selects physical skew-edge sizing: the centreline-span direction remains `lengthM`, while the transverse support-edge length is `widthM / cos(skewAngleDeg)`. This preserves exact zero-skew counts and approximately maintains the requested physical element size for both skew signs.
- WP-014B passed independent correction review after exact nested V2 and malformed-shape evidence was added; checkpoint `2430f6e` is pushed. WP-015's package prerequisite is satisfied but its mesh-integration work remains held by the Section 11/G1 block.
- WP-015 now normalizes the legacy solver slab fields once, propagates exact zero and signed skew through `fromAppModel`, and derives transverse target counts from WP-012's canonical physical support-edge length. Independent review passed with no findings; checkpoint `79ccf06` is pushed.
- G1 passed its independent internal gate audit at `79ccf06`: 11 focused files/188 tests, the full 33-file/281-test suite, strict TypeScript, and the 671-module Vite build passed. No known executable sign, transform, rank, non-finite, positive-definiteness, locking, recovery, or stability failure remains. Deferred formal approvals still prohibit engineering reliance, warning removal, or release.
- Wave 2A dispatches WP-020 and WP-022 from ledger checkpoint `1060d4b` under disjoint leases. WP-020 owns live mesh-type promotion, structured skew geometry, point-support forcing, and quality diagnostics; WP-022 owns staged patch polygon generation and deck clipping only. Any need to edit recovery, patch integration, shared contracts, or another package's files is a stop/deviation condition.
- `CD-WP020-001` resolves the literal AABB/centre acceptance conflict without crossing prerequisites: WP-020 must produce coordinate-identical element polygons, containing metadata AABBs, and a tested Q4 `(0,0)` centre utility. WP-024 remains the sole owner that replaces AABB load integration, and WP-030 remains the sole owner that activates Q4 centres in recovery. Until both consumer packets pass, no nonzero-skew load/recovery correctness claim is permitted.
- `CD-WP020-002` extends WP-020 only to the existing typed mechanical element fixtures reached by required `MeshNode.s/t` promotion. Those edits may add deterministic local-coordinate fields and update promoted type references only; element equations, numerical inputs/outputs, snapshots, hashes, tolerances, and assertions remain frozen.
- `CD-WP020-001-R1` supersedes the initial consumer deferral after independent preflight identified an unsafe transient public path. WP-020 now also owns three narrow safety/correctness edits: Q4-centre use in `recover.ts`, fail-closed rejection of non-rectangular element AABB loading in `patch.ts`, and a temporary nonzero-skew public-solve guard in `runFixedPositionAnalysis.ts`. WP-024 still exclusively owns polygon integration; WP-026 removes the public guard only after its prerequisites pass.

## Packet states

| Packet | State | Owner | Prerequisite/gate note |
|---|---|---|---|
| WP-001 | `passed` | lead/integrator; independent review accepted | none |
| WP-002 | `passed` | lead/integrator; independent mathematical review accepted | WP-001 passed at `e990eb5` |
| WP-003 | `passed` | data/API contract architecture worker; independent architecture review accepted | checkpoint `4236dcd` pushed |
| WP-004 | `deferred_verification` | engineering reference-data worker; independent source review | owner deferred missing external evidence until end; not passed and still required before G6/G7/release |
| WP-005 | `passed` | lead/contract integrator correction worker; independent architecture/code review accepted | checkpoint `020064b` pushed; CD-G0-001 authorizes provisional downstream implementation |
| WP-010 | `passed` | Q4 geometry worker; independent numerical review accepted | checkpoint `799e190` pushed |
| WP-012 | `passed` | deck-coordinate geometry correction worker; independent correction review accepted | checkpoint `6ed093c` pushed; CD-WP012-001 integrated |
| WP-013 | `passed` | lead correction under original geometry lease; independent computational-geometry correction review accepted | checkpoint `8aa6c78` pushed |
| WP-011 | `failed` | numerical element stability worker; independent numerical failure review accepted | genuine extra zero-energy modes; replacement required |
| WP-014A | `passed` | app schema worker; independent type/compatibility review accepted | checkpoint `1a6eaf1` pushed; CD-WP014A-001/002 integrated |
| WP-014B | `passed` | migration worker; independent migration/compatibility correction review accepted | checkpoint `2430f6e` pushed; CD-WP014B-001 integrated |
| WP-031A | `passed` | numerical convention worker; independent numerical review accepted | checkpoint `2bc2e77` pushed |
| EF-001 | `passed` | numerical failure-evidence worker; independent numerical review accepted | checkpoint `4d7d4f1` pushed; evidence accepted, formulation not accepted |
| EF-002 | `passed_for_implementation` | replacement-formulation architecture worker; independent numerical formulation and fixture-plan reviews accepted | original MITC4 selected; CEng suitability approval deferred to end-of-plan review under CD-EF002-001 |
| EF-003 | `passed` | MITC4 implementation worker; independent numerical/code correction review accepted | checkpoint `0088e11` pushed; two deliberate stale snapshots handed to EF-004 |
| EF-004 | `passed` | zero-skew rebaseline worker; independent numerical impact review accepted | checkpoint `b4cbbec` pushed; complete old/new evidence and limitations recorded |
| EF-005 | `passed_reentry` | lead/integrator computational re-entry | available G1 suites passed 170/170; main path re-entered at WP-015, not a G1 pass |
| WP-015 | `passed` | app/solver boundary worker; independent architecture/numerical review accepted | checkpoint `79ccf06` pushed; exact normalization and canonical physical-edge sizing accepted; G1 passed |
| WP-020 | `reissued` | mesh worker; independent numerical/architecture review required | worker stopped before edits at every discovered lease boundary; CD-WP020-001-R1/002 approved; fail-closed atomic lease reissued from `04ff9db`; WP-021/WP-023 blocked |
| WP-022 | `dispatched` | load-geometry worker; independent computational-geometry review required | WP-012/WP-013/WP-015 and patch contract passed; exclusive vehicle/polygon-test lease active from `1060d4b`; WP-024 blocked |

## File leases

| Holder | Mode | Exclusive scope | State |
|---|---|---|---|
| WP-002 numerical architecture worker | write | `docs/adr/ADR-skew-mathematical-conventions.md` only | released; initial ADR delivered, later sandbox-blocked correction supplied as exact patch text |
| Lead/integrator | write/integration | `docs/skew-implementation-status.md`; repository staging/commit/push | active; all worker files read-only to lead until handoff |
| WP-002 fresh numerical reviewer | read-only | ADR and directly relevant equations/code evidence | released; final recommendation `pass` with no open findings |
| WP-003 data/API contract worker | write | `docs/adr/ADR-skew-data-api-contracts.md` only | ownership-correction lease released; partial handoff completed by lead mechanical sync |
| WP-004 reference-data worker | write | `docs/verification/skew-verification-source-protocol.md` and `docs/verification/fixtures/skew/**` only | released; locally reviewed files frozen pending external unblock |
| WP-003 fresh architecture reviewer | read-only | WP-003 ADR, accepted mathematical ADR, plan Section 5, and directly relevant live boundaries | released; final recommendation `pass`, no open findings |
| WP-004 fresh source reviewer | read-only | WP-004 protocol/data, cited primary/official sources, source-status and shell-contract consistency | released; local corrections `pass`, WP-004/G0 `fail` on retained blockers |
| WP-005 contract integrator worker | write | `src/solver/geometry/types.ts`, `src/solver/model/types.ts`, `src/app/types.ts`, `src/tests/skewContractScaffold.test.ts` only | released; handoff complete, files write-frozen for review |
| WP-005 fresh architecture/code reviewer | read-only | WP-005 leased files, accepted contract/sign ADRs, WP-005 plan/ledger, and directly relevant import boundaries | released; initial recommendation `fail` with five correction areas |
| Lead CD-WP005-001 contract correction | write/integration | `docs/adr/ADR-skew-data-api-contracts.md` and ledger only | released; amendment synchronized and frozen for correction review |
| WP-005 correction worker | write | `src/solver/model/types.ts`, `src/app/types.ts`, `src/tests/skewContractScaffold.test.ts` only; geometry file remains frozen | released; corrected handoff complete and files write-frozen |
| WP-005 independent correction reviewer | read-only | corrected WP-005 files, CD-WP005-001 ADR amendment, ledger, and directly relevant boundaries | released; final recommendation `pass`, no open findings |
| WP-010 Q4 geometry worker | write | `src/solver/core/element.ts`, new `src/solver/core/q4Geometry.ts`, new `src/tests/q4Geometry.test.ts` only | released; handoff complete, files write-frozen for review |
| WP-012 deck-coordinate worker | write | new `src/solver/geometry/deckCoordinates.ts`, new `src/tests/deckCoordinates.test.ts` only | released; handoff complete, files write-frozen for review |
| WP-013 convex-polygon worker | write | new `src/solver/geometry/convexPolygon.ts`, new `src/tests/convexPolygon.test.ts` only | released; handoff complete, files write-frozen for review |
| WP-012 fresh geometry reviewer | read-only | WP-012 files, canonical geometry contracts, accepted mathematical/data ADRs, plan and ledger | released; correction re-review `pass`, no open findings |
| WP-013 fresh computational-geometry reviewer | read-only | WP-013 files, canonical polygon contracts, patch obligations, plan and ledger | released; correction re-review `pass`, no open findings |
| WP-010 fresh numerical reviewer | read-only | WP-010 files, current/accepted element conventions, zero-skew fixture, plan and ledger | released; recommendation `pass`, no open findings |
| Lead CD-WP012-001 contract clarification | write/integration | `docs/adr/ADR-skew-data-api-contracts.md` and ledger only | released; amendment synchronized and frozen for correction review |
| WP-012 correction worker | write | `src/solver/geometry/deckCoordinates.ts`, `src/tests/deckCoordinates.test.ts` only | released; corrected handoff complete and accepted |
| Lead WP-013 correction | write/integration | `src/solver/geometry/convexPolygon.ts`, `src/tests/convexPolygon.test.ts` only | released; bounded correction completed after agent thread limit; independently accepted |
| WP-011 numerical stability worker | write | `src/tests/helpers/elementStabilityDiagnostics.ts`, `src/tests/elementStability.test.ts` only | released; EF-001 evidence corrected, independently accepted, and pushed |
| WP-011 independent numerical reviewer | read-only | WP-011 diagnostics, accepted element kernel/ADRs, plan WP-011 and Section 11 | released; confirmed genuine hourglass modes; corrected EF-001 packet `pass`, formulation `fail` |
| WP-014A app schema worker | write | `src/app/types.ts`; narrow `src/app/defaults.ts` bridges; `src/tests/vehiclePlacement.test.ts`; `src/tests/skewContractScaffold.test.ts`; mechanical `src/tests/meshSizing.test.ts` fields | released; corrected handoff independently accepted and pushed |
| WP-014A independent type/compatibility reviewer | read-only | WP-014A files, ADR ownership, and CD-WP014A-001/002 | released; recommendation `pass`, no findings |
| WP-014B migration worker | write | `src/app/defaults.ts`, `src/tests/defaults.test.ts`, and one import/save-call bridge in `src/app/App.tsx` | released; corrected handoff independently accepted and pushed |
| WP-014B independent migration/compatibility reviewer | read-only | WP-014B parser/serializer/tests, ADR snapshots, and narrow App diff | released; correction re-review `pass`, no findings |
| WP-031A numerical convention worker | write | `src/solver/post/reactionMomentMapping.ts`, `src/tests/reactionMomentMapping.test.ts` only | released; corrected handoff independently accepted and pushed |
| WP-031A independent numerical reviewer | read-only | WP-031A mapping/tests and accepted mathematical ADR | released; signed-zero correction re-review `pass`, no findings |
| EF-002 replacement-formulation architecture worker | write/research | new `docs/adr/ADR-plate-element-formulation-replacement.md` only | released; original MITC4 selected and review corrections integrated |
| EF-002 independent numerical reviewers | read-only | formulation equations/API boundary and EF-003 fixture plan | released; `EF-002-R1` formulation pass and `EF-002-R2` fixture-plan pass |
| EF-003 MITC4 implementation worker | write | `src/solver/core/element.ts`, new `src/solver/core/mitc4.ts`, new `src/tests/mitc4Element.test.ts`, `src/tests/elementStability.test.ts`, `src/tests/helpers/elementStabilityDiagnostics.ts` only | released; implementation and correction handoffs accepted at checkpoint `0088e11` |
| EF-003 independent numerical/code reviewer | read-only | exact five-file diff, accepted MITC4 ADR, and hard numerical/test-independence criteria | released; initial conditional findings corrected; final recommendation `pass`, no findings |
| EF-004 zero-skew rebaseline worker | write | `src/solver/benchmarks/zeroSkewCharacterizationFixture.ts`, `src/tests/zeroSkewCharacterization.test.ts`, `src/tests/q4Geometry.test.ts`, new `src/tests/zeroSkewRebaseline.test.ts`, new `docs/ef004-zero-skew-rebaseline.md` only | released; accepted and pushed at `b4cbbec` |
| EF-004 independent numerical impact reviewer | read-only | exact five-file rebaseline diff, pre/current commits, old/new values, hashes, convergence, and engineering limitations | released; recommendation `pass`, no findings |
| EF-005 lead/integrator | verification/integration | no production write lease; tests/build and ledger only | released; available G1 focused evidence passed and WP-015 identified as the remaining executable gate item |
| WP-015 app/solver boundary worker | write | `src/solver/model/fromAppModel.ts`, `src/app/meshSizing.ts`, `src/tests/meshSizing.test.ts` only | released; accepted and pushed at `79ccf06` |
| WP-015 independent architecture/numerical reviewer | read-only | exact three-file diff, accepted geometry/mesh-sizing policy, compatibility, and focused evidence | released; recommendation `pass`, no findings |
| G1 lead/integrator and independent gate reviewer | verification/integration | committed Wave 1 tree, all G1 focused/numerical suites, full suite, build, and repository integrity | released; internal implementation-progression gate `pass` at `79ccf06` |
| WP-020 mesh worker | write | `src/solver/model/types.ts`, `src/solver/core/mesh.ts`, new `src/solver/core/meshQuality.ts`, `src/solver/benchmarks/zeroSkewCharacterizationFixture.ts`, `src/solver/post/recover.ts` centre lines only, `src/solver/loads/patch.ts` non-rectangular guard only, `src/solver/runFixedPositionAnalysis.ts` temporary nonzero-skew guard only, new `src/tests/mesh.test.ts`, `src/tests/recoverNodal.test.ts`, `src/tests/skewContractScaffold.test.ts`, `src/tests/q4Geometry.test.ts`, `src/tests/mitc4Element.test.ts`, `src/tests/elementStability.test.ts`, `src/tests/helpers/elementStabilityDiagnostics.ts`, `src/tests/solverSmoke.test.ts` only | all prior leases stopped with zero edits; reissued under CD-WP020-001-R1/002 from `04ff9db`; mechanical fixtures and three narrow fail-closed/correctness integrations only; no support/facade/app/ADR edits |
| WP-022 load-geometry worker | write | `src/solver/loads/vehicle.ts`, new `src/tests/vehiclePatchGeometry.test.ts` only | active from `1060d4b`; staged polygon generation/clipping only; no patch integration/type promotion/viewer edits |

WP-003 and WP-004 leases are disjoint. Source, test, configuration, package, report, live type, app, solver, viewer, and user-owned files are outside both scopes.

## Exact command outcomes

| Command | Outcome |
|---|---|
| `git rev-parse HEAD` | exit 0; `231481ea8b00a70755b7eed7c97145ebc137b1eb` |
| `git status --short` | exit 0; `?? docs/2026-07-21-skew-plate-analysis-implementation-plan.md` before ledger creation |
| `node --version` | exit 0; `v25.7.0` |
| `npm.cmd --version` | exit 0; `11.10.1` |
| `[System.Environment]::OSVersion.VersionString` | exit 0; `Microsoft Windows NT 10.0.26200.0` |
| `[System.Runtime.InteropServices.RuntimeInformation]::OSDescription` | exit 0; `Microsoft Windows 10.0.26200` |
| `Test-Path node_modules` | exit 0; absent before `npm.cmd ci` |
| `npm.cmd ci` | exit 0; 147 packages installed, 148 audited in 72.4 s; manifests/lock unchanged; 5 vulnerabilities reported |
| `npm.cmd test` pre-change, restricted sandbox | exit 1 after 8.7 s; Vite config load failed because esbuild spawn returned `EPERM` |
| `npm.cmd test` pre-change, permitted execution | exit 0; 24 files and 100 tests passed; duration 5.85 s |
| `npm.cmd run build` pre-change, restricted sandbox | exit 1 after 59.2 s; esbuild spawn returned `EPERM` |
| `npm.cmd run build` pre-change, permitted execution | exit 0; 668 modules transformed; built in 13.96 s |
| `npm.cmd test -- src/tests/zeroSkewCharacterization.test.ts` worker observation | exit 0; 1 file and 1 diagnostic test passed; duration 1.12 s |
| `npm.cmd test -- src/tests/zeroSkewCharacterization.test.ts` first fixed assertion | exit 1; exact object equality exposed only `1.225e-5` floating representation; corrected to the predeclared solve tolerance |
| `npm.cmd test -- src/tests/zeroSkewCharacterization.test.ts` final | exit 0; 1 file and 1 test passed; duration 1.18 s |
| `npm.cmd test` post-change | exit 0; 25 files and 101 tests passed; duration 7.24 s |
| `npm.cmd run build` post-change | exit 0; 668 modules transformed; built in 11.65 s; existing large-chunk warning remains |
| `npm.cmd test -- src/tests/zeroSkewCharacterization.test.ts` after review correction | exit 0; 1 file and 1 test passed; duration 1.09 s |
| `npm.cmd test` after review correction | exit 0; 25 files and 101 tests passed; duration 3.65 s |
| `npm.cmd run build` after review correction | exit 0; 668 modules transformed; built in 15.88 s; existing large-chunk warning remains |
| Independent reviewer focused recheck | exit 0; 1 file and 1 test passed; duration 1.17 s |
| `git diff --check` | exit 0 after intent-to-add of only the three leased WP-001 files; no whitespace errors |
| WP-002 worker `git status --short` | exit 0; lead-modified ledger, preserved untracked plan, and new ADR directory only |
| WP-002 worker no-index ADR whitespace check | exit 1 expected for a new file; no output and no whitespace errors |
| WP-002 build/tests | not run; Markdown-only ADR and no source/test/package change |
| WP-002 lead `git diff --check` | exit 0 after ADR intent-to-add and ledger update; no whitespace errors |
| WP-002 independent review | `fail`; critical mirror-basis/parity error, major unit-label conflict, and two moderate completeness/semantics findings |
| WP-002 correction worker `apply_patch` | failed before file access with the Windows split-root sandbox error; no worker edit made |
| WP-002 independent mathematical re-review | `conditional`; all original mathematical findings corrected; moderate `K_beta` notation collision and minor rotation/action field-name ambiguity remained |
| WP-002 final localized correction | exit 0; curvature/spring notation separated and kinematic/action public fields given distinct names |
| WP-002 final independent correction review | `pass`; no critical, major, moderate, or minor findings; no mathematical regression found |
| WP-002 checkpoint commit | exit 0; `7f4c77f`; `docs: freeze skew mathematical conventions`; ADR and ledger only |
| `git push` after WP-002 | exit 0; `e990eb5..7f4c77f` pushed to `origin/feat/skew-plate-analysis`; remote relocation notice only |
| WP-003 worker ADR checks | exit 0; leased file `git diff --check` and explicit trailing-whitespace scan clean; Markdown-only tests/build deferred to lead |
| WP-003 independent architecture review | `fail`; two critical, four major, and one moderate contract-completeness/type-safety finding group; mathematical signs passed |
| WP-003 correction checks | exit 0; no-index whitespace and trailing scan clean; stale-pattern scan clean; 34 Markdown fences balanced |
| WP-003 independent correction re-review | `fail`; first findings mostly closed, but staged aggregate materialization, intermediate geometry/mesh/support bridges, immutable persistence/section versioning, line reaction axes/mixed attribution, and success warning/quality correlation remain |
| WP-003 second correction checks | exit 0; no-index whitespace, trailing, fence, stale-pattern, scope/status, and baseline checks pass; one context-miss patch made no change before narrower success |
| WP-003 final architecture re-review | `fail`; revised types/signs pass, but WP-032B/C section persistence ordering, one undefined geometry bridge, and WP-021/WP-022 promotion owners conflict with declared leases |
| WP-003 ownership-correction checks | worker no-index/trailing/fence/status checks pass; lead removed only listed stale owner/version rows and re-ran no-index whitespace/stale-owner scan clean |
| WP-003 ownership re-review | `fail`; ownership chain passed except missing legacy envelope worst-station shape and unassigned Viewport/ResultSurface/App compatibility consumers |
| WP-003 final compatibility correction | lead added exact legacy worst-station types and assigned Viewport to WP-041B plus ResultSurface/non-print App migration to WP-050's plan-authorized minimal integration lease; no-index whitespace clean |
| WP-003 final independent compatibility re-review | `pass`; no findings; complete production consumer audit and clean no-index/trailing checks |
| `npm.cmd test` after WP-003 acceptance | exit 0; 25 files and 101 tests passed; Vitest duration 9.40 s |
| `npm.cmd run build` after WP-003 acceptance | exit 0; 668 modules transformed; built in 21.08 s; existing greater-than-500-kB chunk warning remains |
| WP-003 checkpoint staging request | rejected before execution by approval service because the session usage limit was reached; nothing staged, committed, or pushed; no bypass attempted |
| WP-003 checkpoint staging retry | exit 0 after explicit user retry request; staged only the accepted WP-003 ADR and ledger; plan and WP-004 files excluded |
| WP-003 checkpoint commit/push | exit 0; commit `4236dcd`; pushed `7f4c77f..4236dcd` to `origin/feat/skew-plate-analysis`; remote relocation notice only |
| WP-005 focused fixture final | exit 0; 1 file and 4 tests passed; duration 1.18 s |
| WP-005 full test final | exit 0; 26 files and 105 tests passed; duration 7.97 s |
| WP-005 build final | exit 0; TypeScript passed; 668 modules transformed; built in 9.17 s; existing large-chunk warning remains |
| WP-005 leased diff checks | exit 0; tracked/no-index whitespace checks clean; line-ending warnings only |
| WP-005 independent architecture/code review | `fail`; ambient erased value export, incomplete collision staging, omitted generalized-support DOF union, undocumented type-layer direction, and weak critical compile assertions |
| `npx.cmd tsc -b` after CD-WP005-001 | exit 0; completed in 16.9 s |
| WP-005 focused fixture after CD-WP005-001 | restricted run hit known esbuild `spawn EPERM`; permitted run exit 0; 1 file and 5 tests passed; duration 1.47 s |
| WP-005 full test after CD-WP005-001 | permitted run exit 0; 26 files and 106 tests passed; duration 5.79 s |
| WP-005 build after CD-WP005-001 | permitted run exit 0; TypeScript passed; 668 modules transformed; built in 11.59 s; existing large-chunk warning remains |
| WP-005 corrected diff checks | exit 0; tracked/no-index whitespace checks clean; line-ending warnings only; stale ambient/inline-lookalike scan clean |
| WP-005 independent correction re-review | `pass`; all five initial finding areas closed; no remaining critical, major, moderate, or minor findings |
| WP-005 lead full-test rerun | restricted run hit known esbuild `spawn EPERM`; permitted rerun exit 0; 26 files and 106 tests passed; duration 6.52 s |
| WP-005 lead build rerun | permitted rerun exit 0; TypeScript passed; 668 modules transformed; Vite built in 14.72 s; existing large-chunk warning remains |
| WP-005 lead final scope/whitespace check | exit 0; only accepted tracked WP-005/ADR/ledger paths modified; untracked plan and WP-004 files remain excluded; line-ending warnings only |
| WP-005 checkpoint commit/push | exit 0; commit `020064b`; pushed `4236dcd..020064b` to `origin/feat/skew-plate-analysis`; remote relocation notice only |
| CD-G0-001 governance checkpoint | exit 0; commit `b412ce7`; pushed `b304e83..b412ce7` to `origin/feat/skew-plate-analysis`; remote relocation notice only |
| WP-012 focused final | exit 0; 1 file and 20 tests passed; duration 1.33 s; first permitted run had one test-helper-only failure corrected without production change |
| WP-012 concurrent full test/build | exit 0; 28 files and 137 tests passed; TypeScript passed; 669 modules transformed; Vite built in 20.56 s; existing large-chunk warning remains |
| WP-013 focused final | exit 0; 1 file and 11 tests passed; duration 1.24 s |
| WP-013 concurrent full test/build | exit 0; 28 files and 137 tests passed; TypeScript passed; 669 modules transformed; Vite built in 21.00 s; existing large-chunk warning remains |
| WP-010 focused Q4 final | exit 0; 1 file and 8 tests passed; restricted startup separately hit known esbuild `spawn EPERM` |
| WP-010 zero-skew characterization | exit 0; 1 file and 1 test passed unchanged within the recorded stiffness policy |
| WP-010 concurrent full test/build | exit 0; 29 files and 145 tests passed; TypeScript passed; 669 modules transformed; existing large-chunk warning remains |
| WP-010 independent numerical review | `pass`; J^-T derivation, genuinely sheared oracle, node order, determinant rejection, unchanged integration rules, symmetry metric, and zero-skew tolerance all accepted; no findings |
| WP-012 independent geometry review | `fail`; kernel incorrectly froze app-only +/-45-degree limit, sign oracle was partly self-referential, scale evidence was narrow, and off-deck transform ownership was undocumented |
| WP-013 independent computational-geometry review | `fail`; self-intersecting rings accepted, absolute offset dominated tolerance, near-duplicate canonicalization was traversal-dependent, return aliases were mutable, and one conservation test was self-referential |
| WP-004 worker protocol checks | exit 0; three JSON files parsed; leased documentation/data `git diff --check` and trailing-whitespace scan clean |
| WP-004 independent source review | `fail`; fail-closed numeric/source qualification passed, but source access, instantiated shell case, tolerance timing, author order, controlled states, and one access classification require resolution |
| WP-004 correction checks | exit 0; three JSON files parse; 22 controlled unverified transcription records; all four no-index whitespace checks clean |
| WP-004 independent correction re-review | local `pass`; no local findings; WP-004/G0 `fail` pending originals, V28 authority, and instantiated pre-results shell case |
| WP-010 checkpoint commit/push | exit 0; commit `799e190`; pushed `b412ce7..799e190` to `origin/feat/skew-plate-analysis`; remote relocation notice only |
| WP-012 corrected focused/full/build | exit 0; focused 34 tests, full 29 files/162 tests, TypeScript and 669-module Vite build passed; existing chunk warning remains |
| WP-012 independent correction re-review | `pass`; all four original findings closed; no remaining findings |
| WP-012 checkpoint commit/push | exit 0; commit `6ed093c`; pushed `799e190..6ed093c` to `origin/feat/skew-plate-analysis`; remote relocation notice only |
| WP-013 corrected focused/full/build | exit 0; focused 14 tests, integrated full 29 files/162 tests, TypeScript and 669-module Vite build passed; existing chunk warning remains |
| WP-013 independent correction re-review | `pass`; all five original findings closed, including additional cyclic/remote/mutation/analytic probes; no remaining findings |
| WP-013 checkpoint commit/push | exit 0; commit `8aa6c78`; pushed `6ed093c..8aa6c78` to `origin/feat/skew-plate-analysis`; remote relocation notice only |
| Wave 1A ledger checkpoint | exit 0; commit `d078b76`; pushed `8aa6c78..d078b76` to `origin/feat/skew-plate-analysis`; remote relocation notice only |
| WP-014A initial strict typecheck | exit 2; required skew missing from sanitizer return and two mesh-sizing fixtures; worker stopped at lease boundary |
| WP-014A corrected strict/focused/build | exit 0; strict typecheck passed, focused 3 files/13 tests passed, 669-module build passed; full suite passed all unrelated 29 files/172 tests and failed only active WP-011 diagnostics |
| WP-014A independent review | `pass`; canonical required type, staging removal, exact compile bridges, heading independence, and no WP-014B scope leakage confirmed; no findings |
| WP-014A checkpoint commit/push | exit 0; commit `1a6eaf1`; pushed `d79ecef..1a6eaf1` to `origin/feat/skew-plate-analysis`; remote relocation notice only |
| WP-011 initial EF-001 audit | focused/full exit 1 with 10 passing and 6 intentional acceptance failures; element nullity 5/3, assembled nullity 4/3, checkerboard normalized energy near zero, and CG breakdown at iteration zero; build/diff checks passed |
| WP-014B pre-edit stop | no files changed; worker identified unleased direct App save and apparent conflict between strict ADR snapshots and permissive legacy sanitizer tests; lead resolved via ADR authority and CD-WP014B-001 |
| WP-031A corrected focused/full/build | exit 0; focused 13 tests, full 31 files/214 tests, and build passed; signed-zero review correction accepted |
| WP-031A checkpoint commit/push | exit 0; commit `2bc2e77`; pushed `ac8524d..2bc2e77` to `origin/feat/skew-plate-analysis`; remote relocation notice only |
| WP-011 corrected EF-001 focused/full/build | exit 0; focused 21 tests including six narrowly scoped expected failures, full 31 files/214 tests, and build passed |
| WP-011 independent correction review | EF-001 evidence `pass`, formulation `fail`; exact defect signatures accepted and EF-002 required |
| EF-001 checkpoint commit/push | exit 0; commit `4d7d4f1`; pushed `2bc2e77..4d7d4f1` to `origin/feat/skew-plate-analysis`; remote relocation notice only |
| WP-014B initial focused/full/build | exit 0; focused 23 tests, full 31 files/214 tests, strict typecheck, and 669-module build passed |
| WP-014B independent initial review | `fail`; production accepted but independent full nested V2 oracle, point-support serialization, and malformed-shape matrix were missing |
| WP-014B corrected focused/full/build | exit 0; focused 62 tests, full 31 files/253 tests, strict typecheck, and 669-module build passed |
| WP-014B independent correction re-review | `pass`; complete V2 oracle, line/point preservation, structural rejection precedence, skew policy, and narrow App scope accepted; no findings |
| WP-014B checkpoint commit/push | exit 0; commit `2430f6e`; pushed `5181458..2430f6e` to `origin/feat/skew-plate-analysis`; remote relocation notice only |
| EF-002 initial ADR | original Bathe-Dvorkin MITC4 selected conditionally after documented comparison with DKMQ, bilinear DSG4, and stabilized MITC4 |
| EF-002 independent review `EF-002-R1` | formulation equations/API boundary `pass`; fixture plan required corrections for full-J transform oracles, non-affine refinement families, direct accumulation, and source traceability |
| EF-002 reviewed corrections | full-J rotated/sheared fixture, all tying-point and non-central transform checks, shape-regular non-affine families with Jacobian diagnostics, direct all-144-entry accumulation, separated recovery/operator scoring, and corrected primary-source locators integrated |
| EF-002 independent re-review `EF-002-R2` | fixture plan `pass`; formulation remains `pass`; only separate CEng suitability approval remained outstanding |
| EF-002 final documentation checks | no-index `git diff --check` clean; Markdown fence count even; no benchmark expected values or production/test edits introduced |
| EF-002 checkpoint commit/push | exit 0; commit `352556d`; pushed `03016e3..352556d` to `origin/feat/skew-plate-analysis`; remote relocation notice only |
| EF-003 initial focused run | 22/26 passed; stale EF-001 assertions exposed corrected element/assembled nullity 3 and positive checkerboard energy; invalid one-node locking oracle identified and replaced without tolerance widening |
| EF-003 corrected focused run | exit 0; 2 files/29 tests passed, including independent full-J, mirror, raw-locking discriminator, warped convergence, thick-patch, and recovery-energy evidence |
| EF-003 full suite | 30 files/259 tests passed; exactly two expected EF-004 stale zero-skew snapshot failures in `q4Geometry.test.ts` and `zeroSkewCharacterization.test.ts`; first stiffness entry old `1562500`, MITC4 `2083333.3333333335`, absolute difference `520833.3333333335` |
| EF-003 final build | exit 0; strict TypeScript and 670-module Vite build passed; pre-existing greater-than-500-kB chunk warning remains |
| EF-003 independent initial review | production formulation `pass`; packet `conditional` on edge-swap oracle independence, independent raw comparator, affine mirror, warped-load convergence, thick assembled patch, and conditioning-label corrections |
| EF-003 independent correction re-review | `pass`; every finding closed, 29/29 independent focused rerun passed, no Critical/High/Moderate/Minor findings |
| EF-003 final scope/diff checks | exactly five leased files; tracked and no-index whitespace checks clean; control-byte scans zero; user plan and frozen WP-004 paths untouched |
| EF-003 checkpoint commit/push | exit 0; commit `0088e11`; pushed `352556d..0088e11` to `origin/feat/skew-plate-analysis`; remote relocation notice only |
| EF-004 focused/full/build | focused 3 files/11 tests passed; full 33 files/263 tests passed; strict TypeScript and 670-module Vite build passed; existing chunk warning only |
| EF-004 independent numerical impact review | `pass`; old/current provenance, complete hashes, stiffness delta, reactions/signs, tolerances, refinement table, and limitations independently confirmed; no findings |
| EF-004 final scope/diff checks | exactly five leased files; tracked/no-index whitespace and control-byte scans clean; production, ledger, plan, and WP-004 files untouched by worker |
| EF-004 checkpoint commit/push | exit 0; commit `b4cbbec`; pushed `ba3e89d..b4cbbec` to `origin/feat/skew-plate-analysis`; remote relocation notice only |
| EF-005 available G1 focused suites | exit 0; 11 files/170 tests passed: inverse-transpose/Q4, MITC4/stability, zero-skew characterization/rebaseline, deck coordinates, polygon, reaction mapping, migration/contracts, and current mesh sizing |
| WP-015 focused/full/build | focused 1 file/20 tests passed; full 33 files/281 tests passed; strict TypeScript and 671-module Vite build passed; existing greater-than-500-kB chunk warning only |
| WP-015 independent review | `pass`; exact three-file lease, canonical normalization, absent exact positive zero, 0/+/-19/+/-45 propagation and sizing, shared WP-012 edge source, zero-count preservation, sign parity, heading/travel independence, and compatibility confirmed; no findings |
| WP-015 checkpoint commit/push | exit 0; commit `79ccf06`; pushed `42bda86..79ccf06` to `origin/feat/skew-plate-analysis`; remote relocation notice only |
| G1 focused suites | exit 0; 11 files/188 tests passed: inverse-transpose/Q4, MITC4/stability, zero-skew characterization/rebaseline, deck coordinates, polygon, reaction mapping, migration/contracts, and completed mesh sizing/translation |
| G1 full suite/build | exit 0; 33 files/281 tests passed; strict TypeScript and 671-module Vite build passed; existing greater-than-500-kB chunk warning only |
| G1 independent gate audit | `pass` at `79ccf06`; every executable criterion supported, repository integrity clean, and no hard-stop numerical defect remains; formal WP-004/CEng/release items remain deferred |

## Gate evidence and tolerances

- Fixture `zero-skew-rectangular-v1`: 2 m by 2 m by 0.3 m slab; 2 by 2 mesh; 30 GPa, Poisson ratio 0.2; four fixed perimeter lines; central 100 kN, 0.5 m square patch.
- Characterized values: complete 12 by 12 element stiffness; complete 27-DOF assembled patch vector; nine nodal displacements; current signed vertical reaction rows; solve summary and diagnostics.
- Nodal `w`, `rx`, and `ry`, numeric residual diagnostics, solve summary, and signed equilibrium all use the declared iterative comparison policy; booleans, counts, IDs, and coordinates remain exact.
- Pure stiffness/load comparison: relative tolerance `1e-12`; absolute floor `128 * Number.EPSILON * max(abs(expected))`. This gives about `4.44e-8` at the stiffness scale and `2.18e-12` at the load-vector scale.
- Iterative solve/reaction comparison: relative tolerance `1e-9`; absolute floor at least the fixture CG absolute tolerance `1e-12`. Fixture CG settings are relative `1e-10`, absolute `1e-12`, maximum 3000 iterations.
- EF-004 old/new zero-skew comparison: applied vertical load remains `+100 kN`; deduplicated vertical reaction remains `-100 kN`; coarse centre-node `w` changed from `+1.225e-5 m` to `+9.1875e-6 m`; `K[0,0]` changed from `1562500` to `2083333.3333333335`; one-iteration convergence remains.
- Executable coverage: mesh/support mapping in `supports.test.ts`; nodal recovery in `recoverNodal.test.ts`; solve and vertical equilibrium in `solverSmoke.test.ts`; direct element/load/solve/nodal-displacement/reaction characterization in `zeroSkewCharacterization.test.ts`.
- `TRANSFER_SLAB_BENCHMARK_FIXTURE` is metadata-only: it references an external notebook path and has no executable test/runner consumer in this repository.
- Characterization is current numerical behaviour only; it is not physical, formulation, or published-benchmark validation.
- Independent WP-001 review recommendation: `pass`; no open findings or required corrections.
- G0 is not eligible for review from WP-001 alone.

## Risks and deviations

- `node_modules` was absent at dispatch; dependency restoration is required before a green baseline can be claimed.
- Node `v25.7.0` is the observed runtime; compatibility is not assumed until tests/build execute.
- Compatibility observation is now green for the recorded suite/build only; no Node support-range claim is made.
- Restricted execution prevents esbuild child-process startup (`EPERM`); permitted reruns pass. This is an environment constraint, not a repository test failure.
- `npm.cmd ci` reported 5 vulnerabilities and a `three-mesh-bvh` deprecation. Dependency/security remediation is outside WP-001 and no version was changed.
- The production build retains its pre-existing greater-than-500-kB chunk warning; performance work is outside WP-001.
- WP-001's exact floating-point findings are closed; its correction passed focused/full/build checks and independent re-review.
- The implementation-plan document is untracked user work and must be preserved unchanged.
- Contract deviation integrated and closed: `CD-WP005-001`.
- Decision/contract ID: shared data/API contract staging and WP-021 normalizer boundary.
- Current definition: WP-003 requires an erased `declare function` in the model-types module and names only four app staging members despite additional live-name collisions.
- Required change: expose a callable normalizer type implemented as a real WP-021 export; add exact V2 namespace members for the colliding result-field, mesh-overlay, and envelope contracts; retain app ownership of unit-suffixed transport types through WP-032B; add the omitted generalized DOF union and negative compile assertions.
- Why this packet cannot continue: the candidate can typecheck a nonexistent runtime export and downstream workers can import legacy types under target names.
- Affected packets: WP-005, WP-021, WP-026, WP-032A, WP-032B, WP-035, WP-050, WP-060, and WP-063.
- Backward-compatibility impact: none at runtime; live app unions and legacy named contracts remain unchanged until their existing activation owners promote the staged members.
- Proposed migration/test: WP-021 annotates its real `core/supports.ts` export with the callable type; WP-032B promotes/removes collision members atomically; compile fixtures prove positive names and negative warning/schema/field/support assignments.
- Lead decision: approved for integration; no numerical/sign/warning-authority semantics change.
- WP-004 protocol preparation is complete but benchmark acceptance is blocked: Morley 1962 and Razzaque 1973 originals were not acquired, and the rectangular analytical source chain is incomplete. No executable acceptance fixture or empirical tolerance was added.
- WP-003 and WP-005 are accepted, green, and pushed at checkpoints `4236dcd` and `020064b`. G0 remains blocked solely by WP-004.
- Contract deviation active: `CD-G0-001`.
- Decision/contract ID: G0 verification-source prerequisite for implementation waves.
- Current definition: G0 requires WP-004 verification-source protocol approval before Wave 1.
- Required change: defer WP-004 external verification acquisition and allow implementation-only Wave 1 execution from the accepted WP-001/WP-002/WP-003/WP-005 baseline.
- Why this packet cannot continue: the missing historical full texts and instantiated commercial-shell case are external verification inputs and do not alter the frozen code contracts needed by WP-010/WP-012/WP-013.
- Affected packets: G0 and implementation Waves 1-5 may proceed provisionally; WP-060/WP-061 may generate internal evidence; WP-062, WP-064, G6, G7, release-policy revision, and engineering reliance remain blocked pending WP-004 completion.
- Backward-compatibility impact: none; no runtime type, numerical convention, warning, or persistence contract changes.
- Proposed migration/test: retain all WP-004 files and missing-evidence markers; independently review each implementation packet; run zero-skew/mathematical/internal verification as planned; complete and re-review WP-004 before published-benchmark/commercial-shell packets or any release claim.
- Lead decision: approved from explicit user/owner direction; implementation authorization only, not verification acceptance.
- Contract deviation integrated and closed: `CD-WP012-001`.
- Decision/contract ID: canonical deck-kernel angle domain and transform containment responsibility.
- Current definition: the ADR limits persisted app input to +/-45 degrees but does not explicitly state the wider normalized-kernel domain or whether transforms extend outside the physical deck.
- Required change: canonical deck kernels accept finite `-90 < skewAngleDeg < 90`; WP-014B retains the inclusive +/-45-degree app/persistence limit. The forward/inverse transforms are total affine maps for any finite coordinate; deck containment is a separate consumer/polygon predicate responsibility.
- Why this packet cannot continue: WP-012 privately narrowed the kernel to the app limit and its off-deck test otherwise freezes an undocumented API decision.
- Affected packets: WP-012, WP-014B, WP-015, WP-020, WP-022, WP-023, WP-035, and WP-060.
- Backward-compatibility impact: none for app inputs or saved models; the kernel accepts a wider mathematical domain and preserves existing finite mappings.
- Proposed migration/test: test +/-45 as ordinary accepted cases, accept representative +/-60 and values approaching but below 90, reject +/-90 and beyond, add analytic sign/corner/inverse oracles, multi-scale error cases, and explicit off-deck affine-extension tests.
- Lead decision: approved; no change to the release UI limit, skew sign, warning policy, or engineering-verification status.
- Contract deviation integrated and active: `CD-WP014A-001`.
- Decision/contract ID: required app skew field and compile-safe zero default bridge.
- Current definition: WP-014A makes live `skewAngleDeg` required and must pass strict typecheck, but its original lease excludes the typed runtime default constructor; WP-014B cannot begin until WP-014A passes.
- Required change: extend WP-014A's lease to add exactly `skewAngleDeg: 0` to `createDefaultModel`; retain all parsing, sanitization, migration, range, invalid-input, save/load, and defaults-test work in WP-014B.
- Why this packet cannot continue: the required live field makes the typed default model structurally invalid, so the WP-014A strict-typecheck acceptance condition is otherwise impossible without starting its prerequisite-dependent successor.
- Affected packets: WP-014A, WP-014B, WP-015, and typed app-model consumers.
- Backward-compatibility impact: saved/imported legacy objects remain untouched until WP-014B; newly constructed defaults gain an explicit zero skew and retain identical rectangular physical behavior.
- Proposed migration/test: WP-014A proves required typing and exact zero construction with mechanical fixtures; WP-014B later owns missing-field migration, +/-45 limits, invalid inputs, persistence, and round trips.
- Lead decision: approved as the narrowest compile bridge; no WP-014B parsing or migration task starts early.
- Contract deviation integrated and active: `CD-WP014A-002`.
- Decision/contract ID: required app skew field reaches sanitizer return and mesh-sizing typed fixtures.
- Current definition: the first compile bridge covered only `createDefaultModel`, but strict typecheck also requires the live sanitizer return and two typed mesh-sizing fixtures to provide the new required field.
- Required change: permit `sanitizeGeometry` to return only `skewAngleDeg: fallback.skewAngleDeg`, without observing imported input, and permit the two mesh-sizing fixtures to add explicit zero.
- Why this packet cannot continue: strict typecheck otherwise fails in one already leased production file and one unleased mechanical fixture file, while starting WP-014B's real input policy would violate the packet prerequisite.
- Affected packets: WP-014A, WP-014B, WP-015, and mesh-sizing fixtures.
- Backward-compatibility impact: pre-WP-014B imports continue to behave as zero skew; explicit imported skew is intentionally not activated until WP-014B. Existing rectangular geometry and mesh expectations remain unchanged.
- Proposed migration/test: WP-014A proves compile-safe required typing and zero fixtures; WP-014B replaces fallback-only carry-through with the accepted missing/finite/range policy and owns defaults/persistence tests.
- Lead decision: approved after the worker stopped at the exact lease boundary; no WP-014B behavior is accepted early.
- Contract deviation integrated and active: `CD-WP014B-001`.
- Decision/contract ID: make the normative V2 save path reachable from the live App.
- Current definition: WP-014B must make every save before WP-027 write exact V2, but its original lease excludes `src/app/App.tsx`, where `handleSaveJson` directly stringifies the live model.
- Required change: permit one App integration edit replacing only direct model stringification with a serializer exported from leased `src/app/defaults.ts`; retain all parser/serializer logic and tests in the original WP-014B files.
- Why this packet cannot continue: a serializer that the live save path never calls cannot satisfy the explicit V2-save acceptance contract.
- Affected packets: WP-014B, WP-027, WP-032B, WP-050, and WP-063 persistence acceptance.
- Backward-compatibility impact: complete implicit V1 saved files load with missing skew exactly zero; exact V2 files load; malformed/partial/unversioned or discriminator-shape mismatches now fail as required by the accepted ADR instead of being guessed. Saved files gain explicit V2 metadata.
- Proposed migration/test: parse exact full V1/V2 snapshots before sanitization; reject discriminator/schema/shape mismatches and unsupported versions; sanitize finite skew within inclusive +/-45, normalize negative zero, use the existing deterministic fallback rather than clamp for invalid/out-of-range values; serialize exact V2 and prove App uses it.
- Lead decision: approved as a one-expression App integration lease; no other App behavior or file is authorized.
- Contract deviation active: `CD-EF002-001`.
- Decision/contract ID: defer formal verification and human approvals without treating known computational failures as acceptable.
- Current definition: the plan and EF-002 ADR require CEng/external approval before dependent implementation, and WP-004/G0 remain formally unpassed.
- Required change: formal human and external verification items move to the end-of-plan review register and do not block implementation packages. Internal executable correctness failures remain hard stops, and engineering reliance, warning removal, or release is not authorized.
- Why this packet can continue: the owner explicitly directed that approvals and verifications be consolidated at the end, while the independently reviewed MITC4 equation and fixture packages are sufficient to start bounded implementation work.
- Affected packets: EF-003 through EF-005, WP-004, WP-060 through WP-064, and gates G1 through G7.
- Backward-compatibility impact: none at this decision point; no production code, result, persistence, or public contract changes.
- Proposed migration/test: execute the internal rank, sign, transform, finite-value, locking, distortion, and recovery tests during implementation; record every deferred human/external item below; complete the register before any release or engineering-reliance decision.
- Lead decision: approved from explicit user/owner direction on 2026-07-21. This is implementation authorization only.
- Contract deviation integrated and active: `CD-WP020-001`.
- Decision/contract ID: split mesh geometry production from prerequisite-owned AABB consumer removal.
- Current definition: WP-020 tasks require Q4 `(0,0)` element centres and its literal acceptance says no stiffness/load code treats an AABB as physical geometry, while `src/solver/post/recover.ts` and `src/solver/loads/patch.ts` remain exclusively assigned to WP-030 and WP-024.
- Required change: WP-020 produces coordinate-identical element polygons, containing metadata AABBs, and a tested shared Q4-centre utility without editing either consumer. WP-024 alone replaces rectangle/AABB patch integration; WP-030 alone changes recovered element-centre coordinates.
- Why this packet cannot continue unchanged: satisfying the literal acceptance would either cross the exclusive leases or start WP-024 before WP-022/WP-023 prerequisites and WP-030 outside its ordered wave.
- Affected packets: WP-020, WP-024, WP-030, G2/G3, and every downstream nonzero-skew solve/result consumer.
- Backward-compatibility impact: WP-020 preserves exact zero-skew topology and compatibility axes. Later WP-024 may change skew load distribution while preserving force/first moments; later WP-030 changes skew reported centres from AABB midpoints to Q4 centres. No such consumer behavior is claimed by WP-020.
- Proposed migration/test: WP-020 tests polygon/node identity, containing AABBs, and Q4 centres. WP-024 tests polygon quadrature plus force/first-moment conservation and zero-skew equivalence. WP-030 tests centre recovery at zero and +/-19 degrees. Until both later packets pass, nonzero-skew load/recovery correctness is explicitly unavailable.
- Lead decision: approved as the only dependency-safe interpretation. The original file leases remain unchanged; expanding WP-020 into load integration or recovery is rejected.
- Contract deviation integrated and active: `CD-WP020-002`.
- Decision/contract ID: atomic mechanical fixture migration for required live mesh-node promotion.
- Current definition: WP-020 must promote staged `MeshNodeV2` to required live `MeshNode.s/t`, but the initial exact lease named only two existing mechanical fixtures even though accepted element/zero-skew fixtures construct typed `MeshNode` objects.
- Required change: add only `src/solver/benchmarks/zeroSkewCharacterizationFixture.ts`, `src/tests/q4Geometry.test.ts`, `src/tests/mitc4Element.test.ts`, `src/tests/elementStability.test.ts`, and `src/tests/helpers/elementStabilityDiagnostics.ts` to the WP-020 lease for atomic compile migration.
- Why this packet cannot continue unchanged: strict TypeScript would fail immediately after the required promotion, and weakening `s/t` to optional would violate the accepted mesh contract.
- Affected packets: WP-020 and the unchanged EF-003/EF-004 numerical fixtures that structurally type their Q4 nodes as `MeshNode`.
- Backward-compatibility impact: none in solver mathematics or expected values. Mechanical fixtures gain explicit deterministic `s/t` data that element/Q4 kernels do not consume.
- Proposed migration/test: use geometrically consistent local values where defined and deterministic test-local values otherwise; rerun the complete Q4/MITC4/stability/zero-skew suites and prove all prior expected values, hashes, tolerances, and assertions are unchanged.
- Lead decision: approved as a compile-safe atomic exception to the normal packet file-count limit. No kernel, snapshot, tolerance, expected-result, or production benchmark-value change is permitted.
- Contract deviation correction integrated and active: `CD-WP020-001-R1`; this supersedes the original `CD-WP020-001` decision to defer all consumer edits.
- Decision/contract ID: fail closed during the staged skew-mesh integration interval.
- Current definition: after WP-020 maps nonzero-skew nodes, the current public solver would otherwise combine them with legacy coordinate-support handling, physical AABB load integration, and AABB-midpoint recovery before WP-021/WP-024/WP-026 complete.
- Required change: permit `src/solver/post/recover.ts` only to consume the shared Q4 `(0,0)` centre utility; permit `src/solver/loads/patch.ts` only to reject any element whose physical polygon is not the exact axis-aligned rectangle represented by its AABB before legacy integration; permit `src/solver/runFixedPositionAnalysis.ts` only to reject nonzero-skew public solves temporarily; permit `src/tests/solverSmoke.test.ts` for the guard regression.
- Why this packet cannot continue safely without the correction: an imported nonzero-skew model is already accepted and propagated, so activating the skew mesh without guards could return numerically plausible but physically inconsistent loads, supports, and result coordinates.
- Affected packets: WP-020, WP-021, WP-024, WP-026, WP-030, and all downstream nonzero-skew solve consumers.
- Backward-compatibility impact: exact zero-skew solves, load vectors, reactions, recovery, and fixtures remain unchanged. Nonzero-skew public calls change from potentially misleading interim output to an explicit temporary failure. WP-026 removes the public guard only after WP-021/WP-023/WP-024 and G3 prerequisites pass.
- Proposed migration/test: prove zero-skew full regression unchanged; prove a nonzero-skew public solve fails before mesh/load solve; prove direct legacy patch assembly rejects a non-rectangular element but accepts an exact rectangle; prove recovery reports the shared Q4 centre; retain all existing numerical tolerances and hashes.
- Lead decision: approved after independent preflight as a safety-critical atomic integration exception. WP-024 remains the sole polygon-integration owner and WP-030 retains all wider recovery work.

## Deferred end-of-plan review register

| Review item | Evidence required before closure | Current state |
|---|---|---|
| WP-004 source verification | original-source acquisition and authority, commercial-shell case definition, comparison protocol, and independently accepted provenance | deferred; no benchmark or validation claim permitted |
| EF-002 CEng suitability | MITC4 suitability for slab assessment, shear/recovery/report limitations, and engineering significance of EF-004 changes | deferred; blocks engineering reliance/release only |
| EF-003 implementation review | independent code/mathematics review of covariant tying, transforms, direct stiffness accumulation, recovery, rank, and hard-stop tests | internal review recorded `pass` at `0088e11`; CEng/release reliance remains deferred |
| EF-004 zero-skew rebaseline | old/new values, convergence evidence, differences, and engineering significance | internal numerical impact review passed at `b4cbbec`; formal CEng/release interpretation remains deferred |
| EF-003/EF-005 numerical evidence | full-J transforms, non-affine distortion families, locking sweep, recovery/energy consistency, rank, positive definiteness, and finite response | EF-003, EF-005 re-entry, WP-015, and the G1 internal gate passed; formal end-stage acceptance remains pending |
| WP-060/WP-061/WP-062/WP-063/WP-064 | planned verification, benchmark, acceptance, compatibility, and reporting evidence with independent review | deferred to their end-stage execution/review |
| G6/G7 release review | warning/reliance policy, CEng approval, verified sources, benchmark/commercial comparison, and final release authorization | mandatory before warning removal, engineering reliance, or release |

This register defers review timing, not evidence integrity. A known sign/transform error, extra non-physical mode, non-finite value, unstable solve, locking failure, or recovery inconsistency must stop the affected implementation package until corrected or returned to EF-002.

## Next three delegations

1. Complete, independently review, and checkpoint WP-020 from `1060d4b`; stop for any out-of-lease recovery/load-integration requirement.
2. Complete, independently review, and checkpoint WP-022 from `1060d4b`; preserve full-contact-area pressure and keep WP-024 integration out of scope.
3. After both checkpoints, rerun the combined Wave 2A regression set; only then dispatch WP-021/WP-023 or proceed to the next dependency-safe lane.
