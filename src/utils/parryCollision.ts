/** Outer (dashed) ring scale at parry start. */
export const PARRY_RING_SCALE_START = 2.5;
/** Outer ring scale when it meets the static ring. */
export const PARRY_RING_SCALE_END = 1.0;
/** Timing band when outer ring meets static (~±12% scale — forgiving detonation window). */
export const PARRY_TIMING_TOLERANCE = 0.12;
/** Center tap radius as fraction of static ring radius. */
export const PARRY_CENTER_HIT_RATIO = 0.42;
/** Minimum center hit radius in px (small screens). */
export const PARRY_CENTER_HIT_MIN_PX = 40;
export const PARRY_RING_SIZE_RATIO = 0.38;
/** Visual / hit-band stroke width for the static sweet-spot ring. */
export const PARRY_STATIC_RING_STROKE = 7;
/** Outer dashed ring stroke — slightly thicker for readability. */
export const PARRY_OUTER_RING_STROKE = 2.5;
/** Soft glow stroke behind the static ring. */
export const PARRY_SWEET_RING_STROKE = 5;
/** Success halo burst — keep parry overlay up this long before kill resolution. */
export const PARRY_HALO_DURATION_MS = 580;

export interface ParryArenaLayout {
  width: number;
  height: number;
  cx: number;
  cy: number;
  baseR: number;
}

export function computeParryArenaLayout(width: number, height: number): ParryArenaLayout {
  const baseR = (Math.min(width, height) * PARRY_RING_SIZE_RATIO) / 2;
  return {
    width,
    height,
    cx: width / 2,
    cy: height / 2,
    baseR,
  };
}

export function getParryCenterHitRadius(layout: ParryArenaLayout): number {
  return Math.max(layout.baseR * PARRY_CENTER_HIT_RATIO, PARRY_CENTER_HIT_MIN_PX);
}

/** Moving ring aligned with static ring (collision moment). */
export function isParryRingsMeet(
  scale: number,
  windowBonus = 0,
  blindPenalty = 0,
): boolean {
  const tol = PARRY_TIMING_TOLERANCE + windowBonus * 0.02 - blindPenalty;
  return Math.abs(scale - PARRY_RING_SCALE_END) <= tol;
}

/** Tap landed on the center of the static parry circle. */
export function isTapOnParryCenter(
  tapX: number,
  tapY: number,
  layout: ParryArenaLayout,
): boolean {
  const dist = Math.hypot(tapX - layout.cx, tapY - layout.cy);
  return dist <= getParryCenterHitRadius(layout);
}

/** Tap inside the static ring (collision zone — slightly wider than center dot). */
export function isTapInsideStaticRing(
  tapX: number,
  tapY: number,
  layout: ParryArenaLayout,
): boolean {
  const dist = Math.hypot(tapX - layout.cx, tapY - layout.cy);
  return dist <= layout.baseR * 1.15;
}

/**
 * Single pass/fail for counter stance — ring timing and tap zone must agree so
 * counter damage and parry success cannot diverge.
 * Tap zone is the area inside the static ring (forgiving detonation window).
 */
export function isParryAttemptSuccessful(
  scale: number,
  tapX: number,
  tapY: number,
  layout: ParryArenaLayout | null,
  windowBonus = 0,
  blindPenalty = 0,
): boolean {
  if (!layout) return false;
  const timingHit = isParryRingsMeet(scale, windowBonus, blindPenalty);
  const zoneHit = isTapInsideStaticRing(tapX, tapY, layout);
  return timingHit && zoneHit;
}
