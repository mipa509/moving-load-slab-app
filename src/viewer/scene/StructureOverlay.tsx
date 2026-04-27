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
  showSectionStrip?: boolean;
}

const SUPPORT_FILL = "#76ddff";
const SUPPORT_LINE = "#98ebff";
const SUPPORT_CHIP_OFFSET_M = 0.34;
const PATCH_FILL = "#e85d2c";
const PATCH_FILL_OPACITY = 0.55;
const PATCH_OUTLINE = "#3a1206";
const PATCH_OUTLINE_WIDTH = 1.4;
const SECTION_FILL = "#5fc9c1";
const SECTION_FILL_OPACITY = 0.16;
const SECTION_OUTLINE = "#0e524d";
const SECTION_OUTLINE_WIDTH = 1.2;

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
  showSectionStrip = true,
}: StructureOverlayProps) => {
  const Lx = model.geometry.lengthM;
  const Ly = model.geometry.widthM;
  const sectionAxisIsX =
    model.section.axis === "x" ||
    (model.section.axis === "auto" &&
      (model.placement.travelDirection === "x+" ||
        model.placement.travelDirection === "x-"));
  const halfStrip = model.section.widthM / 2;
  const sectionRect = sectionAxisIsX
    ? {
        xMin: 0,
        xMax: Lx,
        yMin: Math.max(0, model.section.centerPerpM - halfStrip),
        yMax: Math.min(Ly, model.section.centerPerpM + halfStrip),
      }
    : {
        xMin: Math.max(0, model.section.centerPerpM - halfStrip),
        xMax: Math.min(Lx, model.section.centerPerpM + halfStrip),
        yMin: 0,
        yMax: Ly,
      };
  const sectionWidth = sectionRect.xMax - sectionRect.xMin;
  const sectionHeight = sectionRect.yMax - sectionRect.yMin;
  const sectionOutline: [number, number, number][] = [
    [sectionRect.xMin, sectionRect.yMin, 0.022],
    [sectionRect.xMax, sectionRect.yMin, 0.022],
    [sectionRect.xMax, sectionRect.yMax, 0.022],
    [sectionRect.xMin, sectionRect.yMax, 0.022],
    [sectionRect.xMin, sectionRect.yMin, 0.022],
  ];
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

      {showSectionStrip && sectionWidth > 0 && sectionHeight > 0 ? (
        <group>
          <mesh
            position={[
              sectionRect.xMin + sectionWidth / 2,
              sectionRect.yMin + sectionHeight / 2,
              0.018,
            ]}
          >
            <planeGeometry args={[sectionWidth, sectionHeight]} />
            <meshBasicMaterial
              color={SECTION_FILL}
              transparent
              opacity={SECTION_FILL_OPACITY}
            />
          </mesh>
          <Line
            points={sectionOutline}
            color={SECTION_OUTLINE}
            lineWidth={SECTION_OUTLINE_WIDTH}
            dashed
            dashSize={0.2}
            gapSize={0.12}
          />
        </group>
      ) : null}

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
          const outline: [number, number, number][] = [
            [patch.xMinM, patch.yMinM, 0.025],
            [patch.xMaxM, patch.yMinM, 0.025],
            [patch.xMaxM, patch.yMaxM, 0.025],
            [patch.xMinM, patch.yMaxM, 0.025],
            [patch.xMinM, patch.yMinM, 0.025],
          ];
          return (
            <group key={`wp-${index}`}>
              <mesh position={[patch.xMinM + width / 2, patch.yMinM + height / 2, 0.02]}>
                <planeGeometry args={[width, height]} />
                <meshBasicMaterial color={PATCH_FILL} transparent opacity={PATCH_FILL_OPACITY} />
              </mesh>
              <Line points={outline} color={PATCH_OUTLINE} lineWidth={PATCH_OUTLINE_WIDTH} />
            </group>
          );
        })}
    </>
  );
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
