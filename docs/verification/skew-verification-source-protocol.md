# Skew verification source and comparison protocol

| Field | Value |
|---|---|
| Status | **Proposed — blocked pending independent source review** |
| Work package | WP-004 |
| Integration baseline | `7f4c77f24b0712075b754f13a232b9d9e7ac9c13` |
| Prepared | 2026-07-21 |
| Governing convention | [`ADR-skew-mathematical-conventions.md`](../adr/ADR-skew-mathematical-conventions.md) |
| Machine-readable records | [`source-registry.json`](fixtures/skew/source-registry.json), [`benchmark-source-status.json`](fixtures/skew/benchmark-source-status.json), [`commercial-shell-comparison-protocol.json`](fixtures/skew/commercial-shell-comparison-protocol.json) |

## 1. Decision and scope

This protocol freezes how published skew-plate references and a future independent
commercial-shell comparison are to be identified, transcribed, normalized and
reviewed. It does **not** approve any benchmark value, tolerance or observed
comparison result.

The present acceptance decision is **blocked**:

1. The original Morley (1962) and Razzaque (1973) papers were not acquired in
   full text. Values and case definitions available through Marin Grbac and Dragan Ribarić
   (2022) are retained only as attributed secondary transcriptions.
2. The publisher record and correction text for Morley (1963) were acquired,
   but the corrected figures in the 1962 paper could not be inspected.
3. No full-text, authoritative rectangular Reissner–Mindlin plate reference was
   acquired with enough detail to freeze geometry, supports, loading,
   normalization and reference results.
4. Razzaque's exact supported-edge identity and the relation of its published
   axes to the rhombus geometry depend on an unavailable original figure.

Consequently, Gate G0 and the published-benchmark parts of V28 and V30 remain
open. The records under `fixtures/skew/` are provenance and blocking records,
not executable acceptance fixtures.

## 2. Governing rules

### 2.1 Source authority

Use sources in this order:

1. the original paper or book edition, including all errata and corrigenda;
2. the publisher's bibliographic record for identity and publication metadata;
3. an authoritative later paper only as an explicitly labelled secondary
   transcription or independent numerical cross-check;
4. no unattributed table, plot, website value or value recalled from memory.

A secondary paper may report a value from an original paper. That value remains
`secondary_transcription` until an independent reviewer verifies it against the
original at the exact page, equation, figure or table locator.

### 2.2 Theory compatibility

Every proposed fixture must name its governing plate theory and kinematic
variables. A thin Kirchhoff–Love result may be useful for a documented thin-limit
study, but it is not by itself a finite-thickness Reissner–Mindlin reference.
Likewise, a commercial shell result is an independent implementation comparison,
not an analytical proof of the kernel.

The current element implementation is a four-node Reissner–Mindlin/Mindlin plate
with bilinear interpolation, 2 × 2 bending integration and one-point shear
integration. Any future benchmark approval must state why its theory and boundary
conditions are compatible with that implementation or state the exact limiting
argument being tested.

### 2.3 Mathematical convention

All accepted fixtures and comparison exports must map explicitly to the accepted
ADR. In particular:

- global `+z` and positive transverse displacement `w` point downward;
- internal rotations are `[betaX, betaY]`, with physical rotations
  `phi_x = -betaY` and `phi_y = betaX`;
- physical support couples are `Cx = -Gy` and `Cy = Gx`;
- support reactions use the fixed-DOF residual `Ku - f`;
- equilibrium is reported about `O = (0, W/2)` using the ADR's signed force and
  moment equations;
- the raw bending-moment tensor remains in global Cartesian axes. Oblique `s/t`
  directions are not silently treated as orthonormal tensor axes.

Published rotation, twisting-moment and reaction signs must remain in source
convention until a documented transformation to the ADR convention is reviewed.

### 2.4 No empirical tolerance setting

Acceptance quantities and tolerances must be independently approved before any
candidate implementation or commercial-shell result is generated, viewed,
imported or inspected. No tolerance may be derived from, widened to encompass,
or otherwise tuned against an observed result. This WP defines no numeric
acceptance tolerance.

## 3. Acquisition and review states

The machine records use the following controlled states:

| State | Meaning |
|---|---|
| `primary_full_text_acquired` | Complete original content was obtained and exact locators can be checked. |
| `publisher_record_and_text_acquired` | Publisher metadata and the complete short item text were available, but not necessarily a paginated PDF. |
| `publisher_metadata_only` | Publisher metadata/abstract was available; equations, figures and tables were not. |
| `authoritative_secondary_full_text` | Complete later scholarly source was obtained, but it is not the original source of the cited benchmark. |
| `landing_page_only` | Only a repository or author-upload landing page was found. |
| `not_acquired` | The identified source content was not obtained. |

The controlled `transcriptionReviewState` values are `unverified`,
`independently_checked` and `rejected`. Provenance and source relationship are
recorded separately in `sourceRelation`; ambiguity and fitness-for-use remain
separate qualification fields. Only `independently_checked` primary-source
transcriptions may become accepted benchmark values.

## 4. Required machine-readable provenance

Every future executable reference fixture must contain, directly or by stable
identifier, all of the following fields:

| Group | Required fields |
|---|---|
| Fixture identity | schema version, fixture ID, revision, case ID, status, owner, review status, governing ADR revision and implementation baseline |
| Source identity | source ID, source role, full citation, authors, title, year, edition where applicable, journal/book, volume, issue, page range, DOI, direct URL and access date |
| Acquisition | acquisition state, acquired artifact type, repository path if redistribution is permitted, cryptographic hash if archived, and rights note |
| Exact locator | printed page, PDF page, section, equation, figure, table, row, column and footnote as applicable |
| Source datum | source symbol, literal/source text, numeric value, original unit, significant digits, transcription method, transcriber, transcription date, `sourceRelation` and controlled `transcriptionReviewState` |
| Normalization | exact source expression, numerator quantity, denominator expression, variable definitions and units, inverse conversion expression and dimensional result |
| Geometry | dimensions, vertex order, global axes, local/oblique coordinates, skew-angle definition and the edge/diagonal to which it applies |
| Mechanics | plate theory, thickness, material constants, shear correction, load definition, support definition and rotation convention |
| Discretization | element/formulation if numerical, whole/partial model, mesh topology, refinement family, integration rule and symmetry assumptions |
| Extraction | response quantity, tensor basis, sign convention, physical location, layer/surface, integration point, extrapolation/averaging and singular-point exclusion |
| Qualification | ambiguities, conflicts, assumptions, blockers, permitted use, standards claim and acceptance rationale |

Each numeric datum must have its own exact locator. A citation at fixture level is
not sufficient for a table containing several values. Original units must be
retained even when dimensionless. Conversions must be expressed as formulas, not
only as converted numbers.

## 5. Morley rhombic plate source audit

### 5.1 Original source identity

L. S. D. Morley, “Bending of a Simply Supported Rhombic Plate under Uniform
Normal Loading,” *The Quarterly Journal of Mechanics and Applied Mathematics*,
15(4), November 1962, pp. 413–426,
[doi:10.1093/qjmam/15.4.413](https://doi.org/10.1093/qjmam/15.4.413),
[publisher record](https://academic.oup.com/qjmam/article/15/4/413/1864853).

The publisher record and abstract were acquired. The full original paper was not.
The abstract identifies a small-deflection polar-coordinate solution with the
origin at an obtuse corner, discusses singular behaviour and reports central
displacement and principal moments for skew angles. It does not expose the
complete case definition or numerical tables needed for a fixture.

### 5.2 Corrigendum

L. S. D. Morley, “Corrigendum,” *The Quarterly Journal of Mechanics and Applied
Mathematics*, 16(2), May 1963, p. 271,
[doi:10.1093/qjmam/16.2.271](https://doi.org/10.1093/qjmam/16.2.271),
[publisher record](https://academic.oup.com/qjmam/article/16/2/271/1914673).

The publisher correction states that the labels in Figures 4 and 5 should read
`x, y`; the superscripted theta forms are erroneous. Any later acquisition and
review of the 1962 paper must apply this correction before axes are interpreted.

### 5.3 Attributed secondary transcription

Marin Grbac and Dragan Ribarić (2022), printed pp. 239–243, describe the commonly used Morley
case as a rhombus with edge length `L = 100`, acute angle `30°`, uniform normal
load `q = 1`, and all edges “soft simply supported”: `w = 0` with both reported
coordinate rotations unrestrained. Their Figure 1 is on printed p. 240. The later
study uses `E = 10.92`, `nu = 0.3`, shear correction `k = 5/6`, full-plate
triangular meshes and three nodal variables `w`, `theta_x`, `theta_y`; those are
properties of the 2022 numerical study unless verified in the original.

On printed p. 240 and again in Table 4 on printed p. 242, the later paper reports
the following values as Morley's thin-plate reference:

- `w_c / (10^-3 q L^4 / D) = 0.408`;
- `M_1,c / (10^-2 q L^2) = 1.91`;
- `M_2,c / (10^-2 q L^2) = 1.08`;
- `D = E h^3 / (12 (1 - nu^2))`.

These are not accepted fixture values. Their exact original equations/table,
rounding, angle convention and sign convention have not been verified.

The 2022 study's own Table 4 values are preserved in the machine-readable source
status file as later finite-element cross-check data, including thickness ratios
`L/h = 1000, 100, 10`. They must not be relabelled as analytical or original
Morley results. The authors also discuss difficult convergence for the thinnest
Morley case; independent review is therefore material.

### 5.4 Morley disposition

`blocked_original_not_acquired`. No executable Morley fixture may be generated
from the current records. Required resolution: obtain a lawful full copy of the
1962 paper; verify the case against exact equations, figures and tables; apply the
1963 correction; then perform an independent transcription review.

## 6. Razzaque rhombic plate source audit

### 6.1 Original source identity

A. Razzaque, “Program for Triangular Bending Elements with Derivative
Smoothing,” *International Journal for Numerical Methods in Engineering*, 6(3),
1973, [doi:10.1002/nme.1620060305](https://doi.org/10.1002/nme.1620060305).

The original full text was not acquired. Secondary bibliographies conflict on
the terminal page (`333–343` versus `333–345`); the publisher record or original
issue must settle that metadata before approval.

### 6.2 Attributed secondary transcription

Marin Grbac and Dragan Ribarić (2022), printed pp. 243–245, describe a rhombus with edge length
`L = 100`, acute angle `60°`, uniform load `q = 1`, and two opposite edges simply
supported with `w = 0` and reported rotation `theta_y = 0`. Their Figure 2 is on
printed p. 243. Without the original figure and convention, the exact edge pair,
the direction represented by `theta_y`, and its mapping to the ADR variables
cannot be certified.

Printed p. 243 and Table 8 on printed p. 245 report the original thin finite-
difference `16 × 16` reference as:

- `w_c / (10^-2 q L^4 / D) = 0.7945`;
- `M_y,c / (10^-1 q L^2) = 0.9589`.

These values remain secondary transcriptions. The later paper's own finite-
element values for `L/h = 1000, 100, 10` are retained separately as cross-check
data and are not accepted as Razzaque's result.

### 6.3 Razzaque disposition

`blocked_original_not_acquired_and_axes_ambiguous`. Required resolution: obtain
the original paper, settle its page range, identify the supported edges and axes
from the original figure/text, verify its theory and all normalization formulas,
then complete independent transcription review.

## 7. Later numerical cross-check source

M. Grbac and D. Ribarić, “Accurate Numerical Solutions for Standard Skew Plate
Benchmark Problems,” *Proceedings of the Faculty of Civil Engineering*, 25(1),
2022, pp. 237–246,
[doi:10.32762/zr.25.1.15](https://doi.org/10.32762/zr.25.1.15),
[article page](https://ojs3.uniri.hr/index.php/zr/en/article/view/186),
[direct PDF](https://hrcak.srce.hr/file/417358).

The complete PDF was acquired for review. It reports full-plate FEAP analyses
using a three-node triangular plate element, systematic square-grid families up
to `1024 × 1024`, and centre moments taken from the Gauss point closest to the
centre. These choices and values belong to that study. They provide useful
triangulation and source-discovery evidence, but they are neither original
Morley/Razzaque evidence nor an exact analytical solution.

## 8. Rectangular Reissner–Mindlin reference audit

V28 requires an authoritative rectangular-plate reference compatible with the
solver theory. The following sources were examined:

1. M. Levinson and D. W. Cooke, “Thick rectangular plates—I: The generalized
   Navier solution,” *International Journal of Mechanical Sciences*, 25(3), 1983,
   pp. 199–205,
   [doi:10.1016/0020-7403(83)90093-0](https://doi.org/10.1016/0020-7403(83)90093-0),
   [publisher record](https://www.sciencedirect.com/science/article/pii/0020740383900930).
   The publisher abstract says that the Navier solution is generalized for a
   statically loaded simply supported rectangular plate and includes Mindlin
   theory, but the needed equations, edge convention and numeric cases were not
   available.
2. K. Naumenko, J. Altenbach, H. Altenbach and V. K. Naumenko, “Closed and
   approximate analytical solutions for rectangular Mindlin plates,” *Acta
   Mechanica*, 147, 2001, pp. 153–172,
   [doi:10.1007/BF01182359](https://doi.org/10.1007/BF01182359),
   [official Springer record](https://link.springer.com/article/10.1007/BF01182359).
   Official publisher metadata and the Summary were available; the equations,
   figures and tables remain subscription content and were not acquired.
3. K.-J. Bathe and E. N. Dvorkin, “A Four-Node Plate Bending Element Based on
   Mindlin/Reissner Plate Theory and a Mixed Interpolation,” *International
   Journal for Numerical Methods in Engineering*, 21, 1985, pp. 367–383,
   [doi:10.1002/nme.1620210213](https://doi.org/10.1002/nme.1620210213),
   [lawful MIT-hosted PDF](https://web.mit.edu/kjb/www/Publications_Prior_to_1998/A_Four-Node_Plate_Bending_Element_Based_on_Mindlin_Reissner_Plate_Theory_and_a_Mixed_Interpolation.pdf).
   The full paper was acquired. Printed pp. 369–372 define the mixed
   Mindlin/Reissner element, three plate DOFs and shear factor `k = 5/6`.
   Printed pp. 376–377 present thin square-plate results against Kirchhoff
   solutions as plots, not as an exact finite-thickness tabulation. It is strong
   formulation evidence but does not supply the required V28 reference data.
4. K. Darilmaz, “An Assumed-Stress Finite Element for Static and Free Vibration
   Analysis of Reissner-Mindlin Plates,” *Structural Engineering and Mechanics*,
   19(2), 2005, pp. 199–215,
   [doi:10.12989/sem.2005.19.2.199](https://doi.org/10.12989/sem.2005.19.2.199),
   [publisher PDF](https://www.techno-press.org/download.php?journal=sem&num=2&ordernum=6&volume=19).
   The full paper was acquired. Printed p. 205 defines a simply supported square
   plate under uniform pressure with `a = 10 m`, `E = 10.92 kN/m^2`, `nu = 0.3`
   and `h/a = 0.001, 0.05, 0.1, 0.2`. Table 1 reports the dimensionless centre
   displacement `w_max E h^3 / (p a^4)` and an “Analytical” row of `0.04436`,
   `0.04485`, `0.04632`, `0.05360` for those ratios. The inverse conversion is
   `w_max = value × p a^4 / (E h^3)`. Printed p. 200, equation (2), embeds the
   `5/6` transverse-shear correction in the compliance terms.

Darilmaz attributes its analytical row to Timoshenko and Woinowsky-Krieger
(1959). That underlying edition, exact solution and support convention have not
been acquired and verified. The table is therefore retained only as an
attributed secondary transcription; its values are not accepted merely because
the later paper is open and tabular.

V28 remains `blocked_underlying_analytical_source_not_acquired`. A legitimate
resolution route is to obtain the cited Timoshenko and Woinowsky-Krieger edition
or one of the identified primary analytical candidates, freeze an exact case and
complete independent transcription review. Bathe–Dvorkin and Darilmaz may then
serve as formulation and independent numerical cross-checks respectively.

## 9. Commercial-shell comparison protocol

The machine-readable artifact in `commercial-shell-comparison-protocol.json` is
only a schema/template. It is not an instantiated comparison case, and WP-004
task 6 remains unmet with state `blocked_uninstantiated`. The repository context does not select
an external product or supply the project decisions needed to do so honestly.

No commercial run may be started, and no candidate implementation or commercial
result may be generated, viewed, imported or inspected, until a separately
reviewed instantiated revision fills and freezes:

- the licensed product, exact version/build and solver;
- the shell element and exact bending, transverse-shear, integration and
  stabilization formulation;
- the exact comparison fixture geometry, material, supports, loads and
  extraction stations;
- exact nested mesh subdivisions for every frozen mesh level; and
- independently approved acceptance quantities and tolerances.

Choosing any of these values merely to make progress or after viewing candidate
results is prohibited. The remaining sections define the required instantiation
schema, not selected values.

### 9.1 Independence and model record

The comparison model must be prepared or independently audited by a person who
did not implement the skew kernel. Before solving, freeze and record:

- product, exact version/build, solver, analysis type, nonlinear options and all
  relevant numerical settings;
- shell element name, node count, interpolation, bending/shear formulation,
  transverse-shear correction, integration rule, drilling stabilization,
  hourglass control and reported result locations;
- native model, neutral/input deck where available, solver log, screenshots,
  text/CSV exports and SHA-256 hashes, subject to licence restrictions;
- unit system, global axes, shell local axes, midsurface/offsets, thickness,
  elastic constants, mass/density use and load units;
- whether membrane action is enabled and the magnitude of membrane forces.

Use a linear, small-displacement static plate-bending model unless a separately
approved comparison case says otherwise. The app has no in-plane plate DOFs.
Therefore, do not clamp all six commercial shell DOFs. Restrain transverse
translation and the two bending rotations on the physical support lines as
required by the plate case. Add only the minimum in-plane constraints needed to
remove rigid membrane modes, freeze their nodes/components geometrically, and
report their reactions and membrane resultants. Any drilling restraint or other
stabilization must be disclosed and sensitivity-checked before acceptance.

### 9.2 Geometry, axes and meshes

Construct geometry from the same four global vertices and vertex order as the
app case. Record the skew definition and the transformations between commercial
global/local axes and ADR global `x/y/z`. Do not use visual angle estimates.

Freeze at least four nested, systematic mesh levels before results. Record the
edge subdivisions, element count, topology, nominal dimensions, aspect-ratio and
skew metrics, load-boundary conformity and any local refinement. Mesh families
must be comparable rather than independently hand-tuned. A converged commercial
result remains a comparison result, not an exact solution.

### 9.3 Loads and stations

Freeze each load patch in physical global coordinates, including gross original
contact dimensions, clipped loaded polygon, pressure, total applied force and
station. Use the same clipping rule as the app. Do not renormalize pressure after
edge clipping unless the separately approved case definition explicitly requires
it.

Freeze all extraction coordinates before solving. Avoid known singular corners
or discontinuities unless singular behaviour is the stated test. Record whether
stress resultants are taken at integration points, extrapolated, nodally averaged,
section-cut integrated or otherwise processed.

### 9.4 Signed exports and equilibrium

Retain both raw commercial results and ADR-mapped results. A mapping worksheet
must demonstrate the sign and axis conversion for `w`, `betaX`, `betaY`, `Mx`,
`My`, `Mxy`, `Rz`, `Cx` and `Cy`; a label match is not evidence of a sign match.

For every load station and mesh, export:

1. displacement/rotation table: mesh ID, point ID, global coordinates, raw
   values/axes/units and ADR-mapped `w`, `betaX`, `betaY`;
2. bending-resultant table: mesh ID, point/section ID, coordinates, surface/layer,
   extraction method, raw tensor components and ADR-mapped `Mx`, `My`, `Mxy`;
3. support-action table: support segment, node/section, coordinates, raw forces
   and couples, and ADR-mapped `Rz`, `Cx`, `Cy`;
4. equilibrium table about `O = (0, W/2)`: applied and support `Fz`, `Mx`, `My`,
   signed residuals and the terms used to calculate them;
5. mesh summary and any solver warnings, stabilization energy or discarded modes.

Results and tolerance values are deliberately absent from this uninstantiated
template. Acceptance quantities and tolerances must be approved before any
candidate implementation or commercial result is generated, viewed, imported or
inspected. Generating a run or adding/viewing a result before the separately
reviewed instantiation and approvals is a contract deviation.

## 10. Standards and UK National Annex boundary

This protocol makes no Eurocode compliance claim. Published plate benchmarks and
commercial-shell comparisons validate numerical behaviour; standards define
actions, combinations, resistance and project compliance requirements and do not
validate the FE kernel.

If a future fixture makes a UK bridge-action compliance claim, it must freeze the
project/client-specified Eurocode generation and record the exact standard,
National Annex, edition and amendments. Relevant official records include:

- [BS EN 1991-2:2023 — traffic loads on bridges and other civil engineering works](https://knowledge.bsigroup.com/products/eurocode-1-actions-on-structures-traffic-loads-on-bridges-and-other-civil-engineering-works), published 30 November 2023;
- [PD 6688-2:2011 — background to the UK National Annex to BS EN 1991-2](https://knowledge.bsigroup.com/products/background-to-the-national-annex-to-bs-en-1991-2-traffic-loads-on-bridges).

The BSI second-generation transition guidance permits a coexistence period but
does not authorize silent mixing of generations. The applicable project basis
must be selected before calculations, not inferred by this protocol.

## 11. Independent source-review checklist

An independent reviewer must complete all of the following before this protocol
can move from Proposed:

- [ ] Acquire and identify the exact original Morley paper and apply its 1963 corrigendum.
- [ ] Independently check every Morley datum against an exact locator.
- [ ] Acquire the exact original Razzaque paper and settle the page-range conflict.
- [ ] Resolve Razzaque axes, supported edges, theory and normalization from the original.
- [ ] Acquire a full authoritative rectangular Mindlin reference and select an exact case.
- [ ] Check every numeric transcription, unit and inverse normalization formula.
- [ ] Confirm the published theories and support definitions are relevant to each proposed test.
- [ ] Supply and independently approve a separately instantiated commercial-shell revision, including product/build, element, exact case and exact nested mesh subdivisions, before any run.
- [ ] Approve acceptance quantities and tolerances before any candidate implementation or commercial result is generated, viewed, imported or inspected.
- [ ] Record reviewer identity, date, evidence and disposition in a later controlled revision.

Until every applicable item is resolved, the records remain non-executable and
must not be used to claim kernel verification, benchmark acceptance or standards
compliance.
