# Skew Analysis — Verification Status

**Purpose.** This document states, without overstatement, exactly what the
skew (non-rectangular plan) analysis capability *is* and *is not* today. It
exists so that no reader mistakes *implemented* for *verified*, and no UI
affordance is read as a release for design use.

**One-line status.** Non-zero-skew analysis is **experimental and
screening-only**. It has **not** completed independent numerical verification,
has **no** Chartered-Engineer sign-off, and **must not be used for design**.
The mandatory in-app experimental warning stays until that verification is
complete (gate G7 / WP-065).

> Rectangular (zero-skew) analysis is unchanged in intent by this work: the
> skew path is the same unified solver with `skewAngleDeg = 0` as its special
> case. Zero-skew numerical results are preserved within round-off through the
> shared path (see the zero-skew rebaseline notes in
> `docs/skew-implementation-status.md`).

---

## Capability classification

The four columns below are deliberately distinct. A capability may be fully
*implemented* in code and still be *not independently verified*.

### Implemented (in code, tests pass, pending independent review)

- Unified skew-general solver path: a 19° plate solves through the public API
  (fixed-fixed and pinned-pinned end conditions), with skew end supports
  expressed as inclined deck-local coordinate lines / deck edges.
- MITC4 plate element for all slabs (rectangular = the `skewAngleDeg = 0`
  case), consistent polygon patch loads, normalized/edge support mapping,
  signed force/moment equilibrium, and nodal recovery including the twisting
  moment `mxy`.
- Skew-aware application layer: skew geometry + boundary-preset controls;
  user-creatable edge supports at non-zero skew; `Mxy` as a selectable result
  field; deck-local (s/t) section settings and section plot; deck-local /
  polygon-aware 3D viewer framing, probe, and overlays; skew-aware moving-load
  envelopes (including worst-twist station).
- In-app skew-evidence presentation: signed-equilibrium residual summary,
  mesh-quality status, and three *separately reported* verification statuses
  (formulation / stored 19° reference study / current-model convergence), plus
  the experimental screening-only banner gated on non-zero skew.
- Support reaction distributions along each support (see WP-034 in the status
  ledger) — data model and reconciliation, pending independent review.

### Provisional (implemented but explicitly conditional)

- **Formulation status: conditional.** The MITC4 formulation has passed
  internal numerical checks, but the formal formulation-verification and
  Chartered-Engineer suitability review are not complete.
- **Equilibrium residuals** are reported and are near solver precision on the
  reachable cases exercised so far — this is a *self-consistency* check, not an
  accuracy check against an independent reference.
- **Mesh quality** is screened by an internal metric set; convergence under
  refinement for skew geometry is **not demonstrated** for the current model.

### Deferred (not started / intentionally out of scope for now)

- **Independent numerical review** of the reachable 19° solve.
- **Published-benchmark comparison** against an original, independently
  accepted source, and a defined commercial-shell comparison case (WP-004 and
  the WP-060–064 verification/benchmark/acceptance packets).
- **Reference 19° study status: not-run.** No stored, reviewed 19° reference
  study exists yet.
- **Current-model convergence: not-demonstrated.** Mesh-convergence evidence
  for the active model is not produced.
- Gates **G6/G7** and any **CEng release** for non-zero-skew design use.
- Wood–Armer reinforcement moments; membrane/beam/diaphragm/thermal effects
  (these remain out of scope for the plate solver generally, skew or not).

### Independently verified

- **None for the skew capability.** No independent numerical, benchmark, or
  Chartered-Engineer verification of non-zero-skew results has been performed.
  Any statement to the contrary would be incorrect.

---

## What the verification statuses in the app mean

The results view reports three statuses separately, on purpose:

| Status | Current value | Meaning |
| --- | --- | --- |
| Formulation | `conditional` | Element/formulation passed internal checks; formal + CEng review outstanding. |
| Reference study (19°) | `not-run` | No stored, independently-accepted 19° reference comparison exists. |
| Current-model convergence | `not-demonstrated` | Mesh-convergence for the active model has not been shown. |

Only when all three reach an accepted state — and the independent review and
release gates (WP-004, WP-060–065, G6/G7) pass — can the experimental warning
be lifted, and only by an explicit, recorded decision. No user-facing toggle
can clear the warning.

---

## Mesh behaviour at high skew (important)

The solver uses a single **uniformly sheared structured quadrilateral mesh**
for all skew angles (rectangular is the `skew angle = 0` case). There is no
triangular, mixed, or refined mesh, and no special treatment of the acute /
obtuse corners.

As skew increases, every element becomes a more distorted parallelogram — its
interior angles are `90° ± skew`, and its scaled Jacobian is `≈ cos(skew)`:

| Skew | Acute interior angle | Scaled Jacobian ≈ |
| --- | --- | --- |
| 19° | 71° | 0.95 |
| 35° | 55° | 0.82 |
| 45° | 45° | 0.71 |
| 60° | 30° | 0.50 |

Two consequences the reader must understand:

- **The internal mesh-quality screen is permissive and is not the safeguard
  here.** Its thresholds (scaled Jacobian ≥ 0.3, interior angles within
  30°–150°) are only tripped by a uniform sheared-quad mesh at roughly **60°**
  skew. So the mesh-quality panel reports **OK even at 45°** — a status that
  means "no *severe* Q4 distortion", **not** "results are accurate".
- **Equilibrium residuals are self-consistency, not accuracy.** A distorted
  mesh can satisfy signed equilibrium to solver precision and still be
  inaccurate.

Established FE practice moves to triangular / mixed / refined meshing well
before this — commonly around **30–35°** skew. Because this tool cannot, an
explicit **advisory fires at skew ≥ 30°** (`src/app/skewMeshAdvisory.ts`)
telling the engineer the sheared-quad results at that angle are very rough
screening only. This advisory is *in addition to* — and never a replacement
for — the mandatory non-zero-skew experimental warning, which applies to
**all** non-zero skew regardless of angle. Proper high-skew accuracy (a
triangular / mixed mesh, e.g. an MITC3 element) is out of scope for the current
plan and would be a separate work-stream.

---

## Saved-model migration and compatibility

- Existing (rectangular / legacy) saved JSON continues to load unchanged;
  legacy line/point support models round-trip byte-for-byte.
- The persisted schema is the versioned "legacy-generalized" model. `skew
  angle` and **edge-support identity** persist additively inside it; an invalid
  persisted edge identity is rejected at load.
- The **deck-local section settings** (`deckSection`) are a *live-only* view
  setting: they are **not** written to saved JSON, so a saved file omits them
  and they are re-defaulted on load. This is intentional and keeps old and new
  saved files interchangeable.

---

## Change control

This document is descriptive of the current state and must be updated whenever
a capability changes column — especially when any independent verification is
completed. The authoritative packet-by-packet record is
`docs/skew-implementation-status.md`; the approved plan is
`docs/2026-07-21-skew-plate-analysis-implementation-plan.md`.
