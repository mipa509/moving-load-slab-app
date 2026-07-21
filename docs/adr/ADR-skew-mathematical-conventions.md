# ADR: Skew plate mathematical conventions

- **Status:** Accepted - independently reviewed for implementation
- **Date:** 2026-07-21
- **Scope:** Plate kinematics, signs, axes, virtual work, support reactions, coordinate transformations, and skew-mirror identities
- **Integration baseline:** `feat/skew-plate-analysis` at `e990eb5b47c5b50ac7d946794ba8d8dd14437462`

## 1. Decision and authority

This ADR is the authoritative mathematical convention for the existing plate solver and its later skew extensions. It does not validate the element formulation or any benchmark result. Non-zero-skew analysis remains experimental until the verification obligations in Section 12 pass independent review.

The labels below distinguish four kinds of statement:

- **Observed:** current repository behaviour, recorded as evidence rather than authority.
- **Normative:** the convention all later implementation and tests shall follow.
- **Compatibility:** an explicit conversion needed to reconcile current names or packets with the normative convention.
- **Verify:** a later executable or independent check; this ADR freezes algebraic identities, not empirical tolerances.

No design-standard resistance, safety factor, or benchmark value is established here. Chartered Engineer review is required before engineering submission or reliance.

## 2. Global frame, geometry, and positive vertical direction

**Normative.** Let \((\mathbf e_x,\mathbf e_y,\mathbf e_z)\) be a right-handed Cartesian frame:

\[
\mathbf e_x\times\mathbf e_y=\mathbf e_z.
\]

- \(+x\) is roadway longitudinal.
- \(+y\) is roadway transverse.
- \(+z\) is the downward plate-normal direction.
- The undeformed midsurface is \(z=0\), and \(w=\mathbf u\cdot\mathbf e_z\); therefore positive \(w\) is downward.
- A positive vertical force or pressure acts toward \(+z\). Wheel load values and assembled plate loads are signed positive downward, not unsigned magnitudes.

The frozen affine coordinates are

\[
x=s+(t-W/2)\tan\theta,\qquad y=t,
\quad 0\le s\le L,\quad 0\le t\le W,
\]

where positive skew moves each constant-\(s\) support line toward \(+x\) as \(t\) increases. The geometry requires \(|\theta|<90^\circ\).

For global moment sums, the named origin is the start-support centre

\[
O=(0,W/2,0).
\]

This origin lies on the skew-mirror plane and is the same for \(+\theta\) and \(-\theta\).

**Observed.** Positive patch pressure is added directly to the global \(w\)-load entries by `assembleWheelPatchLoads` in `src/solver/loads/patch.ts`; the WP-001 fixture consequently has positive applied load and positive solved \(w\). The viewer deliberately calls `buildZDisplacements(..., -1)` in `src/viewer/scene/ResultSurface.tsx`, so analysis \(+z\) downward is presented as renderer \(-z\). That is a presentation transform, not a solver sign change.

## 3. Generalized degrees of freedom and current B matrices

### 3.1 Ordering and units

**Normative.** At node \(i\), the generalized displacement and conjugate nodal action vectors are

\[
\mathbf d_i=
\begin{bmatrix}w_i&\beta_{X i}&\beta_{Y i}\end{bmatrix}^{\mathsf T},
\qquad
\mathbf f_i=
\begin{bmatrix}F_{z i}&G_{X i}&G_{Y i}\end{bmatrix}^{\mathsf T}.
\]

Their ordering is exactly `[w, betaX, betaY]` per node, and an element vector is `[w1,betaX1,betaY1, ..., w4,betaX4,betaY4]` for Q4 nodes 1 to 4. Units are:

| Quantity | Units |
|---|---:|
| \(w\) | m |
| generalized director parameters \(\beta_X,\beta_Y\) | rad (dimensionless small-angle parameters in algebra) |
| physical right-hand rotations \(\phi_x,\phi_y\) | rad (dimensionless in algebra) |
| \(F_z\) | kN |
| generalized conjugate actions \(G_X,G_Y\) | kN m |
| physical nodal couples \(C_x,C_y\) | kN m |
| curvature | 1/m |
| shear strain | dimensionless |
| \(m_x,m_y,m_{xy}\) | kN m/m |
| \(q_x,q_y\) | kN/m |

**Observed.** `DOF_KEYS`, `DOF_INDEX_BY_KEY`, element assembly, and recovery currently use `[w, rx, ry]` in `src/solver/model/types.ts` and `src/solver/runFixedPositionAnalysis.ts`.

**Compatibility.** Internal current `rx` is \(\beta_X\), and internal current `ry` is \(\beta_Y\). They are not right-hand physical rotations about global \(x\) and \(y\). Later internal code should use `betaX`/`betaY`, or preserve a clearly marked `legacyRxIsBetaX`/`legacyRyIsBetaY` boundary. Public kinematic fields shall use `rotationX`/`rotationY` for the physical right-hand rotations produced by Section 4. Public action fields shall instead use `coupleX`/`coupleY`; reaction couples must not be exposed as rotations. Existing `rx`/`ry` fields are typed legacy aliases whose meaning must be stated at their boundary rather than inferred from the bare names.

### 3.2 B-matrix derivation

For shape function \(N_i\), the current matrices have the following node blocks:

\[
\mathbf B_b^{(i)}=
\begin{bmatrix}
0&N_{i,x}&0\\
0&0&N_{i,y}\\
0&N_{i,y}&N_{i,x}
\end{bmatrix},
\qquad
\mathbf B_s^{(i)}=
\begin{bmatrix}
N_{i,x}&N_i&0\\
N_{i,y}&0&N_i
\end{bmatrix}.
\]

Therefore, without interpreting the current names,

\[
\boldsymbol\kappa=
\begin{bmatrix}\kappa_x\\\kappa_y\\\kappa_{xy}\end{bmatrix}
=
\begin{bmatrix}
\beta_{X,x}\\
\beta_{Y,y}\\
\beta_{X,y}+\beta_{Y,x}
\end{bmatrix},
\qquad
\boldsymbol\gamma=
\begin{bmatrix}\gamma_{xz}\\\gamma_{yz}\end{bmatrix}
=
\begin{bmatrix}
w_{,x}+\beta_X\\
w_{,y}+\beta_Y
\end{bmatrix}.
\]

These identities follow directly from `buildBendingB` and `buildShearB` in `src/solver/core/element.ts`. They are exact and are the reason for the \(\beta\) decision.

## 4. Physical right-hand rotations and virtual-work-conjugate couples

### 4.1 Rotation mapping derived from the director

**Normative.** Define the displaced director to first order as

\[
\mathbf d=\mathbf e_z+\beta_X\mathbf e_x+\beta_Y\mathbf e_y.
\]

Let the physical right-hand rotation vector be

\[
\boldsymbol\phi=\phi_x\mathbf e_x+\phi_y\mathbf e_y.
\]

An infinitesimal right-hand rotation changes the initial director by

\[
\boldsymbol\phi\times\mathbf e_z
=\phi_y\mathbf e_x-\phi_x\mathbf e_y.
\]

Equating director components derives, rather than assumes,

\[
\boxed{\phi_x=-\beta_Y,\qquad \phi_y=\beta_X.}
\]

With

\[
\mathbf J=\begin{bmatrix}0&-1\\1&0\end{bmatrix},
\]

the compact mapping is \(\boldsymbol\phi=\mathbf J\boldsymbol\beta\), and \(\boldsymbol\beta=-\mathbf J\boldsymbol\phi\).

### 4.2 Conjugate couple mapping and invariance

Let \(\mathbf g=[G_X,G_Y]^{\mathsf T}\) be conjugate to \(\boldsymbol\beta\), and let \(\mathbf C=[C_x,C_y]^{\mathsf T}\) be the physical right-hand couple conjugate to \(\boldsymbol\phi\). Virtual work requires

\[
\delta\boldsymbol\beta^{\mathsf T}\mathbf g
=\delta\boldsymbol\phi^{\mathsf T}\mathbf C.
\]

Since \(\mathbf J^{\mathsf T}\mathbf J=\mathbf I\), the unique mapping is

\[
\boxed{\mathbf C=\mathbf J\mathbf g,qquad
C_x=-G_Y,\quad C_y=G_X.}
\]

Indeed,

\[
(\mathbf J\delta\boldsymbol\beta)^{\mathsf T}(\mathbf J\mathbf g)
=\delta\boldsymbol\beta^{\mathsf T}\mathbf g.
\]

This proves both the physical-rotation and physical-couple signs. It also gives the exact unit cases: \(\beta_X=1\Rightarrow\phi_y=1\), \(\beta_Y=1\Rightarrow\phi_x=-1\), \(G_X=1\Rightarrow C_y=1\), and \(G_Y=1\Rightarrow C_x=-1\).

**Compatibility.** At a normalized displacement boundary:

\[
\texttt{rotationX}=-\texttt{internal.ry},\qquad
\texttt{rotationY}=\texttt{internal.rx}.
\]

At an action boundary, after normalizing raw spring terms to external support actions as required by Section 7:

\[
\texttt{coupleX}=-\texttt{normalizedGeneralizedReactionY},\qquad
\texttt{coupleY}=\texttt{normalizedGeneralizedReactionX}.
\]

The action fields are physical couples, not rotations, even though both mappings use the same \(90^\circ\) basis transformation. Input restraints follow the inverse kinematic association: a physical \(x\)-rotation restraint acts on current `ry`, while a physical \(y\)-rotation restraint acts on current `rx`. A sign does not alter a zero restraint or scalar spring energy, but different physical \(x/y\) stiffnesses must be swapped onto the corresponding internal DOFs.

## 5. Curvature, shear, moment, and shear-resultant signs

**Normative.** The engineering vectors and constitutive laws are ordered

\[
\boldsymbol\kappa=[\kappa_x,\kappa_y,\kappa_{xy}]^{\mathsf T},
\quad
\mathbf m=[m_x,m_y,m_{xy}]^{\mathsf T},
\quad
\boldsymbol\gamma=[\gamma_{xz},\gamma_{yz}]^{\mathsf T},
\quad
\mathbf q=[q_x,q_y]^{\mathsf T},
\]

\[
\mathbf m=\mathbf D_b\boldsymbol\kappa,
\qquad
\mathbf q=\mathbf D_s\boldsymbol\gamma,
\]

where the current isotropic matrices are

\[
\mathbf D_b=D
\begin{bmatrix}
1&\nu&0\\
\nu&1&0\\
0&0&(1-\nu)/2
\end{bmatrix},
\quad
D=\frac{E h^3}{12(1-\nu^2)},
\quad
\mathbf D_s=k_sGh\mathbf I,
\quad
G=\frac{E}{2(1+\nu)}.
\]

Thus positive resultants have the signs produced by these matrices from the positive strains in Section 3. `computeMindlinConstitutive` and `recoverElementCenterResults` in `src/solver/core/element.ts` and `src/solver/post/recover.ts` are the observed evidence.

The symmetric generalized plate-moment and curvature tensors are

\[
\mathbf M=
\begin{bmatrix}m_x&m_{xy}\\m_{xy}&m_y\end{bmatrix},
\qquad
\mathbf K_{\mathrm{curv}}=
\begin{bmatrix}\kappa_x&\kappa_{xy}/2\\\kappa_{xy}/2&\kappa_y\end{bmatrix}.
\]

The factor \(1/2\) belongs only in the tensor form of engineering twisting curvature. It does not alter the stored vector component \(\kappa_{xy}\).

For a cut with in-plane unit normal \(\mathbf n\), the generalized bending traction is \(\mathbf g_\beta(\mathbf n)=\mathbf M\mathbf n\); its physical couple is \(\mathbf C(\mathbf n)=\mathbf J\mathbf M\mathbf n\). Consequently \(m_x,m_y\) are tensor components, not interchangeable scalar names for global physical couples.

## 6. Internal and external virtual work

**Normative.** The plate internal virtual work is

\[
\delta W_{\mathrm{int}}
=\int_A\left(
\delta\boldsymbol\kappa^{\mathsf T}\mathbf m
+\delta\boldsymbol\gamma^{\mathsf T}\mathbf q
\right)\,\mathrm dA.
\]

The external nodal virtual work is

\[
\delta W_{\mathrm{ext}}
=\sum_i\left(
\delta w_iF_{z i}
+\delta\beta_{X i}G_{X i}
+\delta\beta_{Y i}G_{Y i}
\right)
=\sum_i\left(
\delta w_iF_{z i}
+\delta\phi_{x i}C_{x i}
+\delta\phi_{y i}C_{y i}
\right).
\]

Applied actions and support actions on the slab use the same signs. There is no separate “reaction-positive” convention. Equilibrium is \(\delta W_{\mathrm{int}}=\delta W_{\mathrm{ext}}\) for admissible virtual displacements, with prescribed-DOF actions recovered as Section 7 defines.

## 7. Fixed and spring support-action signs

### 7.1 Authoritative reaction meaning

**Normative.** A reported reaction is the external action exerted by the support on the slab. A positive reaction component does positive virtual work with its positive generalized displacement. For a positive scalar support stiffness \(k\), the support action is restoring:

\[
\boxed{R_s=-k u}
\]

component by component, including \(R_z=-k_w w\) and \(\mathbf g_s=-\mathbf K_s^{(\beta)}\boldsymbol\beta\). Thus a positive downward spring displacement produces a negative, upward support force. Here \(\mathbf K_s^{(\beta)}\) is the generalized rotational spring-stiffness matrix; it is distinct from the curvature tensor \(\mathbf K_{\mathrm{curv}}\) in Section 5.

### 7.2 Spring stiffness input and distribution contract

**Normative.** A translational component stiffness \(k_w\) has units kN/m. A generalized rotational component stiffness \(k_\beta\), conjugate to \(\beta_X\) or \(\beta_Y\), has units kN m/rad. A point support applies that component stiffness directly.

The current and first-release line-support field `stiffness` is the **total component stiffness of the complete support line**, not a stiffness per unit length. For non-negative Euclidean nodal tributary lengths \(\ell_i\), define

\[
f_i=\frac{\ell_i}{\sum_j\ell_j},\qquad
\sum_i f_i=1,\qquad
k_i=k_{\mathrm{total}}f_i.
\]

An end-node tributary is half its adjacent Euclidean segment; an interior tributary is half the sum of its two adjacent Euclidean segments. A line mapped to one node assigns the total stiffness to that node. The distribution therefore conserves \(\sum_i k_i=k_{\mathrm{total}}\). Current axis-aligned support distances equal their Euclidean lengths; skew support implementation shall calculate the Euclidean lengths explicitly.

The raw products \(k_{w i}w_i\) and \(k_{\beta i}\beta_i\) have units kN and kN m respectively. Their external support-action signs remain those in Section 7.1. If a future per-length modulus is required, it shall use a separately named and typed field such as `stiffnessPerLength`, with translational units kN/m² and generalized rotational units kN/rad. It shall not overload `stiffness`.

**Observed.** `getLineSpringFractionsByNode` in `src/solver/core/supports.ts` normalizes the current tributaries to fractions that sum to one. `src/components/ControlPanel.tsx` labels translation as kN/m, generalized rotation as kN m/rad, and states that a line input is total support stiffness.

### 7.3 Reconciliation with the current solver

Write the assembled matrix as \(\mathbf K=\mathbf K_p+\mathbf K_s\), where \(\mathbf K_p\) is the plate stiffness and \(\mathbf K_s\) is the positive spring diagonal. The current solve uses

\[
(\mathbf K_p+\mathbf K_s)\mathbf u=\mathbf f_a
\]

on free DOFs. Therefore

\[
\mathbf K_p\mathbf u
=\mathbf f_a-\mathbf K_s\mathbf u
=\mathbf f_a+\mathbf R_s.
\]

At prescribed DOFs, the current residual

\[
\mathbf r=\mathbf K\mathbf u-\mathbf f_a
\]

is the fixed support action on the slab. This agrees with the normative sign. For a downward fixed-node load, it is negative/upward.

**Observed conflict.** `buildSupportReactions` in `src/solver/runFixedPositionAnalysis.ts` stores fixed reactions as `residual[dof]`, but spring reactions as `stiffness * displacement`. The spring value is therefore the opposite of the normative external support action.

**Compatibility.** Before public aggregation or reporting, normalize current raw reaction records as follows:

| Current record | Normative generalized support action | Normative physical action |
|---|---|---|
| fixed `w = v` | \(R_z=v\) | \(R_z=v\) |
| fixed `rx = v` | \(G_X=v\) | \(C_y=v\) |
| fixed `ry = v` | \(G_Y=v\) | \(C_x=-v\) |
| spring `w = v=k w` | \(R_z=-v\) | \(R_z=-v\) |
| spring `rx = v=k\beta_X` | \(G_X=-v\) | \(C_y=-v\) |
| spring `ry = v=k\beta_Y` | \(G_Y=-v\) | \(C_x=+v\) |

This conversion affects `FixedPositionAnalysisResult.supportReactions`, `summary.totalVerticalReaction`, the solver-facade `reactions` packet, app reaction summaries/totals, and viewer/report reaction tables. It does not change the positive spring stiffness assembled into \(\mathbf K\).

If the same fixed nodal DOF is attributed to intersecting support definitions, its physical action shall be counted once in global equilibrium. Per-support attribution must partition it explicitly or identify the duplication; it shall never be made to balance by absolute values. Multiple spring assignments on one DOF may be summed after each assignment is converted to its external-action sign.

## 8. Signed global equilibrium

**Normative.** For any applied or reaction vertical nodal force at

\[
\mathbf r_i=(x_i-x_O)\mathbf e_x+(y_i-y_O)\mathbf e_y,
\qquad
\mathbf F_i=F_{z i}\mathbf e_z,
\]

the right-hand cross product gives

\[
\mathbf r_i\times\mathbf F_i
=(y_i-y_O)F_{z i}\mathbf e_x
-(x_i-x_O)F_{z i}\mathbf e_y.
\]

In particular, a positive downward force one unit in \(+y\) gives positive \(M_x\), and the same force one unit in \(+x\) gives negative \(M_y\).

Separate applied set \(A\) and normalized support-action set \(R\), include physical nodal couples, and sum about \(O=(0,W/2,0)\):

\[
F_z^S=\sum_{i\in S}F_{z i},
\]

\[
M_{x,O}^S=\sum_{i\in S}\left[(y_i-W/2)F_{z i}+C_{x i}\right]
=\sum_{i\in S}\left[(y_i-W/2)F_{z i}-G_{Y i}\right],
\]

\[
M_{y,O}^S=\sum_{i\in S}\left[-x_iF_{z i}+C_{y i}\right]
=\sum_{i\in S}\left[-x_iF_{z i}+G_{X i}\right].
\]

The three signed equilibrium equations are

\[
\boxed{F_z^A+F_z^R=0,\qquad
M_{x,O}^A+M_{x,O}^R=0,\qquad
M_{y,O}^A+M_{y,O}^R=0.}
\]

Distributed loads use their exact integrated resultants or consistent nodal forces and moments. Nodal couples must be included. No equilibrium test may compare magnitudes or use nested absolute values to conceal sign.

If the origin is translated by in-plane vector \(\mathbf a\), the moment is \(\mathbf M_{O+\mathbf a}=\mathbf M_O-\mathbf a\times\mathbf F\). A fully equilibrated total is origin-independent, but applied and reaction subtotals are not; tests shall state their origin.

## 9. Support tangent, normals, and local axes

Let \(c=\cos\theta\), \(s_\theta=\sin\theta\). For both start and end supports, define the unit tangent in increasing \(t\) and the unit normal toward increasing span coordinate \(s\):

\[
\boxed{\boldsymbol\tau=(s_\theta,c),\qquad
\mathbf n_+=(c,-s_\theta).}
\]

They satisfy \(\mathbf n_+\cdot\boldsymbol\tau=0\), \(\det[\mathbf n_+\ \boldsymbol\tau]=+1\), and \(\mathbf n_+\cdot\mathbf e_x=c>0\). The support normals are:

| Support | Inward normal | Outward normal | Increasing-\(t\) tangent |
|---|---|---|---|
| start, \(s=0\) | \(+\mathbf n_+\) | \(-\mathbf n_+\) | \(\boldsymbol\tau\) |
| end, \(s=L\) | \(-\mathbf n_+\) | \(+\mathbf n_+\) | \(\boldsymbol\tau\) |

These definitions hold for both signs of skew. At \(\theta=0\), \(\boldsymbol\tau=\mathbf e_y\) and \(\mathbf n_+=\mathbf e_x\).

Let

\[
\mathbf A_\theta=[\mathbf n_+\ \boldsymbol\tau]
=\begin{bmatrix}c&s_\theta\\-s_\theta&c\end{bmatrix}.
\]

For an in-plane polar vector \(\mathbf v\), its increasing-span/tangent components are \(\mathbf v_{nt}=\mathbf A_\theta^{\mathsf T}\mathbf v\), i.e.

\[
v_n=cv_x-s_\theta v_y,
\qquad
v_t=s_\theta v_x+cv_y.
\]

Use the appropriate sign of \(\mathbf n_+\) from the table when an inward or outward component, rather than an increasing-span component, is requested.

## 10. Tensor transformations are not reaction-vector transformations

**Normative.** If the columns of an orthogonal matrix \(\mathbf Q\) are new in-plane basis vectors expressed in global components, then:

\[
\mathbf q'=\mathbf Q^{\mathsf T}\mathbf q,
\qquad
\boldsymbol\beta'=\mathbf Q^{\mathsf T}\boldsymbol\beta,
\qquad
\mathbf g'=\mathbf Q^{\mathsf T}\mathbf g,
\]

but the symmetric plate-moment tensor transforms by

\[
\boxed{\mathbf M'=\mathbf Q^{\mathsf T}\mathbf M\mathbf Q.}
\]

A physical couple is an axial vector. Under a proper in-plane rotation it also resolves as \(\mathbf C'=\mathbf Q^{\mathsf T}\mathbf C\); under a reflection it obeys the axial rule in Section 11 and must not be transformed as a polar reaction vector.

For support axes \(\mathbf Q=\mathbf A_\theta\):

\[
m_{nn}=c^2m_x+s_\theta^2m_y-2cs_\theta m_{xy},
\]

\[
m_{tt}=s_\theta^2m_x+c^2m_y+2cs_\theta m_{xy},
\]

\[
m_{nt}=cs_\theta(m_x-m_y)+(c^2-s_\theta^2)m_{xy}.
\]

The exact 90-degree algebra check, using

\[
\mathbf Q_{90}=\begin{bmatrix}0&-1\\1&0\end{bmatrix},
\]

is \(\mathbf q'=[q_y,-q_x]^{\mathsf T}\) and

\[
\mathbf M'=\begin{bmatrix}m_y&-m_{xy}\\-m_{xy}&m_x\end{bmatrix}.
\]

This is a transformation unit test, not a permissible \(90^\circ\) skew geometry.

## 11. Exact \(+\theta/-\theta\) mirror identities

### 11.1 Point and basis mapping

The actual correspondence from a \(+\theta\) point to the \(-\theta\) model is

\[
(s,t)\mapsto(s,W-t),
\qquad
\boxed{(x,y)\mapsto(x,W-y).}
\]

Let

\[
\mathbf H=\operatorname{diag}(1,-1),\qquad
\mathbf S=\operatorname{diag}(1,-1).
\]

Because the point map sends increasing \(t\) in the \(+\theta\) model to decreasing \(t\) in the \(-\theta\) model, the frozen increasing-\(t\) tangent reverses relative to the reflected vector. Therefore

\[
\boldsymbol\tau_{-\theta}=-\mathbf H\boldsymbol\tau_{+\theta},
\qquad
\mathbf n_{+,-\theta}=\mathbf H\mathbf n_{+,+\theta},
\qquad
\boxed{\mathbf A_{-\theta}=\mathbf H\mathbf A_{+\theta}\mathbf S.}
\]

For a polar or generalized in-plane vector \(\mathbf v^-=\mathbf H\mathbf v^+\), its support components obey

\[
\mathbf v_{nt}^-
=\mathbf A_{-\theta}^{\mathsf T}\mathbf v^-
=\mathbf S\mathbf v_{nt}^+.
\]

Thus its normal component is even and its increasing-\(t\) tangent component is odd. For an in-plane physical axial vector \(\mathbf a^-=-\mathbf H\mathbf a^+\),

\[
\mathbf a_{nt}^-=-\mathbf S\mathbf a_{nt}^+,
\]

so its normal component is odd and its increasing-\(t\) tangent component is even. For a symmetric polar tensor \(\mathbf M^-=\mathbf H\mathbf M^+\mathbf H\), writing \(\mathbf M_{nt}=\mathbf A^{\mathsf T}\mathbf M\mathbf A\) gives

\[
\mathbf M_{nt}^-=\mathbf S\mathbf M_{nt}^+\mathbf S.
\]

Therefore the two local diagonal components are even and the local off-diagonal component is odd. At \(\theta=0\), \(\mathbf A_{+\theta}=\mathbf A_{-\theta}=\mathbf I\); retaining only \(\mathbf H\mathbf A_{+\theta}\) would incorrectly give \(\mathbf H\).

The identities below require the material, mesh topology, support definitions, and load case to be mirrored by this point map. Write \(f^-=f_{-\theta}(x,W-y)\) and \(f^+=f_{+\theta}(x,y)\).

### 11.2 Mirror table

Polar in-plane vectors transform with \(\mathbf H\). Physical rotations and couples are axial; for the 3D reflection \(\operatorname{diag}(1,-1,1)\), an axial vector transforms as determinant times that matrix. Hence:

| Quantity at mapped points | Exact relation |
|---|---|
| \(w\) | \(w^-=+w^+\) |
| \(\beta_X,\beta_Y\) | \(\beta_X^-=+\beta_X^+\), \(\beta_Y^-=-\beta_Y^+\) |
| physical \(\phi_x,\phi_y\) | \(\phi_x^-=-\phi_x^+\), \(\phi_y^-=+\phi_y^+\) |
| \(\kappa_x,\kappa_y,\kappa_{xy}\) | \(\kappa_x,\kappa_y\) even; engineering \(\kappa_{xy}\) odd |
| \(\gamma_{xz},\gamma_{yz}\) | \(\gamma_{xz}\) even; \(\gamma_{yz}\) odd |
| \(m_x,m_y,m_{xy}\) | \(m_x^-=+m_x^+\), \(m_y^-=+m_y^+\), \(m_{xy}^-=-m_{xy}^+\) |
| \(q_x,q_y\) | \(q_x^-=+q_x^+\), \(q_y^-=-q_y^+\) |
| normalized vertical support action \(R_z\) | \(R_z^-=+R_z^+\) |
| applied or normalized support generalized actions \(G_X,G_Y\) | \(G_X^-=+G_X^+\), \(G_Y^-=-G_Y^+\) |
| applied or support physical couples \(C_x,C_y\) | \(C_x^-=-C_x^+\), \(C_y^-=+C_y^+\) |
| support-axis generalized/polar \(\beta_n,q_n,G_n\) | normal components invariant |
| support-axis generalized/polar \(\beta_t,q_t,G_t\) | tangent components reverse sign |
| support-axis physical axial \(\phi_n,C_n\) | normal components reverse sign |
| support-axis physical axial \(\phi_t,C_t\) | tangent components invariant |
| support-axis \(m_{nn},m_{tt},m_{nt}\) | \(m_{nn},m_{tt}\) invariant; \(m_{nt}\) reverses sign |
| applied or reaction \(F_z\) subtotal | invariant |
| applied or reaction \(M_{x,O}\) subtotal | reverses sign |
| applied or reaction \(M_{y,O}\) subtotal | invariant |

The moment-total rows use \(O=(0,W/2,0)\), which is fixed by the mirror. The signed equilibrium residuals have the same parity: vertical and \(M_y\) residuals are even; the \(M_x\) residual is odd. Testing only zero totals is insufficient: applied and reaction subtotals shall be checked separately before their signed cancellation.

### 11.3 Exact zero-skew expectations

At \(\theta=0\):

1. \(x=s\), \(y=t\); support lines are \(x=0,L\).
2. \(\mathbf n_+=\mathbf e_x\), \(\boldsymbol\tau=\mathbf e_y\), and \(\mathbf A_{+\theta}=\mathbf A_{-\theta}=\mathbf I\), so \(m_{nn}=m_x\), \(m_{tt}=m_y\), \(m_{nt}=m_{xy}\).
3. The DOF, physical-rotation, couple, load, and support-action mappings remain exactly the same as for non-zero skew.
4. For a case symmetric about \(y=W/2\), every odd field in the mirror table is zero on the centreline: \(\beta_Y,\phi_x,\kappa_{xy},\gamma_{yz},m_{xy},q_y,G_Y,C_x\). Where support-axis quantities are defined, the odd list also contains \(\beta_t,q_t,G_t,\phi_n,C_n,m_{nt}\). Even fields have equal values at \(y\) and \(W-y\); odd fields have equal magnitude and opposite sign.
5. A positive downward applied load has a negative total vertical support action, and the signed sum is zero. No absolute value is permitted.
6. The WP-001 zero-skew fixture remains characterization of the raw current internal contract, not validation. Its fixed vertical reactions already have the target external-action sign. Any future physical naming or spring normalization is tested as a separate boundary conversion and shall not silently rewrite that fixture.

## 12. Required downstream executable checks

Later work packages shall add compact tests covering all of the following:

1. **B rows:** direct constant/linear fields reproduce exactly \(\gamma_{xz}=w_{,x}+\beta_X\), \(\gamma_{yz}=w_{,y}+\beta_Y\), and all three curvatures in Section 3.
2. **Director/unit mapping:** the four unit rotation/couple cases in Section 4 and inverse mappings.
3. **Virtual work:** arbitrary signed \(\delta\boldsymbol\beta,\mathbf g\) satisfy \(\delta\boldsymbol\beta^{\mathsf T}\mathbf g=\delta\boldsymbol\phi^{\mathsf T}\mathbf C\).
4. **Reaction signs:** one fixed DOF proves `Ku-f` is the support action; one spring DOF proves normalized action is `-k*u` with the dimensions in Section 7; mixed and duplicate support assignments do not double-count global action.
5. **Cross product:** a positive vertical unit force at unit \(+y\) gives \(+M_x\), and at unit \(+x\) gives \(-M_y\), with physical nodal couples added using \((-G_Y,+G_X)\).
6. **Signed equilibrium:** \(F_z\), \(M_x\), and \(M_y\) equations in Section 8 pass without magnitude comparisons for fixed-only, spring-only, and mixed cases.
7. **Support axes:** \(\boldsymbol\tau,\mathbf n_+\), start/end inward/outward normals, orthogonality, unit length, and determinant \(+1\) pass at zero and both signs of skew. Mirror checks prove \(\boldsymbol\tau_-=-\mathbf H\boldsymbol\tau_+\), \(\mathbf A_-=\mathbf H\mathbf A_+\mathbf S\), and \(\mathbf A_+=\mathbf A_-=\mathbf I\) at zero skew.
8. **Transformations:** vector projection, tensor similarity, the exact 90-degree cases, and virtual-work/tensor-contraction invariance pass independently.
9. **Mirror:** every global and corrected local row of the Section 11 table is checked at paired nodes/elements/support actions for mirrored \(+\theta/-\theta\) cases, including curvature, shear strain, applied generalized actions, tensor off-diagonal parity, and applied/reaction moment subtotals about \(O\).
10. **Zero skew:** the WP-001 characterization remains unchanged at the raw internal boundary; symmetric zero-skew parity and centreline-zero identities are added separately.
11. **Packet conversions:** internal `rx/ry` to physical `rotationX`/`rotationY` kinematics, normalized generalized reactions to physical `coupleX`/`coupleY` actions, and raw spring records to external support actions are exercised through solver, facade, app summary, viewer, and report boundaries.
12. **Spring contract:** point stiffness and total-line stiffness use the declared component units; Euclidean tributary fractions sum to one; nodal stiffnesses conserve the total; nodal action dimensions are correct; a per-length modulus is rejected or represented by a separately named and typed field.
13. **Presentation terminology:** support spring text includes the relevant units and total-line meaning; solver theory is labelled Reissner-Mindlin/Mindlin with the actual selective reduced shear integration, not Kirchhoff.

Algebraic identities, unit-vector mappings, sign equations, and 90-degree transformation cases are exact. Floating-point implementation tests shall use scale-aware roundoff criteria from the implementation plan; this ADR intentionally sets no empirical numerical tolerance.

## 13. Current conflicts and required later changes

The current implementation can be reconciled without changing the frozen geometry or WP-001 baseline, but only with explicit later conversion layers:

- `DEFAULT_SIGN_CONVENTION` in `src/solver/runFixedPositionAnalysis.ts` calls current `rx/ry` right-hand rotations about \(+x/+y\). The B matrices prove they are \(\beta_X/\beta_Y\); metadata must be corrected or converted.
- Support input types and UI/report columns named `rx/ry` currently address generalized \(\beta_X/\beta_Y\). A physical API/UI must swap axes and apply the Section 4 signs.
- Current spring reaction records use \(+k u\), opposite the external support-action convention. Section 7 gives the mandatory conversion and affected packets.
- `src/solver/index.ts` passes raw rotational and spring reaction values to public packets, and `src/app/reactionSummary.ts` aggregates them unchanged. Conversion must precede those consumers.
- `src/components/ReportNote.tsx` labels support/reaction columns `Rx/Ry`. Those labels cannot denote physical global couples until conversion. Its “Mxx about y”/“Myy about x” wording is incomplete: \(\mathbf M\) is a generalized plate tensor, and `Myy` on a \(+y\)-normal cut maps to physical \(-x\) couple under this convention.
- The report support formatter emits a bare spring `k` value without the DOF-specific units or total-line meaning. Later report work must include both.
- The report theory row and the default assumptions text call the current solver Kirchhoff. `src/solver/core/element.ts` is a Reissner-Mindlin/Mindlin Q4 implementation with 2 by 2 bending integration and one-point reduced/selective shear integration. Later defaults/report work must use that precise terminology and its still-conditional verification status.
- The existing smoke test uses absolute reaction magnitudes. It must be supplemented or replaced for equilibrium acceptance by the signed equations in Section 8; the WP-001 signed characterization is the correct sign pattern.

These are planned compatibility obligations, not permission for WP-002 source edits. No conflict requires a change to \(x=s+(t-W/2)\tan\theta,\ y=t\) or to the existing characterization fixture.

## 14. Repository evidence used

- `src/solver/core/element.ts`: `buildBendingB`, `buildShearB`, `computeMindlinConstitutive`, and stiffness virtual-work form.
- `src/solver/post/recover.ts`: ordered recovery \(\mathbf m=\mathbf D_b\boldsymbol\kappa\), \(\mathbf q=\mathbf D_s\boldsymbol\gamma\).
- `src/solver/runFixedPositionAnalysis.ts`: current sign metadata, residual `K*u-f`, fixed/spring reaction branches, and vertical summary.
- `src/solver/core/supports.ts`: `[w,rx,ry]` assignment, positive spring stiffness assembly, and normalized total-line distribution.
- `src/solver/model/types.ts`: DOF ordering, result component ordering, and units contract.
- `src/solver/loads/patch.ts`: positive pressure assembled into positive \(w\)-force entries.
- `src/solver/index.ts` and `src/app/reactionSummary.ts`: raw reaction pass-through and aggregation.
- `src/viewer/scene/ResultSurface.tsx`: explicit analysis-to-renderer vertical sign flip.
- `src/solver/benchmarks/zeroSkewCharacterizationFixture.ts` and `src/tests/zeroSkewCharacterization.test.ts`: current zero-skew behaviour and signed fixed-reaction equation, explicitly characterized rather than validated.
- `src/components/ControlPanel.tsx`: component spring units and current total-line input explanation.
- `src/app/defaults.ts`: current incorrect Kirchhoff assumption text.
- `src/components/ReportNote.tsx`: bare spring-value formatting, current incorrect Kirchhoff theory row, and reaction/plate-moment wording.

The rotation, couple, cross-product, transformation, and mirror identities above were derived in this ADR from the right-handed basis and virtual-work invariance. No external benchmark value or unsourced empirical tolerance was used.
