# ADR: Plate element formulation replacement

- **Status:** Selected for EF-003 implementation under `CD-EF002-001`; Chartered Engineer approval deferred to end-of-plan review
- **Date:** 2026-07-21
- **Decision owner:** EF-002 replacement-formulation architecture
- **Integration baseline reviewed:** `feat/skew-plate-analysis` at `5181458`
- **Scope:** flat, isotropic Reissner-Mindlin Q4 plate stiffness and point recovery behind the existing three-DOF element API

## 1. Decision

Use the original Bathe-Dvorkin four-node MITC plate formulation as the **conditional EF-003 implementation candidate**. Keep the existing bilinear displacement and director interpolation and the existing bending operator, replace one-point selectively reduced shear integration with the MITC4 assumed covariant shear field tied at the four edge midpoints, and integrate both bending and assumed shear with the standard `2 x 2` Gauss rule.

This is a formulation selection, not an engineering approval and not evidence that EF-003 has passed. Independent numerical equations and fixture-plan approvals are recorded below. Under explicit owner direction `CD-EF002-001`, Chartered Engineer review is deferred to the end-of-plan review register and does not block EF-003 implementation. The numerical reviewer, ADR author, implementation agent, and lead cannot self-supply that approval. Engineering reliance, warning removal, or release still requires the deferred review and all later gates.

The selection is based on behaviour relevant to the observed failure:

1. the original source reports exactly three rigid modes, no spurious zero-energy modes, a passed patch test, and thin-plate behaviour without shear locking under full integration;
2. the source supplies the covariant assumed-shear construction and reports that standard `2 x 2` Gauss integration is adequate, including distorted elements;
3. the formulation has four nodes and three plate DOFs per node, so it preserves every valid surrounding contract;
4. a later unified comparison reports proper rank and uniform, optimal convergence for MITC4, DKMQ, and DSQ, while also documenting DKMQ's slight accuracy advantage; and
5. MITC4 has a documented stability/shear-force limitation in a separate primary paper, so EF-003 includes explicit distortion and shear-recovery stop tests rather than treating the literature as blanket validation.

## 2. EF-001 failure signature and stable boundaries

### 2.1 Frozen failure

At the reviewed baseline the element uses `2 x 2` bending integration and a single centre point with weight four for the raw bilinear shear operator. EF-001 established the following repeatable signature on both a rectangle and a genuinely sheared affine Q4:

| Diagnostic | Physical expectation | Observed current SRI result |
|---|---:|---:|
| free single-element nullity | 3 | 5 |
| free assembled `2 x 2` mesh nullity | 3 | 4 |
| normalized checkerboard energy | positive above `2.46e-11` floor | approximately `+3.35e-18` rectangle and `-6.56e-18` sheared |
| checkerboard CG solve | positive search energy and progress | breakdown at iteration 0, residual norm 3 |

The three physical zero modes are `w = c - betaX*x - betaY*y`. The additional modes are genuine shear-hourglass modes. Geometry mapping, loading, and restraints were independently excluded as causes. Changing a shear factor, diagonal, solver tolerance, or mesh warning cannot repair a rank defect and is outside this decision.

### 2.2 Stable APIs and contracts

EF-003 shall preserve these signatures and meanings where mathematically valid:

```ts
computeMindlinQ4ElementStiffness(
  elementNodes: readonly [MeshNode, MeshNode, MeshNode, MeshNode],
  material: MaterialDefinition,
  thickness: number,
): Float64Array // row-major 12 x 12

evaluateMindlinQ4At(
  elementNodes: readonly [MeshNode, MeshNode, MeshNode, MeshNode],
  elementDisplacements: Float64Array,
  xi: number,
  eta: number,
): MindlinPointEvaluation
```

The Q4 node order remains counter-clockwise at natural corners `(-1,-1)`, `(1,-1)`, `(1,1)`, `(-1,1)`. The geometry helper remains authoritative for a finite positive Jacobian and the `J^-T` derivative transform. The external mesh, support, patch-load, solver, and result contracts remain unchanged. A formulation correction may change numerical results; those changes belong to the deliberate EF-004 rebaseline, not to a widened regression tolerance.

## 3. Normative app convention used for every candidate

At node `i`, the element DOF block is

\[
\mathbf d_i=[w_i,\beta_{Xi},\beta_{Yi}]^{\mathsf T},
\]

and the element vector is `[w1,betaX1,betaY1,...,w4,betaX4,betaY4]`. Current internal aliases map exactly as `rx = betaX`, `ry = betaY`. Positive `w` is downward. The accepted kinematics are

\[
\boldsymbol\kappa=
\begin{bmatrix}
\beta_{X,x}\\
\beta_{Y,y}\\
\beta_{X,y}+\beta_{Y,x}
\end{bmatrix},\qquad
\boldsymbol\gamma=
\begin{bmatrix}
w_{,x}+\beta_X\\
w_{,y}+\beta_Y
\end{bmatrix}.
\]

The public physical right-hand rotations are not the internal directors:

\[
\boxed{\phi_x=-\beta_Y,\qquad\phi_y=\beta_X.}
\]

Likewise, generalized nodal actions `[GX,GY]` map to physical couples `Cx=-GY`, `Cy=GX`. No candidate may silently substitute physical rotations for `betaX/betaY` inside its B matrices.

The constitutive matrices remain

\[
\mathbf D_b=\frac{Eh^3}{12(1-\nu^2)}
\begin{bmatrix}1&\nu&0\\\nu&1&0\\0&0&(1-\nu)/2\end{bmatrix},\qquad
\mathbf D_s=k_s\frac{E}{2(1+\nu)}h\mathbf I_2.
\]

## 4. Candidate formulations

### 4.1 MITC4 — selected conditionally

**Assumptions and DOFs.** MITC4 is a four-node, `C0`, flat Reissner-Mindlin plate element with the same 12 nodal DOFs as the app. Geometry, `w`, `betaX`, and `betaY` use the standard bilinear Q4 interpolation. Curvature uses the ordinary compatible bending matrix. Only transverse shear is replaced by an assumed field.

Let

\[
\mathbf J=\frac{\partial(x,y)}{\partial(\xi,\eta)}
=\begin{bmatrix}x_{,\xi}&x_{,\eta}\\y_{,\xi}&y_{,\eta}\end{bmatrix},
\qquad
\boldsymbol\gamma^c=\mathbf J^{\mathsf T}\boldsymbol\gamma
=\begin{bmatrix}\gamma_{\xi z}\\\gamma_{\eta z}\end{bmatrix}.
\]

Evaluate the compatible shear field from the accepted app signs at the four natural edge midpoints. To avoid importing a conflicting node/letter convention from a paper figure, the tying points are named by coordinates:

\[
T_b=(0,-1),\quad T_r=(1,0),\quad T_t=(0,1),\quad T_l=(-1,0).
\]

The assumed covariant components are

\[
\widetilde\gamma_{\xi z}(\xi,\eta)=
\frac{1-\eta}{2}\gamma_{\xi z}(T_b)+
\frac{1+\eta}{2}\gamma_{\xi z}(T_t),
\]

\[
\widetilde\gamma_{\eta z}(\xi,\eta)=
\frac{1-\xi}{2}\gamma_{\eta z}(T_l)+
\frac{1+\xi}{2}\gamma_{\eta z}(T_r).
\]

At the requested point or Gauss point, recover physical Cartesian shear with

\[
\widetilde{\boldsymbol\gamma}=\mathbf J(\xi,\eta)^{-\mathsf T}
\begin{bmatrix}\widetilde\gamma_{\xi z}\\\widetilde\gamma_{\eta z}\end{bmatrix}.
\]

The same operation applied to compatible shear B matrices constructs `BtildeS`; it is not a post-processing correction. The stiffness is

\[
\mathbf K_e=\sum_{g\in 2\times2}
\left(\mathbf B_b^{\mathsf T}\mathbf D_b\mathbf B_b+
\widetilde{\mathbf B}_s^{\mathsf T}\mathbf D_s\widetilde{\mathbf B}_s\right)_g
\det\mathbf J_g\,w_g.
\]

**Behaviour and limitations.** The original paper reports three rigid modes, no spurious zero-energy modes, patch-test success, no thin-plate locking, and exact constant bending moment even for highly distorted elements. It also states that only constant bending moment is reproduced exactly, so stress-resultant gradients require refinement. Lyly, Stenberg, and Vihinen later found that MITC4 can still show a mathematical stability weakness, reduced deflection accuracy, and especially inaccurate or oscillating shear force. Proper element rank therefore does not by itself approve recovered `qx/qy`.

**Fit to this app.** The release mesh is an affine rectangle or parallelogram, for which `J` is constant and the covariant construction is particularly direct. There are no internal DOFs, element-level solves, penalties, hourglass parameters, or new dependencies. Browser TypeScript needs four tying evaluations and four stiffness quadrature evaluations with small `Float64Array` matrices. Patch-load assembly remains a bilinear consistent-load operation and is not formulation-dependent.

### 4.2 DKMQ — behaviourally credible, deferred

**Assumptions and DOFs.** Katili's DKMQ is a four-node, 12-DOF, `C0` Reissner-Mindlin element. It extends the discrete Kirchhoff quadrilateral: bending uses incomplete quadratic rotation fields with temporary side variables; discrete side constraints eliminate those variables in favour of corner DOFs and assumed transverse side shear. The final element has only `[w,betaX,betaY]` at each corner. In compact form,

\[
\mathbf K_e^{DKMQ}=\int_A
\left((\mathbf B_b^{DKQ})^{\mathsf T}\mathbf D_b\mathbf B_b^{DKQ}
+(\mathbf B_s^{DKMQ})^{\mathsf T}\mathbf D_s\mathbf B_s^{DKMQ}\right)\,dA.
\]

The original paper reports proper rank, patch-test performance, thin-to-thick applicability, and freedom from shear locking. The 2018 author comparison reports proper rank for distorted elements, uniform and optimal convergence for MITC4, DSQ, and DKMQ, and a slight DKMQ advantage attributed to its quadratic rotation terms.

**Why not selected now.** DKMQ is not rejected on numerical behaviour. It is deferred because EF-002 has not obtained a complete, independently traceable implementation package for the side-variable elimination, exact bending/shear matrices, quadrature, and recovery operator from the primary formulation. Reconstructing those details from summaries would make the implementation an undocumented variant. Its different bending interpolation also enlarges the recovery and regression surface. DKMQ becomes the first alternative if exact equations are obtained and reviewed or if MITC4 fails EF-003.

### 4.3 Bilinear DSG4 — credible equivalent, no distinct gain

**Assumptions and DOFs.** The discrete shear gap method starts from the shear gap accumulated along a natural-coordinate line,

\[
g_{\xi}(\xi,\eta)=\int \gamma_{\xi z}\,d\xi,\qquad
g_{\eta}(\xi,\eta)=\int \gamma_{\eta z}\,d\eta,
\]

interpolates the discrete gaps, and differentiates them to obtain an assumed shear field. It retains the usual displacement and rotation DOFs and introduces no internal parameters. Bletzinger, Bischoff, and Ramm state that their bilinear rectangular DSG element is identical to the corresponding ANS/MITC element.

**Why not selected.** For this app's bilinear flat Q4, DSG4 is an alternative derivation of the same shear field rather than a separate behaviour improvement. Naming the implementation DSG4 would add a second derivation to review without changing the immediate rank/locking remedy. The MITC tying-point statement maps more directly to the existing Q4 geometry helpers and original plate source.

### 4.4 Stabilized MITC4 — reserve if recovery/stability gates fail

Lyly, Stenberg, and Vihinen use bilinear deflection and rotation fields and add a stable modification to MITC4. Their numerical results reject reduced integration as unreliable, describe original MITC4 as generally good but potentially inaccurate or oscillatory in shear force, and report those drawbacks absent from the modified method.

The candidate is credible and directly relevant to MITC4's residual risk. It is not selected for the first EF-003 implementation because the exact stabilization bilinear form, scaling, consistency proof, and corresponding recovery operator have not yet been extracted into an independently reviewable equation package. Adding an inferred stabilization term would violate the plan's prohibition on empirical stabilization. It is a controlled fallback, not permission to tune MITC4.

## 5. Primary-source evidence

Sources were accessed on 2026-07-21. DOI links are the durable bibliographic identifiers; institutional links are included where an author-hosted or institutional record was available.

| Source | Primary evidence used | Limitation for this decision |
|---|---|---|
| K.J. Bathe and E.N. Dvorkin (1985), “A four-node plate bending element based on Mindlin/Reissner plate theory and a mixed interpolation,” *IJNME* 21, 367-383. [DOI](https://doi.org/10.1002/nme.1620210213); [MIT author PDF](https://web.mit.edu/kjb/www/Publications_Prior_to_1998/A_Four-Node_Plate_Bending_Element_Based_on_Mindlin_Reissner_Plate_Theory_and_a_Mixed_Interpolation.pdf) | Original MITC4 kinematics, covariant tying, full integration, rigid/rank/patch/locking statements, distortion examples, constant-moment limitation | Published examples do not replace this repository's sign, rank, recovery, and skew tests |
| I. Katili (1993), “A new discrete Kirchhoff-Mindlin element ... Part II: An extended DKQ element for thick-plate bending analysis,” *IJNME* 36, 1885-1908. [DOI](https://doi.org/10.1002/nme.1620361107) | Original DKMQ: four nodes, 12 DOFs, proper rank, patch tests, thin-to-thick and locking claims | Full implementation equations were not available in an auditable open copy during EF-002; do not infer them |
| I. Katili, J.-L. Batoz, I.J. Maknun, and P. Lardeur (2018), “A comparative formulation of DKMQ, DSQ and MITC4 ...,” *Computers & Structures* 204, 48-64. [DOI](https://doi.org/10.1016/j.compstruc.2018.04.001) | Unified three-DOF comparison; proper-rank/patch evidence; regular and distorted thin-to-thick s-norm results; slight DKMQ advantage | Comparative numerical evidence does not by itself specify an implementation variant or app tolerance |
| K.-U. Bletzinger, M. Bischoff, and E. Ramm (2000), “A unified approach for shear-locking-free triangular and rectangular shell finite elements,” *Computers & Structures* 75, 321-334. [DOI](https://doi.org/10.1016/S0045-7949(99)00140-6); [TUM record](https://portal.fis.tum.de/de/publications/unified-approach-for-shear-locking-free-triangular-and-rectangula/) | DSG uses ordinary DOFs/no internal parameters; bilinear rectangular element is identical to ANS/MITC | Equivalence means no distinct rectangular-Q4 benefit for the present decision |
| M. Lyly, R. Stenberg, and T. Vihinen (1993), “A stable bilinear element for the Reissner-Mindlin plate model,” *CMAME* 110, 343-357. [DOI](https://doi.org/10.1016/0045-7825(93)90214-I); [Aalto record](https://research.aalto.fi/en/publications/a-stable-bilinear-element-for-the-reissner-mindlin-plate-model/) | Primary warning against SRI; MITC4 stability/shear-force limitation; stabilized alternative | Exact stabilization operator is not frozen here and must not be reconstructed empirically |

For Bathe-Dvorkin traceability, the tying and Cartesian/covariant transform definitions are on printed pp. 370-372, equations (6)-(9), with the Appendix derivation on pp. 381-382, equations (11)-(22), including the Cartesian conversion in equations (19)-(20). The rigid-mode, no-spurious-mode, patch, and locking statements are on printed pp. 372-373; the standard `2 x 2` integration statement is on p. 376; and the constant-bending-moment limitation is on p. 380.

Statements above labelled as app fit, code complexity, API compatibility, or implementation consequence are EF-002 engineering inferences from the sources and inspected repository, not claims made by the papers.

## 6. Decision matrix

Score: `1` poor/unresolved, `3` acceptable with material work, `5` directly satisfied. Weighted total is out of 500. Literature behaviour and auditable formulation carry 60% of the decision; implementation convenience cannot outweigh them.

| Criterion | Weight | MITC4 | DKMQ | bilinear DSG4 | stabilized MITC4 |
|---|---:|---:|---:|---:|---:|
| exact fit to 4-node, 3-DOF accepted signs | 15 | 5 | 5 | 5 | 5 |
| primary evidence for proper rank/no hourglass | 25 | 5 | 5 | 5 | 5 |
| locking and affine/distortion evidence | 20 | 4 | 5 | 4 | 5 |
| exact equation/integration trace available to EF-003 | 15 | 5 | 2 | 3 | 2 |
| complete auditable stiffness/recovery operator | 6 | 5 | 2 | 3 | 2 |
| documented recovery robustness | 4 | 2 | 3 | 3 | 5 |
| browser implementation tractability | 10 | 5 | 3 | 4 | 3 |
| residual risk understood and gateable | 5 | 3 | 4 | 3 | 4 |
| **Weighted total** | **100** | **458** | **404** | **410** | **412** |

MITC4 is selected because it remains the highest-scoring formulation with both behaviour relevant to EF-001 and an exact, reviewable stiffness/recovery operator. Its lower recovery-robustness score records the documented shear-force risk instead of conflating operator availability with demonstrated output quality. Stabilized MITC4 receives the primary-source rank score independently of its missing implementation package and scores highest for recovery robustness, but cannot be implemented until its exact operator is frozen. DKMQ's reported slight convergence advantage is acknowledged; lack of an approved equation package, not coding effort alone, prevents its selection. DSG4 is not a distinct bilinear-Q4 remedy.

## 7. Exact MITC4 element/API boundary

### 7.1 B-matrix construction

For every point, construct the existing compatible matrices

\[
\mathbf B_b^{(i)}=
\begin{bmatrix}0&N_{i,x}&0\\0&0&N_{i,y}\\0&N_{i,y}&N_{i,x}\end{bmatrix},\quad
\mathbf B_s^{(i)}=
\begin{bmatrix}N_{i,x}&N_i&0\\N_{i,y}&0&N_i\end{bmatrix}.
\]

At each tying point `T`, form `Bc(T) = J(T)^T * Bs(T)`. Retain row 0 at `Tb,Tt` and row 1 at `Tl,Tr`. Interpolate those four 12-entry rows with the equations in Section 4.1 to form `BhatC(xi,eta)`. Finally form

\[
\widetilde{\mathbf B}_s(\xi,\eta)=\mathbf J(\xi,\eta)^{-\mathsf T}\mathbf B_{\mathrm{hat}}^c(\xi,\eta).
\]

The transform direction is normative. Swapping `J^T` and `J^-T`, tying Cartesian rather than covariant components, or changing the accepted beta signs is a hard stop.

### 7.2 Pseudocode

```text
buildMitc4TyingRows(nodes):
  for T in [(0,-1), (1,0), (0,1), (-1,0)]:
    N, gradXY, J, detJ = q4Geometry(nodes, T)
    require finite detJ > 0
    Bs = compatibleShearB(N, gradXY)       // app beta convention
    Bc = transpose(J) * Bs
    save required covariant row at T
  return immutable four-row tying packet

assumedShearB(nodes, tying, xi, eta):
  BhatC.rowXi  = 0.5*(1-eta)*rowXi_bottom
               + 0.5*(1+eta)*rowXi_top
  BhatC.rowEta = 0.5*(1-xi)*rowEta_left
               + 0.5*(1+xi)*rowEta_right
  J = q4Jacobian(nodes, xi, eta)
  return inverseTranspose(J) * BhatC

computeMindlinQ4ElementStiffness(nodes, material, h):
  Db, Ds = currentConstitutive(material, h)
  tying = buildMitc4TyingRows(nodes)
  Ke = zeros(12,12)
  for g in standardGauss2x2:
    N, gradXY, J, detJ = q4Geometry(nodes, g)
    Bb = compatibleBendingB(gradXY)
    Bst = assumedShearB(nodes, tying, g.xi, g.eta)
    Ke += (transpose(Bb)*Db*Bb + transpose(Bst)*Ds*Bst)
          * detJ * g.weight
  return Ke

evaluateMindlinQ4At(nodes, de, xi, eta):
  N, gradXY = q4Geometry(nodes, xi, eta)
  Bb = compatibleBendingB(gradXY)
  Bst = assumedShearB(nodes, buildMitc4TyingRows(nodes), xi, eta)
  return { shapeFunctions: N,
           curvatures: Bb*de,
           shears: Bst*de }
```

Accumulate all 144 entries directly from `B^T D B` at every Gauss point. Do not average, mirror, or otherwise post-symmetrize `Ke`; symmetry is a tested outcome, and post-hoc symmetrization could hide a transform or indexing defect.

An implementation may cache tying rows within one stiffness or recovery loop, but cache design is non-normative and must not change results.

### 7.3 Recovery and patch loading

- Curvature and moment recovery continue to use the compatible bending field and `m = Db*kappa`.
- Shear strain and shear resultant must use the same assumed operator used in stiffness: `gamma = BtildeS*d`, `q = Ds*gamma`. Reporting compatible raw one-point shear under an MITC4 label is forbidden.
- Element-centre `qx/qy` may remain the public raw location only if EF-003 and the later recovery review accept its accuracy. Nodal shear extrapolation or averaging is not authorized by this ADR.
- Existing patch clipping, pressure, consistent Q4 load integration, and first-moment rules are unchanged. Stiffness formulation selection supplies no WP-004 benchmark evidence.

### 7.4 EF-002 equation sanity check (non-acceptance evidence)

An in-memory numerical translation of the equations and pseudocode above was run outside the repository on 2026-07-21 for the EF-001 rectangle and affine-shear geometry. Qualitatively, both cases showed only the three physical null modes, no negative mode, symmetric direct accumulation, and rigid-mode residuals at roundoff. The script, exact geometry payload, runtime, and output hash were not archived, so no quantitative value from that probe is acceptance evidence.

This check only indicates that the written `J^T` tying and `J^-T` recovery sequence is internally capable of removing the observed single-element rank defect. It is author sanity evidence, not independent approval, not committed code, not an EF-003 test, and not benchmark or release evidence.

## 8. EF-003 verification matrix

All numerical tolerances and external reference values require independent approval before being encoded. Scale-aware roundoff checks shall use the existing diagnostic policy; no tolerance may be widened to force a pass.

| Test family | Minimum fixtures | Required evidence / pass condition |
|---|---|---|
| rigid modes | single rectangle and affine sheared Q4; three analytical modes | zero curvature and assumed shear at ties, Gauss points, centre, and representative interior points; `K*d` at roundoff |
| covariant transforms | rotated and sheared affine parallelogram with both off-diagonal entries of `J` non-zero; independently specified physical shear vector | independently calculate and verify `J^T*gamma` and `J^-T*gammaC` at all four tying points and at a non-central interior point; a transpose or tying-orientation error must fail |
| constant curvature | single elements and irregular multi-element patch; bending and twist fields | exact prescribed curvature and constant moment to approved roundoff; interior assembled residual consistent with boundary tractions |
| rank/hourglass | free single element and free `2 x 2` rectangle/sheared meshes; checkerboard load; restrained systems | exactly 3 free null modes, no negative mode, no assembled extra null mode, positive checkerboard energy above approved scale floor, CG no iteration-zero breakdown, restrained matrix positive definite |
| `h/L` locking | geometrically similar rectangle and affine-skew meshes across thick to very thin sweep, including at least `h/L = 1e-1, 1e-2, 1e-3, 1e-4` | normalized displacement/energy convergence does not collapse with thickness; uniform trend against an independently approved refined MITC4 or analytical fixture |
| distortion/skew | zero skew, both signs of 19 degrees, both signs of 45 degrees or equivalent valid affine shears; shape-regular refinement families for additional convex positive-J non-affine distortions | finite symmetric stiffness, proper rank, mirror parity, constant-curvature pass, and stable convergence across each refinement family; record minimum `detJ` and maximum scale-free `kappa2(J) = sigmaMax(J)/sigmaMin(J)` over ties and quadrature points for every family; no unexplained sign asymmetry or shear oscillation |
| rectangular behaviour | present zero-skew geometry and element-level checks | formulation tests pass without skew-only branches; differences from old SRI are recorded, never asserted equal by loose tolerance |
| thick plate | at least two moderate/thick ratios and a shear-dominated patch | finite, convergent response with non-zero transverse shear; no thin-only degeneration |
| recovery consistency | centre and Gauss points for manufactured DOFs; energy reconstructed from fields | `evaluateMindlinQ4At` uses the identical assumed-shear operator; `d^T K d` agrees with integrated bending-plus-shear energy to approved roundoff |
| Morley and Razzaque | only source-locked cases supplied after WP-004 | do not create expected values, axes, BCs, or tolerances in EF-003 before WP-004 provenance approval |
| zero-skew rebaseline | existing WP-001/zero-skew cases, executed in EF-004 | table old/new values, mesh/thickness, relative change, convergence evidence, and engineering impact; no “no regression” claim merely because MITC4 is documented |

Source benchmarks and repository verification are separate evidence. Passing a paper's qualitative property statement is not a substitute for executing this matrix, and the Morley/Razzaque names do not authorize unsourced fixtures.

## 9. Risks and stop conditions

| Risk | Required control | Stop/reopen condition |
|---|---|---|
| wrong tensor transform or tying orientation | direct unit tests for `J^T`, `J^-T`, all four edges, affine mirror pairs, and a full-`J` rotated/sheared parallelogram | any rigid/constant-curvature/sign failure |
| residual zero-energy mode | eigen, checkerboard-energy, CG, and restrained-SPD tests | nullity other than 3 or non-positive non-rigid energy |
| thin-plate locking | thickness sweep with approved reference and energy measures | response collapses or convergence materially depends on thickness |
| MITC4 stability or oscillatory shear force | distorted meshes and shear-recovery convergence, kept separate from moment convergence | unstable/non-convergent `qx/qy`; reopen stabilized MITC4 or DKMQ, and narrow public recovery meanwhile |
| distortion sensitivity | positive-J affine and non-affine tests; Jacobian diagnostics | loss of rank, unexplained skew-sign asymmetry, or unacceptable convergence |
| convention drift | exact beta/physical-rotation unit cases and virtual-work checks | any use of `rx/ry` as physical rotations inside the kernel |
| undocumented variant | equation-to-source review and code comments naming tying coordinates/integration | any empirical penalty, blending, hourglass control, stabilization, or quadrature change |
| false external validation | WP-004 source protocol before benchmark assertions | missing source axes, BCs, normalization, or reference provenance |

If a stop condition occurs, EF-003 does not tune the selected formulation. It returns to EF-002 with the failure evidence. DKMQ requires a complete primary equation/recovery package before reconsideration; stabilized MITC4 requires its exact consistency and stabilization terms plus new tests.

## 10. Required approvals and current status

| Approval slot | Scope | Reviewer / evidence ID | Status |
|---|---|---|---|
| independent numerical formulation review | MITC4 tying equations, DOF/sign map, `J` transforms, `2 x 2` integration, rank expectation, recovery definition | `EF-002-R1` independent numerical review | **Pass — equations and API boundary approved** |
| independent numerical fixture review | EF-003 cases, scales, tolerances, thickness/distortion sweep, benchmark separation | `EF-002-R2` independent numerical fixture re-review | **Pass — fixture plan approved** |
| Chartered Engineer review | suitability for the slab assessment use case, recovery/reporting limitations, engineering significance of EF-004 changes | end-of-plan review register; reviewer unassigned | **Deferred under `CD-EF002-001` — does not block implementation; blocks engineering reliance/release** |

The independent numerical formulation and fixture-plan approvals identified above are recorded. `CD-EF002-001` authorizes EF-003 implementation while Chartered Engineer approval remains outstanding in the end-of-plan review register. The current release warning and experimental status remain in force, and no engineering reliance or release approval is implied.

## 11. Rejected approaches and non-decisions

- **Current one-point shear SRI:** rejected because EF-001 demonstrates extra zero-energy modes and solver breakdown. Its previously produced numbers are characterization only.
- **Full integration of the raw compatible bilinear shear field:** rejected because the original MITC4 source identifies thin-plate shear locking in that formulation.
- **Empirical hourglass control, diagonal regularization, shear-factor tuning, or solver-tolerance changes:** rejected by both the observed rank defect and the implementation plan.
- **DKMQ:** deferred, not behaviourally rejected; exact source equations and independent review are prerequisites.
- **Bilinear DSG4:** not selected because the primary source identifies it as equivalent to ANS/MITC for the rectangular bilinear element.
- **Stabilized MITC4:** reserved; no stabilization term is authorized until its primary equations and recovery implications are independently frozen.
- **Benchmark acceptance, public nodal shear, release status, or EF-004 result values:** not decided here.

## 12. Repository evidence inspected

- `src/solver/core/element.ts`: current compatible bending/shear matrices, `2 x 2` bending, one-point shear SRI, constitutive matrices, public element functions, and recovery evaluation.
- `src/solver/core/q4Geometry.ts`: node order, natural functions, Jacobian storage, positive determinant, and `J^-T` physical gradients.
- `src/tests/elementStability.test.ts` and its diagnostic helper: EF-001 rank, checkerboard, CG, rigid, curvature, and restrained-system evidence.
- `docs/adr/ADR-skew-mathematical-conventions.md`: accepted signs, DOFs, virtual work, constitutive order, and physical rotation/couple map.
- `docs/adr/ADR-skew-data-api-contracts.md`: stable element, mesh, patch, recovery, and release boundaries.
- `docs/2026-07-21-skew-plate-analysis-implementation-plan.md`: WP-011 failure branch and EF-001 through EF-005 governance.

This ADR makes no source, test, type, configuration, ledger, plan, benchmark-fixture, or release-policy change.
