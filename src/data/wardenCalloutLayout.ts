/**
 * Assigns non-overlapping screen-space lanes for Warden damage + defense callouts.
 * Pure layout math — no React Native imports.
 */

export type CalloutLaneRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type WardenCalloutStackPlan = {
  damage: CalloutLaneRect | null;
  defense: CalloutLaneRect | null;
  critical: CalloutLaneRect | null;
  /** Edge-to-edge gap between damage and defense when both present. */
  damageDefenseGapPx: number;
};

const DEFAULT_DAMAGE = { width: 36, height: 18 };
const DEFAULT_DEFENSE = { width: 110, height: 14 };
const DEFAULT_CRITICAL = { width: 72, height: 14 };
export const WARDEN_CALLOUT_MIN_GAP_PX = 20;

/**
 * Shared origin is the target-local float anchor (0,0).
 * Damage sits above the normal click hotspot; defense above damage;
 * critical above defense. Lanes never share one animated peakY.
 */
export function resolveWardenCalloutLanes(input: {
  hasDamage: boolean;
  hasDefense: boolean;
  hasCritical?: boolean;
  damageSize?: { width: number; height: number };
  defenseSize?: { width: number; height: number };
  criticalSize?: { width: number; height: number };
  minGapPx?: number;
  originX?: number;
  originY?: number;
  /**
   * Lift the whole stack above the enemy click hotspot so a resting cursor
   * does not obscure the damage number. Negative = upward in y-down space.
   */
  hotspotAvoidOffsetY?: number;
  /** Slight horizontal nudge away from the pointer resting point. */
  hotspotAvoidOffsetX?: number;
}): WardenCalloutStackPlan {
  const minGap = input.minGapPx ?? WARDEN_CALLOUT_MIN_GAP_PX;
  const dmg = input.damageSize ?? DEFAULT_DAMAGE;
  const def = input.defenseSize ?? DEFAULT_DEFENSE;
  const crit = input.criticalSize ?? DEFAULT_CRITICAL;
  const ox = (input.originX ?? 0) + (input.hotspotAvoidOffsetX ?? -10);
  const oy = (input.originY ?? 0) + (input.hotspotAvoidOffsetY ?? -34);

  const damage: CalloutLaneRect | null = input.hasDamage
    ? {
        left: ox - dmg.width / 2,
        top: oy - dmg.height / 2,
        width: dmg.width,
        height: dmg.height,
      }
    : null;

  let defense: CalloutLaneRect | null = null;
  if (input.hasDefense) {
    const aboveBottom = damage
      ? damage.top - minGap
      : oy - minGap;
    defense = {
      left: ox - def.width / 2,
      top: aboveBottom - def.height,
      width: def.width,
      height: def.height,
    };
  }

  let critical: CalloutLaneRect | null = null;
  if (input.hasCritical) {
    const stackTop = defense?.top ?? damage?.top ?? oy;
    critical = {
      left: ox - crit.width / 2,
      top: stackTop - minGap - crit.height,
      width: crit.width,
      height: crit.height,
    };
  }

  let gap = 0;
  if (damage && defense) {
    gap = damage.top - (defense.top + defense.height);
  }

  return {
    damage,
    defense,
    critical,
    damageDefenseGapPx: gap,
  };
}

/** Default lift so damage clears the enemy selection hotspot under a resting cursor. */
export const WARDEN_CALLOUT_HOTSPOT_AVOID_Y = -34;
export const WARDEN_CALLOUT_HOTSPOT_AVOID_X = -10;

export function calloutRectsIntersect(a: CalloutLaneRect, b: CalloutLaneRect): boolean {
  return !(
    a.left + a.width <= b.left
    || b.left + b.width <= a.left
    || a.top + a.height <= b.top
    || b.top + b.height <= a.top
  );
}
