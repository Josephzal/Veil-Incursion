/**
 * Phase 3I soft-weighting constants — structural only; Phase 3P owns final certification.
 */
export const BOON_SYNERGY_DIRECT_INTERACTION = 0.5;
export const BOON_SYNERGY_ENGINE_FAMILY = 0.35;
export const BOON_SYNERGY_WEAPON_AFFINITY = 0.2;
export const BOON_SYNERGY_EXPLICIT_CONFLICT = -0.35;

export const BOON_SYNERGY_MULTIPLIER_MIN = 0.65;
export const BOON_SYNERGY_MULTIPLIER_MAX = 2.0;

/** Existing base rarity / depth / category weights preserved as tier multipliers. */
export const BOON_TIER_CATEGORY_WEIGHT: Record<string, number> = {
  TIER_1: 1.0,
  TIER_2: 0.95,
  TIER_3: 0.9,
  TIER_4: 0.85,
  COMMON: 1.0,
  RARE: 0.95,
  OCCULT: 0.9,
  SYNAPTIC: 0.85,
};

export const BOON_BASE_OFFER_WEIGHT = 1.0;

export function clampSynergyMultiplier(raw: number): number {
  return Math.min(BOON_SYNERGY_MULTIPLIER_MAX, Math.max(BOON_SYNERGY_MULTIPLIER_MIN, raw));
}
