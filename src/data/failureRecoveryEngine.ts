/**
 * Progression Spine Phase 1I — Failure recovery / anti-frustration rules.
 *
 * Route intel is lost on death and the access mandate stays active.
 * Failures escalate spawn odds so sector unlocks stay tense, not annoying:
 *   failCount >= 2 → BOOSTED spawn chance on elite/boss
 *   failCount >= 3 → GUARANTEED on next eligible elite/boss (and any eligible-depth node)
 *
 * Discard/fence soft-locks are handled at cargo UI + routing layers; this engine
 * owns pity tier math and spawn chance resolution.
 */
export type RouteIntelPityTier = 'NONE' | 'BOOSTED' | 'GUARANTEED';

export const FAILURE_RECOVERY_TUNING = {
  /** After this many lost-with-intel deaths, increase elite/boss spawn chance. */
  boostFailCount: 2,
  /** After this many, guarantee spawn on next combat at eligible depth. */
  guaranteeFailCount: 3,
  /** Multiplier applied to elite/boss base chance while BOOSTED. */
  boostChanceMultiplier: 1.75,
  /** Flat bonus added after multiplier while BOOSTED (still capped at 1). */
  boostChanceFlatBonus: 0.12,
  /**
   * When GUARANTEED, also allow non-elite / non-boss nodes at eligible depth
   * so players cannot soft-lock by never rolling elites.
   */
  guaranteeAllowsAnyEligibleNode: true,
} as const;

export interface RouteIntelSpawnChanceInput {
  failCount: number;
  isElite: boolean;
  isBoss: boolean;
  eliteChance: number;
  bossChance: number;
  boostFailCount?: number;
  guaranteeFailCount?: number;
}

export interface RouteIntelSpawnChanceResult {
  tier: RouteIntelPityTier;
  eligible: boolean;
  chance: number;
  guaranteed: boolean;
}

export function resolveRouteIntelPityTier(
  failCount: number,
  boostFailCount: number = FAILURE_RECOVERY_TUNING.boostFailCount,
  guaranteeFailCount: number = FAILURE_RECOVERY_TUNING.guaranteeFailCount,
): RouteIntelPityTier {
  const fails = Math.max(0, Math.floor(failCount));
  if (fails >= guaranteeFailCount) return 'GUARANTEED';
  if (fails >= boostFailCount) return 'BOOSTED';
  return 'NONE';
}

/** Resolve spawn eligibility + chance for one mandate at a combat node. */
export function resolveRouteIntelSpawnChance(
  input: RouteIntelSpawnChanceInput,
): RouteIntelSpawnChanceResult {
  const boostAt = input.boostFailCount ?? FAILURE_RECOVERY_TUNING.boostFailCount;
  const guaranteeAt = input.guaranteeFailCount ?? FAILURE_RECOVERY_TUNING.guaranteeFailCount;
  const tier = resolveRouteIntelPityTier(input.failCount, boostAt, guaranteeAt);
  const isThreatNode = input.isBoss || input.isElite;

  if (tier === 'GUARANTEED') {
    if (isThreatNode || FAILURE_RECOVERY_TUNING.guaranteeAllowsAnyEligibleNode) {
      return { tier, eligible: true, chance: 1, guaranteed: true };
    }
    return { tier, eligible: false, chance: 0, guaranteed: true };
  }

  if (!isThreatNode) {
    return { tier, eligible: false, chance: 0, guaranteed: false };
  }

  let chance = input.isBoss ? input.bossChance : input.eliteChance;

  if (tier === 'BOOSTED') {
    chance = Math.min(
      1,
      chance * FAILURE_RECOVERY_TUNING.boostChanceMultiplier
        + FAILURE_RECOVERY_TUNING.boostChanceFlatBonus,
    );
  }

  return {
    tier,
    eligible: chance > 0,
    chance,
    guaranteed: false,
  };
}

export function formatPityTierLabel(tier: RouteIntelPityTier): string {
  switch (tier) {
    case 'GUARANTEED':
      return 'GUARANTEED';
    case 'BOOSTED':
      return 'BOOSTED';
    default:
      return 'NONE';
  }
}
