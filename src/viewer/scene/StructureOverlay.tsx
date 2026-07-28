import { useMemo } from "react";
import { Html, Line } from "@react-three/drei";
import { Shape } from "three";
import type { AnalysisResults, SlabModel } from "../../app/types";
import { buildDeckPolygon } from "../../solver/geometry/deckCoordinates";
import { computeDeckSectionStripPolygon, toXY } from "../overlayGeometry";
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
const PATCH_ORIGINAL_OUTLINE_WIDTH = 0.9;
const PATCH_ORIGINAL_OUTLINE_OPACITY = 0.55;
const SECTION_FILL = "#5fc9c1";
const SECTION_FILL_OPACITY = 0.16;
const SECTION_OUTLINE = "#0e524d";
const SECTION_OUTLINE_WIDTH = 1.2;

type XYPoint = { x: number; y: number };

/** Closes a polygon ring (repeats the first point) and tags every vertex with
 * a fixed z so it can be handed straight to drei's `<Line>`. */
function toClosedLinePoints(
  polygon: readonly XYPoint[],
  z: number,
): [number, number, number][] {
  if (polygon.length === 0) {
    return [];
  }
  return [...polygon, polygon[0]].map(
    (point) => [point.x, point.y, z] as [number, number, number],
  );
}

/** Fills an arbitrary (convex) polygon as a flat, print-safe mesh. Builds a
 * `THREE.Shape` from the polygon's `{x,y}` ring and renders it with
 * `shapeGeometry`, matching the flat XY plane the existing `planeGeometry`
 * fills already render in, so it drops in at the same z-offsets. */
function PolygonFill({
  polygon,
  color,
  opacity,
  z,
}: {
  polygon: readonly XYPoint[];
  color: string;
  opacity: number;
  z: number;
}) {
  const shape = useMemo(() => {
    if (polygon.length < 3) {
      return null;
    }
    const nextShape = new Shape();
    nextShape.moveTo(polygon[0].x, polygon[0].y);
    for (let index = 1; index < polygon.length; index += 1) {
      nextShape.lineTo(polygon[index].x, polygon[index].y);
    }
    nextShape.closePath();
    return nextShape;
  }, [polygon]);

  if (!shape) {
    return null;
  }

  return (
    <mesh position={[0, 0, z]}>
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

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
  const maxDim = Math.max(Lx, Ly);
  const pointGlyphSize = clamp(maxDim * 0.04, 0.16, 0.28);
  const lineGlyphSize = pointGlyphSize * 0.8;
  const chipOffset = clamp(maxDim * 0.045, 0.22, SUPPORT_CHIP_OFFSET_M);

  const boundaryPoints = useMemo(() => {
    let polygon: XYPoint[];
    try {
      polygon = buildDeckPolygon(model.geometry);
    } catch {
      polygon = [
        { x: 0, y: 0 },
        { x: Lx, y: 0 },
        { x: Lx, y: Ly },
        { x: 0, y: Ly },
      ];
    }
    return toClosedLinePoints(polygon, 0.01);
  }, [model.geometry, Lx, Ly]);

  const sectionPolygon = useMemo(
    () => computeDeckSectionStripPolygon(model),
    [model.geometry, model.deckSection],
  );

  const supportVisuals = useMemo(
    () => buildSupportVisuals(model.supports, model.geometry),
    [model.supports, model.geometry],
  );

  const wheelPatchOverlays = results.wheelPatchOverlays ?? [];
  const useWheelPatchOverlays = wheelPatchOverlays.length > 0;

  return (
    <>
      <Line points={boundaryPoints} color="#e3ebf5" lineWidth={1.5} />

      {showSectionStrip && sectionPolygon ? (
        <group>
          <PolygonFill
            polygon={sectionPolygon}
            color={SECTION_FILL}
            opacity={SECTION_FILL_OPACITY}
            z={0.018}
          />
          <Line
            points={toClosedLinePoints(sectionPolygon, 0.022)}
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

      {showWheelPatches && useWheelPatchOverlays &&
        wheelPatchOverlays.map((overlay) => {
          const originalPolygon = toXY(overlay.originalPolygon);
          const clippedPolygon = overlay.clippedPolygon ? toXY(overlay.clippedPolygon) : null;

          return (
            <group key={overlay.id}>
              {originalPolygon.length >= 3 ? (
                <Line
                  points={toClosedLinePoints(originalPolygon, 0.019)}
                  color={PATCH_OUTLINE}
                  lineWidth={PATCH_ORIGINAL_OUTLINE_WIDTH}
                  transparent
                  opacity={PATCH_ORIGINAL_OUTLINE_OPACITY}
                  dashed
                  dashSize={0.06}
                  gapSize={0.05}
                />
              ) : null}

              {clippedPolygon && clippedPolygon.length >= 3 ? (
                <>
                  <PolygonFill
                    polygon={clippedPolygon}
                    color={PATCH_FILL}
                    opacity={PATCH_FILL_OPACITY}
                    z={0.02}
                  />
                  <Line
                    points={toClosedLinePoints(clippedPolygon, 0.025)}
                    color={PATCH_OUTLINE}
                    lineWidth={PATCH_OUTLINE_WIDTH}
                  />
                </>
              ) : null}
            </group>
          );
        })}

      {showWheelPatches && !useWheelPatchOverlays &&
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
