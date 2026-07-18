import type { ResourceCategory, ResourceItemId } from '../types/resourceItem';
import { RESOURCE_REGISTRY } from './resourceRegistry';
import {
  ECONOMY_BLACK_MARKET_SELL_MULTIPLIER,
} from './balance/economyBalanceConfig';

/**
 * Phase 2J — value lanes.
 * Prevents “always sell everything” / “never sell anything” by category.
 *
 * Stable: low fence (crafting preferred)
 * Intel: medium/high fence + contract
 * Unstable: moderate fence (risky to carry; craft/contract preferred)
 * Contraband: high fence / appraisal / delivery
 */

export const ECONOMY_VALUE_LANE_FENCE_MULT: Record<ResourceCategory, number> = {
  STABLE: 0.85,
  INTEL: 1.15,
  UNSTABLE: 1.0,
  CONTRABAND: 1.3,
};

/** Soft bands for base sellValue sanity (before lane mult). */
export const ECONOMY_VALUE_LANE_BASE_SELL_BANDS: Record<ResourceCategory, { min: number; max: number }> = {
  STABLE: { min: 2, max: 45 },
  INTEL: { min: 0, max: 250 },
  UNSTABLE: { min: 20, max: 120 },
  CONTRABAND: { min: 60, max: 550 },
};

export function getValueLaneFenceMultiplier(category: ResourceCategory): number {
  return ECONOMY_VALUE_LANE_FENCE_MULT[category];
}

/** Hub / debrief fence unit payout after lane + global black-market mult. */
export function resolveFenceUnitValue(resourceId: ResourceItemId): number {
  const def = RESOURCE_REGISTRY[resourceId];
  if (!def.canBeSoldToFence) return 0;
  const lane = getValueLaneFenceMultiplier(def.category);
  const raw = def.sellValue * lane * ECONOMY_BLACK_MARKET_SELL_MULTIPLIER;
  return Math.max(1, Math.round(raw));
}

export function formatValueLanePolicyBrief(): string {
  return [
    'VALUE LANES',
    '  STABLE: low fence (craft sink) ×0.85',
    '  INTEL: medium/high fence + contract ×1.15',
    '  UNSTABLE: moderate fence ×1.0 (carry risk)',
    '  CONTRABAND: high fence / appraisal / deliver ×1.30',
  ].join('\n');
}

/** Short player-facing lane intent for Black Market fence rows. */
export function formatFenceLaneLabel(resourceId: ResourceItemId): string {
  const category = RESOURCE_REGISTRY[resourceId].category;
  const mult = getValueLaneFenceMultiplier(category);
  const intent =
    category === 'STABLE' ? 'CRAFT SINK'
      : category === 'INTEL' ? 'FENCE + CONTRACT'
        : category === 'UNSTABLE' ? 'RISK CARRY'
          : 'APPRAISE / DELIVER';
  return `${category} ×${mult.toFixed(2)} · ${intent}`;
}
