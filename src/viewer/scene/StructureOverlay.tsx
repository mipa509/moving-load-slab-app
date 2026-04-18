import { useMemo } from "react";
import { Html, Line } from "@react-three/drei";
import type { AnalysisResults, SlabModel } from "../../app/types";
import { buildSupportVisuals } from "../supportPresentation";

interface StructureOverlayProps {
  model: SlabModel;
  results: AnalysisResults;
  showSupports: boolean;
  showWheelPatches: boolean;
  showRestraintChips: boolean;
}

const SUPPORT_FILL = "#76ddff";
const SUPPORT_LINE = "#98ebff";
const SUPPORT_CHIP_OFFSET_M = 0.34;

const SupportGlyph = ({
  position,
  size,
}: {
  position: [number, number];
  size: number;
}) => (
  <group position={[position[0], position[1], 0.04]}>
    <mesh position={[0, size * 0.36, 0]}>
      <planeGeometry args={[size * 1.12, size * 0.15]} />
      <meshBasicMaterial color={SUPPORT_LINE} transparent opacity={0.95} />
    </mesh>
    <mesh rotation={[0, 0, Math.PI]}>
      <circleGeometry args={[size * 0.62, 3]} />
      <meshBasicMaterial color={SUPPORT_FILL} transparent opacity={0.96} />
    </mesh>
  </group>
);

export const StructureOverlay = ({
  model,
  results,
  showSupports,
  showWheelPatches,
  showRestraintChips,
}: StructureOverlayProps) => {
  const Lx = model.geometry.lengthM;
  const Ly = model.geometry.widthM;
  const maxDim = Math.max(Lx, Ly);
  const pointGlyphSize = clamp(maxDim * 0.04, 0.16, 0.28);
  const lineGlyphSize = pointGlyphSize * 0.8;
  const chipOffset = clamp(maxDim * 0.045, 0.22, SUPPORT_CHIP_OFFSET_M);

  const boundaryPoints = useMemo(
    () =>
      [
        [0, 0, 0.01],
        [Lx, 0, 0.01],
        [Lx, Ly, 0.01],
        [0, Ly, 0.01],
        [0, 0, 0.01],
      ] as [number, number, number][],
    [Lx, Ly],
  );

  const supportVisuals = useMemo(() => buildSupportVisuals(model.supports), [model.supports]);

  return (
    <>
      <Line points={boundaryPoints} color="#e3ebf5" lineWidth={1.5} />

      {showSupports &&
        supportVisuals.map((visual) => (
          <group key={visual.id}>
            {visual.linePoints ? (
              <Line
                points={[
                  [visual.linePoints[0][0], visual.linePoints[0][1], 0.02],
                  [visual.linePoints[1][0], visual.linePoints[1][1], 0.02],
                ]}
                color={SUPPORT_LINE}
                lineWidth={3.4}
              />
            ) : null}

            {visual.glyphAnchors.map((anchor, index) => (
              <SupportGlyph
                key={`${visual.id}-glyph-${index}`}
                position={anchor}
                size={visual.kind === "point" ? pointGlyphSize : lineGlyphSize}
              />
            ))}

            {showRestraintChips && (
              <Html
                position={[
                  visual.labelAnchor[0],
                  visual.labelAnchor[1] + (visual.labelAnchor[1] > Ly * 0.82 ? -chipOffset : chipOffset),
                  0.08,
                ]}
                center
                style={{ pointerEvents: "none" }}
              >
                <div className="viewer-support-card" aria-label={`${visual.id} restraint state`}>
                  <div className="viewer-support-card-title">{visual.id}</div>
                  <div className="viewer-support-chip-row">
                    {visual.chips.map((chip) => (
                      <span
                        key={`${visual.id}-${chip.dof}`}
                        className={`viewer-support-chip viewer-support-chip-${chip.tone}`}
                      >
                        {chip.label}
                      </span>
                    ))}
                  </div>
                </div>
              </Html>
            )}
          </group>
        ))}

      {showWheelPatches &&
        (results.wheelPatches ?? []).map((patch, index) => {
          const width = patch.xMaxM - patch.xMinM;
          const height = patch.yMaxM - patch.yMinM;
          return (
            <mesh
              key={`wp-${index}`}
              position={[patch.xMinM + width / 2, patch.yMinM + height / 2, 0.02]}
            >
              <planeGeometry args={[width, height]} />
              <meshBasicMaterial color="#f4b534" transparent opacity={0.34} />
            </mesh>
          );
        })}
    </>
  );
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
