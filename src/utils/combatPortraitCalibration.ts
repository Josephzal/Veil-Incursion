/**
 * Per-weapon / per-pose combat portrait calibration.
 *
 * SIZE (edit visualScale):
 *   1. Base lock: opaque content height → envoy-vambrace idle (Vambrace)
 *      in combatPlayerPortrait.ts
 *   2. Then multiply by this pose's visualScale (1 = match Vambrace content height)
 *
 *   Lower visualScale → smaller on screen. Tune idle and attack separately.
 *   Keep idle/attack within ~10% so the body doesn't jump on strike.
 *
 * Seeds below = canvas-aspect compensation vs Vambrace
 *   (refW/refContentH) / (poseW/poseContentH), clamped — then hand-tunable.
 *
 * PLACEMENT: bodyAnchorX, translateX, translateY, releasePoint, tipPoint
 *
 * IDs:
 *   Aegis  — aegis-longsword | aegis-paired-blades | aegis-claymore
 *   Hex    — hex-revolver | hex-carbine | hex-shotgun
 *   Envoy  — envoy-vambrace | envoy-scythe | envoy-sanguine-prism
 */

import type { WeaponFamilyId } from '../types/weapon';

export type PoseCalibration = {
  /**
   * Size multiplier after Vambrace content-height lock.
   * 1 = same opaque height as envoy-vambrace idle.
   * 0.8 = 20% smaller. Edit per idle / attack image.
   */
  visualScale: number;
  /** Planted-body X in canvas (0 = left, 0.5 = center). Idle uses 0.5. */
  bodyAnchorX: number;
  translateX: number;
  translateY: number;
  /** Reserved — not applied to size currently. */
  maxWidthCoverage: number;
  /** Normalized release point in canvas space (weapon / hand). */
  releasePoint: { x: number; y: number };
  tipPoint?: { x: number; y: number };
};

function pose(
  visualScale: number,
  bodyAnchorX: number,
  extras: Partial<PoseCalibration> = {},
): PoseCalibration {
  return {
    visualScale,
    bodyAnchorX,
    translateX: 0,
    translateY: 0,
    maxWidthCoverage: 1,
    releasePoint: { x: 0.55, y: 0.45 },
    ...extras,
  };
}

/**
 * visualScale seeds from image dimensions vs Vambrace idle aspect.
 * REFERENCE: envoy-vambrace idle = 1.
 */
export const POSE_CALIBRATION: Record<WeaponFamilyId, { idle: PoseCalibration; attack: PoseCalibration }> = {
  'aegis-longsword': {
    // Combat layout for Longsword is driven by combatPoseRegistration.ts
    // (body height + planted foot). visualScale here is unused for arena layout
    // but retained for tooling / legacy helpers.
    idle: pose(0.79, 0.5, { releasePoint: { x: 0.58, y: 0.38 }, tipPoint: { x: 0.72, y: 0.12 } }),
    attack: pose(0.6, 0.30, { releasePoint: { x: 0.55, y: 0.40 }, tipPoint: { x: 0.82, y: 0.28 } }),
  },
  'aegis-paired-blades': {
    idle: pose(0.66, 0.5, { releasePoint: { x: 0.48, y: 0.45 }, tipPoint: { x: 0.35, y: 0.78 } }),
    attack: pose(0.60, 0.32, { releasePoint: { x: 0.46, y: 0.44 }, tipPoint: { x: 0.78, y: 0.36 } }),
  },
  'aegis-claymore': {
    idle: pose(0.68, 0.5, { releasePoint: { x: 0.55, y: 0.36 }, tipPoint: { x: 0.62, y: 0.08 } }),
    attack: pose(0.65, 0.34, { releasePoint: { x: 0.52, y: 0.34 }, tipPoint: { x: 0.58, y: 0.10 } }),
  },
  'hex-revolver': {
    idle: pose(0.94, 0.5, { releasePoint: { x: 0.68, y: 0.48 } }),
    attack: pose(0.90, 0.50, { releasePoint: { x: 0.72, y: 0.46 } }),
  },
  'hex-carbine': {
    idle: pose(0.94, 0.5, { releasePoint: { x: 0.74, y: 0.46 } }),
    attack: pose(0.9, 0.48, { releasePoint: { x: 0.78, y: 0.44 } }),
  },
  'hex-shotgun': {
    idle: pose(0.95, 0.5, { releasePoint: { x: 0.70, y: 0.48 } }),
    attack: pose(0.82, 0.42, { releasePoint: { x: 0.76, y: 0.46 } }),
  },
  // REFERENCE — leave at 1 unless you want to change the global target size.
  'envoy-vambrace': {
    idle: pose(.96, 0.5, { releasePoint: { x: 0.58, y: 0.50 } }),
    attack: pose(0.92, 0.48, { releasePoint: { x: 0.60, y: 0.48 } }),
  },
  'envoy-scythe': {
    idle: pose(0.95, 0.5, { releasePoint: { x: 0.62, y: 0.40 }, tipPoint: { x: 0.82, y: 0.22 } }),
    attack: pose(0.7, 0.28, {
      translateX: 8,
      releasePoint: { x: 0.40, y: 0.42 },
      tipPoint: { x: 0.78, y: 0.30 },
    }),
  },
  'envoy-sanguine-prism': {
    idle: pose(0.95, 0.5, { releasePoint: { x: 0.55, y: 0.46 } }),
    attack: pose(0.72, 0.30, {
      translateX: 6,
      releasePoint: { x: 0.42, y: 0.44 },
      tipPoint: { x: 0.72, y: 0.36 },
    }),
  },
};

export function getPoseCalibrationForFamily(
  weaponFamilyId: WeaponFamilyId,
  poseKind: 'idle' | 'attack',
): PoseCalibration {
  return POSE_CALIBRATION[weaponFamilyId][poseKind];
}

export function listPoseCalibrations(): Array<{
  weaponFamilyId: WeaponFamilyId;
  idle: PoseCalibration;
  attack: PoseCalibration;
}> {
  return (Object.keys(POSE_CALIBRATION) as WeaponFamilyId[]).map((weaponFamilyId) => ({
    weaponFamilyId,
    idle: POSE_CALIBRATION[weaponFamilyId].idle,
    attack: POSE_CALIBRATION[weaponFamilyId].attack,
  }));
}

/**
 * Pure size math: content-height lock × optional visualScale.
 */
export function computeContentLockedDisplaySize(input: {
  canvasW: number;
  canvasH: number;
  contentH: number;
  referenceContentDisplayH: number;
  visualScale?: number;
}): { width: number; height: number; scale: number } {
  const scale = (input.referenceContentDisplayH / Math.max(1, input.contentH))
    * (input.visualScale ?? 1);
  return {
    scale,
    width: input.canvasW * scale,
    height: input.canvasH * scale,
  };
}

/** @deprecated Use computeContentLockedDisplaySize */
export function computeCalibratedDisplaySize(input: {
  canvasW: number;
  canvasH: number;
  contentH: number;
  referenceContentDisplayH: number;
  visualScale?: number;
  maxWidthCoverage?: number;
  boxWidth?: number;
}): { width: number; height: number } {
  return computeContentLockedDisplaySize(input);
}
