# Skew Implementation Status

## Current integration

- Integration hash: `8aa6c78`
- Worktree: `C:\MyEngineering\04-Apps\moving-load-slab-app`
- Branch: `feat/skew-plate-analysis`
- Active wave/package: Wave 1B / WP-011, WP-014A, and WP-031A ready for parallel dispatch; WP-004 deferred
- Package state: `Wave 1A accepted and pushed; Wave 1B dispatch ready`
- Gate state: G0 verification criteria are not passed; implementation-only exception `CD-G0-001` authorizes Wave 1 while release/verification gates remain fail-closed
- Worktree at dispatch: clean at the integration hash except user-owned untracked plan and frozen untracked WP-004 verification files

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

## Gate evidence and tolerances

- Fixture `zero-skew-rectangular-v1`: 2 m by 2 m by 0.3 m slab; 2 by 2 mesh; 30 GPa, Poisson ratio 0.2; four fixed perimeter lines; central 100 kN, 0.5 m square patch.
- Characterized values: complete 12 by 12 element stiffness; complete 27-DOF assembled patch vector; nine nodal displacements; current signed vertical reaction rows; solve summary and diagnostics.
- Nodal `w`, `rx`, and `ry`, numeric residual diagnostics, solve summary, and signed equilibrium all use the declared iterative comparison policy; booleans, counts, IDs, and coordinates remain exact.
- Pure stiffness/load comparison: relative tolerance `1e-12`; absolute floor `128 * Number.EPSILON * max(abs(expected))`. This gives about `4.44e-8` at the stiffness scale and `2.18e-12` at the load-vector scale.
- Iterative solve/reaction comparison: relative tolerance `1e-9`; absolute floor at least the fixture CG absolute tolerance `1e-12`. Fixture CG settings are relative `1e-10`, absolute `1e-12`, maximum 3000 iterations.
- Observed current behaviour: applied vertical load `+100 kN`; deduplicated vertical reaction `-100 kN`; signed force residual `0 kN`; centre-node `w = +1.225e-5 m`; one CG iteration with reported residual norm `0`.
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

## Next three delegations

1. WP-011 numerical stability audit after accepted WP-010; production changes require a separate lead decision.
2. WP-014A mechanical app skew-type activation after accepted WP-005 and WP-012 validation contract.
3. WP-031A generalized-to-physical reaction-moment mapping after accepted WP-002.
