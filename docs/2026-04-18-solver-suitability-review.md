# Solver Suitability Review — Vehicle-Loaded Bridge Deck FEA

**Date:** 2026-04-18
**Scope reviewed:** the v1 recommended solver strategy — custom browser-native TypeScript plate solver, structured rectangular mesh, 4-node Mindlin/Reissner plate element, 3 DOFs per node (`w`, `rx`, `ry`), dense symmetric assembly, direct solve, factorize-once / many-RHS, Web Worker execution.
**Question:** is this solver suitable for use as a vehicle-loaded bridge deck FEA tool?
**Reviewer role:** Chartered Structural Engineer (internal review).

---

## 1. Applicable Standards

- **BS EN 1991-2 (EC1-2)** — traffic load models LM1–LM4, tyre patch geometry and axle configurations.
- **BS EN 1992-2 / 1993-2 / 1994-2** — deck resistance checks.
- **BS EN 1990 A2** — combinations and dynamic amplification.
- **PD 6694-1 / NA to EC1-2** — UK-specific load arrangements.

## 2. Suitability — Summary Table

| Aspect | Verdict | Notes |
|---|---|---|
| Mindlin/Reissner element | Appropriate | Captures transverse shear — correct for RC slab decks with span/thickness ≲ 20. |
| 3 DOF (`w`, `θx`, `θy`) only | Limiting | Pure plate bending; **no membrane / in-plane action**. |
| Structured rectangular mesh | Restrictive | Cannot represent skew, curvature, non-rectangular plan, cantilever footways at angle. |
| Factorize-once / many RHS | Excellent | Matches the moving-load influence-surface workflow exactly. |
| Dense direct solve | Acceptable for v1 | Fine up to roughly 5–10k DOF; unsuitable for refined patch-loaded full decks (>50k DOF). |
| Web Worker execution | Correct choice | Keeps UI responsive during batched load-case sweeps. |

## 3. Critical Engineering Gaps for Bridge Deck Use

1. **No in-plane (membrane) DOF** → cannot model:
   - composite steel–concrete decks (shear flow on studs);
   - eccentric edge beams / parapets acting compositely;
   - prestress effects in the slab plane;
   - restraint thermal and shrinkage actions.
2. **No beam or bar elements** → cannot include kerbs, edge-stiffening beams, diaphragms, or bearing plinths — all normally required for a realistic transverse distribution on a bridge deck.
3. **Structured rectangular mesh** → precludes:
   - skew decks (very common in UK highway bridges);
   - curved-in-plan decks;
   - local mesh refinement under tyre patches without global over-refinement.
4. **Shear-locking risk**: bilinear Mindlin elements must use MITC4, selective reduced integration, or assumed-shear-strain formulation. Must be explicitly verified against the plate-bending patch test and the Pian/Sumihara benchmarks before release.
5. **Tyre patch load application**: EC1-2 LM1 uses 0.40 m × 0.40 m contact patches at axle positions. A structured mesh either (a) forces global refinement, or (b) requires consistent nodal equivalent loads — a defensible strategy must be chosen and documented.
6. **Support conditions**: bearings are discrete points or short lines; the structured grid must either align supports with nodes or introduce rigid links — no rigid-link capability is apparent.
7. **Orthotropy**: voided slabs, ribbed decks, and composite decks behave orthotropically. 4-node Mindlin can accept an orthotropic D-matrix, but the spec does not state this is included.
8. **Post-processing gap**: the engineering deliverables are influence surfaces, envelopes of `Mxx`/`Myy`/`Mxy`, and Wood–Armer reinforcement moments (per CIRIA 110 / Eurocode practice). These are not currently produced by the app.

## 4. Recommendation

**Conditionally suitable** as a v1 solver for **simply-supported, right (non-skew), solid RC slab decks without composite edge beams**, used as a teaching / quick-check tool.

**Not yet suitable** as a production bridge-deck solver for general UK/EU highway work until the following are added or explicitly scoped out.

### 4.1 Must-have before bridge-deck production use
- (a) Document the element formulation (MITC4 or equivalent) and publish patch-test / benchmark results (Morley skew plate, simply-supported square, Razzaque's skew).
- (b) Add eccentric beam elements for edge kerbs / parapets, **or** restrict scope to "slab-only idealisation" and document the resulting conservatism.
- (c) Define and validate the tyre patch load application rule against a reference FE solution (e.g. PyNite or LUSAS) for LM1 `TS + UDL`.
- (d) Provide Wood–Armer moment post-processing for reinforcement design.
- (e) Support skew decks — at minimum via an unstructured-but-quad mesh generator — or clearly exclude them from scope.

### 4.2 Should-have
- Sparse solver (Cholesky) once DOF count grows — dense breaks down beyond ~10⁴ DOF.
- Orthotropic D-matrix for voided / composite decks.
- Membrane DOF (5-DOF shell) to unlock composite and prestress analysis in v2.

## 5. Verification Plan (before first production use)

1. **Element patch test** (constant curvature) — must pass to machine precision.
2. **Simply-supported square plate, UDL**: compare `w_centre` and `M_centre` to the Timoshenko series solution — target < 2 % error at a 16×16 mesh.
3. **Simply-supported square plate, central point load**: verify convergence of `Mxx` under mesh refinement and confirm correct singularity handling.
4. **Morley 30° skew plate** (if skew capability is added): classic benchmark — report against published results.
5. **Moving-load regression**: reproduce a single LM1 lane influence surface against an independent solver (PyNite or SOFiSTiK) for one reference deck.
6. **Factorization-reuse audit**: confirm no aliasing between load cases when `K` is reused; include a unit test with 100 RHS vectors compared against fresh factorization each time.

## 6. Professional Review Note

**Chartered Engineer review is required** before this solver is relied upon for any design submission. The solver's assumptions — slab-only idealisation, no membrane action, rectangular plan — must be stated on every output sheet, and every analysis should be cross-checked against a second independent method (hand calc via Pucher charts / Westergaard for local effects, or a verified commercial package for global effects) until the tool has an established track record.

## 7. Bottom Line

The solver choice is sound **in kind** — a Mindlin plate with factor-once / solve-many is exactly the right architecture for moving-load analysis. The **scope as currently written is narrower than a general bridge-deck application demands**. Two viable paths forward:

- **(a) Keep v1 narrow:** tighten the documented scope to "right, solid RC slabs without edge beams" and accept the tool as a screening / educational aid.
- **(b) Extend towards a bridge-deck solver:** move to a 5-DOF shell with eccentric beam elements and unstructured quads before it is called a bridge-deck solver.

Path (a) is recommended for v1. The items in §4.1 and §4.2 form the candidate backlog for the next major revision.
