/**
 * Anatomy-based combat pose registration (pure math — no React Native imports).
 *
 * Aligns idle/attack by planted-foot + body height inside a fixed actor box,
 * so extended weapon bounds do not shrink or recenter the body.
 *
 * Checkpoint 1: Aegis Runed Longsword only. Other weapons keep legacy footprint layout.
 */

import type { WeaponFamilyId } from '../types/weapon';

export type PoseFootprintBox = { width: number; height: number };

/** Normalized source-space pose anchors (0–1, origin top-left of the PNG). */
export type CombatPoseRegistration = {
  poseId: string;
  canvasW: number;
  canvasH: number;
  /** Ground-contact point (typically midpoint between heels). */
  plantedFoot: { x: number; y: number };
  /** Top of head / crown (excludes overhead weapon tips). */
  bodyTop: number;
  /** Bottom of boots / soles. */
  bodyBottom: number;
  /**
   * Reference body height in source pixels.
   * Prefer (bodyBottom - bodyTop) * canvasH — stored explicitly for tests.
   */
  bodyHeightPx: number;
  /** Normalized weapon anchors in source image space. */
  weaponHilt: { x: number; y: number };
  weaponTip: { x: number; y: number };
  bladeMid?: { x: number; y: number };
  /** Unit vector in source space — tip minus hilt, normalized. */
  targetFacing: { x: number; y: number };
};

export type NormalizedPoint = { x: number; y: number };

export type RegisteredPoseKind = 'idle' | 'attack';

export type ActorGroundAnchor = {
  /** Fixed foot target X in the actor box (px from left). */
  x: number;
  /** Fixed foot target Y in the actor box (px from top). */
  y: number;
  /** Shared on-screen body height for every registered pose (px). */
  targetBodyDisplayH: number;
};

export type RegisteredPoseLayout = {
  poseId: string;
  scale: number;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Rendered planted-foot position in the actor box. */
  footX: number;
  footY: number;
  /** Rendered body top / bottom (px from top of box). */
  bodyTopY: number;
  bodyBottomY: number;
  renderedBodyHeight: number;
};

/**
 * Dev-only pose alignment overlay. Mirror ENEMY_HITBOX_DEBUG —
 * flip to true while tuning Longsword registration in the arena.
 */
export const PLAYER_POSE_ALIGN_DEBUG = false;

type ForcedPose = RegisteredPoseKind | null;
let forcedPose: ForcedPose = null;
const forcedPoseListeners = new Set<(pose: ForcedPose) => void>();

/** Development control — force idle/attack without combat lunge. No-op in production UI. */
export function getPoseAlignDebugForcedPose(): ForcedPose {
  return forcedPose;
}

export function setPoseAlignDebugForcedPose(pose: ForcedPose): void {
  forcedPose = pose;
  forcedPoseListeners.forEach((fn) => fn(pose));
}

export function cyclePoseAlignDebugForcedPose(): ForcedPose {
  const order: ForcedPose[] = [null, 'idle', 'attack'];
  const idx = order.indexOf(forcedPose);
  const next = order[(idx + 1) % order.length] ?? null;
  setPoseAlignDebugForcedPose(next);
  return next;
}

export function subscribePoseAlignDebugForcedPose(
  listener: (pose: ForcedPose) => void,
): () => void {
  forcedPoseListeners.add(listener);
  return () => {
    forcedPoseListeners.delete(listener);
  };
}

/**
 * Measured from PNG alpha + body-mass columns (excludes overhead sword tip on idle;
 * planted foot = midpoint of heel span).
 */
export const AEGIS_LONGSWORD_POSE_REGISTRATION: Record<RegisteredPoseKind, CombatPoseRegistration> = {
  idle: {
    poseId: 'aegis-longsword:idle',
    canvasW: 400,
    canvasH: 1172,
    plantedFoot: { x: 0.4713, y: 0.9834 },
    bodyTop: 0.1809,
    bodyBottom: 0.9838,
    bodyHeightPx: 941,
    weaponHilt: { x: 0.5244, y: 0.4658 },
    weaponTip: { x: 0.9700, y: 0.0111 },
    bladeMid: { x: 0.7472, y: 0.2385 },
    targetFacing: { x: 0.422, y: -0.907 },
  },
  attack: {
    poseId: 'aegis-longsword:attack',
    canvasW: 800,
    canvasH: 998,
    plantedFoot: { x: 0.3787, y: 0.9584 },
    bodyTop: 0.0120,
    bodyBottom: 0.9589,
    bodyHeightPx: 945,
    weaponHilt: { x: 0.2763, y: 0.2325 },
    weaponTip: { x: 0.9813, y: 0.4178 },
    bladeMid: { x: 0.6288, y: 0.3252 },
    // Blade swings toward screen-right / slightly down.
    targetFacing: { x: 0.967, y: 0.255 },
  },
};

/**
 * Authored tip arc fallback (attack-pose source space).
 * Prefer buildLongswordSweptBladeSamples — this remains for debug overlays.
 */
export const AEGIS_LONGSWORD_SWING_PATH_NORM: readonly NormalizedPoint[] = [
  { x: 0.32, y: 0.10 },
  { x: 0.48, y: 0.14 },
  { x: 0.66, y: 0.24 },
  { x: 0.82, y: 0.34 },
  { x: 0.9813, y: 0.4178 },
];

export type BladeSample = {
  hilt: { x: number; y: number };
  tip: { x: number; y: number };
};

/**
 * Map a normalized source-image point through a registered pose layout
 * into actor-box coordinates (px from the art-box top-left).
 */
export function mapRegisteredSourcePointToActorBox(
  layout: RegisteredPoseLayout,
  point: NormalizedPoint,
): { x: number; y: number } {
  return {
    x: layout.left + point.x * layout.width,
    y: layout.top + point.y * layout.height,
  };
}

export function mapRegisteredSourcePolylineToActorBox(
  layout: RegisteredPoseLayout,
  points: readonly NormalizedPoint[],
): Array<{ x: number; y: number }> {
  return points.map((p) => mapRegisteredSourcePointToActorBox(layout, p));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

/**
 * Swept blade samples from registered idle orientation → attack orientation.
 * Interpolates hilt/tip in actor-box space (pivot near the hand).
 * Local to the player art box — never extends toward enemy targets.
 */
export function buildLongswordSweptBladeSamples(
  idleLayout: RegisteredPoseLayout,
  attackLayout: RegisteredPoseLayout,
  sampleCount = 4,
): BladeSample[] {
  const idle = AEGIS_LONGSWORD_POSE_REGISTRATION.idle;
  const attack = AEGIS_LONGSWORD_POSE_REGISTRATION.attack;
  const idleHilt = mapRegisteredSourcePointToActorBox(idleLayout, idle.weaponHilt);
  const idleTip = mapRegisteredSourcePointToActorBox(idleLayout, idle.weaponTip);
  const attackHilt = mapRegisteredSourcePointToActorBox(attackLayout, attack.weaponHilt);
  const attackTip = mapRegisteredSourcePointToActorBox(attackLayout, attack.weaponTip);
  const count = Math.max(3, Math.min(6, Math.floor(sampleCount)));
  const samples: BladeSample[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = easeInOutCubic(i / (count - 1));
    samples.push({
      hilt: {
        x: lerp(idleHilt.x, attackHilt.x, t),
        y: lerp(idleHilt.y, attackHilt.y, t),
      },
      tip: {
        x: lerp(idleTip.x, attackTip.x, t),
        y: lerp(idleTip.y, attackTip.y, t),
      },
    });
  }
  return samples;
}

/** True when every tip/hilt sample lies inside the actor box (with padding). */
export function sweptBladeSamplesWithinActorBox(
  samples: readonly BladeSample[],
  box: PoseFootprintBox,
  padPx = 28,
): boolean {
  return samples.every((s) => (
    s.hilt.x >= -padPx
    && s.hilt.y >= -padPx
    && s.hilt.x <= box.width + padPx
    && s.hilt.y <= box.height + padPx
    && s.tip.x >= -padPx
    && s.tip.y >= -padPx
    && s.tip.x <= box.width + padPx
    && s.tip.y <= box.height + padPx
  ));
}

/** Matches prior idle visual weight under the Vambrace content-height lock × 0.79. */
const LONGSWORD_IDLE_LEGACY_CONTENT_H = 1200;
const LONGSWORD_IDLE_LEGACY_VISUAL_SCALE = 1.17;
/** Attack canvas only — keep idle planted; nudge down if the swing reads oversized. */
const LONGSWORD_ATTACK_VISUAL_SCALE = 0.97;

/** Envoy Vambrace idle — shared global size reference (same as combatPlayerPortrait). */
const REF_CANVAS_W = 772;
const REF_CANVAS_H = 1734;
const REF_CONTENT_H = 1714;

export function usesAnatomyPoseRegistration(
  weaponFamilyId: WeaponFamilyId | null | undefined,
): boolean {
  return weaponFamilyId === 'aegis-longsword';
}

export function getPoseRegistration(
  weaponFamilyId: WeaponFamilyId | null | undefined,
  pose: RegisteredPoseKind,
): CombatPoseRegistration | null {
  if (!usesAnatomyPoseRegistration(weaponFamilyId)) return null;
  return AEGIS_LONGSWORD_POSE_REGISTRATION[pose];
}

function referenceContentDisplayH(box: PoseFootprintBox): number {
  const contain = Math.min(box.width / REF_CANVAS_W, box.height / REF_CANVAS_H);
  return REF_CONTENT_H * contain;
}

/**
 * Shared ground anchor for a registered weapon — derived from idle anatomy so
 * the actor box never moves when swapping to attack.
 */
export function resolveActorGroundAnchor(
  box: PoseFootprintBox,
  idle: CombatPoseRegistration,
): ActorGroundAnchor {
  const legacyIdleScale = (referenceContentDisplayH(box) / LONGSWORD_IDLE_LEGACY_CONTENT_H)
    * LONGSWORD_IDLE_LEGACY_VISUAL_SCALE;
  const targetBodyDisplayH = idle.bodyHeightPx * legacyIdleScale;
  const scale = targetBodyDisplayH / Math.max(1, idle.bodyHeightPx);
  const displayW = idle.canvasW * scale;
  // Keep the idle body's prior centered placement: canvas centered in the box.
  // Pin PNG bottom to the actor-box floor (same as other weapons' bottom: 0).
  const left = (box.width - displayW) / 2;
  const footX = left + idle.plantedFoot.x * displayW;
  const feetFromBottomPx = (1 - idle.plantedFoot.y) * idle.canvasH * scale;
  const footY = box.height - feetFromBottomPx + 120;
  return {
    x: footX,
    y: footY,
    targetBodyDisplayH,
  };
}

/**
 * Pure transform: scale by body height, pin planted foot to the shared ground anchor.
 * Sword overflow may extend outside the box — the box itself does not resize.
 */
export function computeRegisteredPoseLayout(
  registration: CombatPoseRegistration,
  anchor: ActorGroundAnchor,
): RegisteredPoseLayout {
  const scale = anchor.targetBodyDisplayH / Math.max(1, registration.bodyHeightPx);
  const width = registration.canvasW * scale;
  const height = registration.canvasH * scale;
  const left = anchor.x - registration.plantedFoot.x * width;
  const top = anchor.y - registration.plantedFoot.y * height;
  const footX = left + registration.plantedFoot.x * width;
  const footY = top + registration.plantedFoot.y * height;
  const bodyTopY = top + registration.bodyTop * height;
  const bodyBottomY = top + registration.bodyBottom * height;
  return {
    poseId: registration.poseId,
    scale,
    left,
    top,
    width,
    height,
    footX,
    footY,
    bodyTopY,
    bodyBottomY,
    renderedBodyHeight: bodyBottomY - bodyTopY,
  };
}

/** Layout helpers for Longsword idle/attack inside a fixed footprint box. */
export function computeAnatomyRegisteredLayouts(box: PoseFootprintBox): {
  idle: RegisteredPoseLayout;
  attack: RegisteredPoseLayout;
  anchor: ActorGroundAnchor;
} | null {
  if (box.width <= 0 || box.height <= 0) return null;
  const idleReg = AEGIS_LONGSWORD_POSE_REGISTRATION.idle;
  const attackReg = AEGIS_LONGSWORD_POSE_REGISTRATION.attack;
  const anchor = resolveActorGroundAnchor(box, idleReg);
  const attackAnchor: ActorGroundAnchor = {
    ...anchor,
    targetBodyDisplayH: anchor.targetBodyDisplayH * LONGSWORD_ATTACK_VISUAL_SCALE,
  };
  return {
    idle: computeRegisteredPoseLayout(idleReg, anchor),
    attack: computeRegisteredPoseLayout(attackReg, attackAnchor),
    anchor,
  };
}
