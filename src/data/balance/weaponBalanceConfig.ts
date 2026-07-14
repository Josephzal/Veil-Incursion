/**
 * Weapon balance knobs — costs/stats remain authored in weaponRegistry.
 * This file documents upgrade intent and soft ceilings for validation (Phase D).
 */

/** Soft ceiling for a single tier's strikeDamagePct (warn if exceeded). */
export const WEAPON_BALANCE_TIER_STRIKE_DAMAGE_PCT_SOFT_CAP = 25;

/** Soft ceiling for cumulative strikeDamagePct across tiers I–III. */
export const WEAPON_BALANCE_CUMULATIVE_STRIKE_DAMAGE_PCT_SOFT_CAP = 40;

/**
 * Unlock / upgrade cost intent:
 * - Starters free
 * - Second family: STANDARD TOOL (~1–2 decent extractions runs)
 * - Third family / deep upgrades: RARE TOOL (focused farming)
 * - Masterwork / Anomalous Core: APEX (long-term)
 */
export const WEAPON_BALANCE_COST_INTENT = {
  starterUnlocked: true,
  secondFamily: 'STANDARD TOOL',
  thirdFamilyOrDeepUpgrade: 'RARE TOOL',
  masterwork: 'APEX / FUTURE',
} as const;

export function formatWeaponBalanceConfigSummary(): string {
  return [
    'WEAPON BALANCE CONFIG',
    `  tier strikeDamagePct soft cap: ${WEAPON_BALANCE_TIER_STRIKE_DAMAGE_PCT_SOFT_CAP}%`,
    `  cumulative strikeDamagePct soft cap: ${WEAPON_BALANCE_CUMULATIVE_STRIKE_DAMAGE_PCT_SOFT_CAP}%`,
    '  costs/stats: weaponRegistry.ts (single source of truth)',
    `  cost intent: ${WEAPON_BALANCE_COST_INTENT.secondFamily} / ${WEAPON_BALANCE_COST_INTENT.thirdFamilyOrDeepUpgrade} / ${WEAPON_BALANCE_COST_INTENT.masterwork}`,
  ].join('\n');
}
