/**
 * Combat depth / elite multipliers — single source for enemy HP & damage scaling.
 *
 * Intent:
 * - Depth 1 = approachable baseline
 * - Depth 2 = real pressure (Breach mechanical + ~1.6–1.8× raw stats)
 * - Depth 3 = commitment (Deep Veil + ~2.4–2.6× raw stats)
 *
 * Combat turn targets: see COMBAT_PACING_TARGETS in balanceTargets.ts.
 */

import type { DistrictId } from '../districtPacing';

export const COMBAT_DEPTH_SCALING: Record<DistrictId, { hpMult: number; dmgMult: number }> = {
  /** Depth 1 — teach identity; reasonable play usually survives. */
  1: { hpMult: 1.0, dmgMult: 1.0 },
  /** Depth 2 — noticeable jump; banking/extract starts to matter. */
  2: { hpMult: 1.65, dmgMult: 1.8 },
  /** Depth 3 — dangerous; full clear should not be routine early. */
  3: { hpMult: 2.4, dmgMult: 2.6 },
};

/** Elite / Alpha overlay on top of depth scaling. */
export const COMBAT_ELITE_MODIFIER = {
  hpMult: 1.3,
  dmgMult: 1.25,
  /** Fracture threshold multiplier for alpha elites. */
  ftMult: 1.5,
} as const;

/**
 * Soft boss multipliers (composer / flavor may add more).
 * Raw district bosses largely use roster stats × depth scaling.
 */
export const COMBAT_BOSS_STAT_NOTES = {
  boss1: 'Threshold — tests basic competency',
  boss2: 'Breach — adaptation to Depth 2 rules',
  boss3: 'Deep Veil climax — reward must justify risk',
} as const;

export function getCombatDepthScaling(district: DistrictId): { hpMult: number; dmgMult: number } {
  return COMBAT_DEPTH_SCALING[district];
}

export function formatCombatBalanceConfigSummary(): string {
  return [
    'COMBAT BALANCE CONFIG',
    ...([1, 2, 3] as DistrictId[]).map((d) => {
      const s = COMBAT_DEPTH_SCALING[d];
      return `  Depth ${d}: hp×${s.hpMult} dmg×${s.dmgMult}`;
    }),
    `  Elite/Alpha: hp×${COMBAT_ELITE_MODIFIER.hpMult} dmg×${COMBAT_ELITE_MODIFIER.dmgMult} ft×${COMBAT_ELITE_MODIFIER.ftMult}`,
  ].join('\n');
}
