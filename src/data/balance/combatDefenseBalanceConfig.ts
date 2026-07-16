/**
 * Combat Refactor Phase 1 — defense-layer balance constants.
 * Kinetic Armor / Occult Wards use low stacks + % mitigation (not flat absorb).
 */

export const COMBAT_DEFENSE_BALANCE = {
  depth1EarlyMaxLayeredEnemies: 1,
  depth1EarlyMaxArmorStacks: 1,
  depth1EarlyMaxWardStacks: 1,
  depth1EarlyNodeIndexCap: 3,

  depth1LateMaxLayeredEnemies: 2,
  depth1LateMaxArmorStacks: 2,
  depth1LateMaxWardStacks: 2,

  depth2MaxArmorStacks: 2,
  depth2MaxWardStacks: 2,

  depth3MaxArmorStacks: 3,
  depth3MaxWardStacks: 3,

  /** Global stack hard cap after legacy value normalization. */
  absoluteMaxDefenseStacks: 3,

  defaultKineticArmorReductionPercent: 0.22,
  defaultOccultWardReductionPercent: 0.22,
  toughKineticArmorReductionPercent: 0.28,
  toughOccultWardReductionPercent: 0.28,

  armorBreakFractureStacks: 1,
  wardBreakFractureStacks: 1,

  /** Soften Fracture vulnerability vs legacy +50% — break→Fracture is now more common. */
  fracturedDamageBonusPercent: 0.2,
  /** Immediate HP chip on Fracture from gauge fill (not from armor/ward break). */
  fracturedMaxHpPenaltyPercent: 0.1,

  earlyEncounterTargetHpLossMinPercent: 5,
  earlyEncounterTargetHpLossMaxPercent: 20,
  criticalEarlyEncounterHpLossWarningPercent: 30,

  /** Depth 1 damage softener applied on top of COMBAT_DEPTH_SCALING. */
  depth1DamageSoftMult: 0.85,
  depth1HpSoftMult: 0.92,
} as const;

/**
 * Convert legacy flat-absorb "layer" counts (often 5–25) into Phase 1 stack counts (0–3).
 */
export function normalizeLegacyDefenseLayers(raw: number | undefined | null): number {
  const n = Math.max(0, Math.floor(raw ?? 0));
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 6) return 2;
  return COMBAT_DEFENSE_BALANCE.absoluteMaxDefenseStacks;
}

export function maxDefenseStacksForDepth(
  depth: 1 | 2 | 3,
  kind: 'armor' | 'ward',
  earlyNode: boolean,
): number {
  if (depth === 1 && earlyNode) {
    return kind === 'armor'
      ? COMBAT_DEFENSE_BALANCE.depth1EarlyMaxArmorStacks
      : COMBAT_DEFENSE_BALANCE.depth1EarlyMaxWardStacks;
  }
  if (depth === 1) {
    return kind === 'armor'
      ? COMBAT_DEFENSE_BALANCE.depth1LateMaxArmorStacks
      : COMBAT_DEFENSE_BALANCE.depth1LateMaxWardStacks;
  }
  if (depth === 2) {
    return kind === 'armor'
      ? COMBAT_DEFENSE_BALANCE.depth2MaxArmorStacks
      : COMBAT_DEFENSE_BALANCE.depth2MaxWardStacks;
  }
  return kind === 'armor'
    ? COMBAT_DEFENSE_BALANCE.depth3MaxArmorStacks
    : COMBAT_DEFENSE_BALANCE.depth3MaxWardStacks;
}

export function formatCombatDefenseBalanceSummary(): string {
  const c = COMBAT_DEFENSE_BALANCE;
  return [
    'COMBAT DEFENSE BALANCE (Phase 1)',
    `  KA reduction: ${Math.round(c.defaultKineticArmorReductionPercent * 100)}% (tough ${Math.round(c.toughKineticArmorReductionPercent * 100)}%)`,
    `  OW reduction: ${Math.round(c.defaultOccultWardReductionPercent * 100)}% (tough ${Math.round(c.toughOccultWardReductionPercent * 100)}%)`,
    `  Fracture dmg bonus: +${Math.round(c.fracturedDamageBonusPercent * 100)}%`,
    `  D1 soft: hp×${c.depth1HpSoftMult} dmg×${c.depth1DamageSoftMult}`,
    `  D1 early caps: layered≤${c.depth1EarlyMaxLayeredEnemies}, stacks≤${c.depth1EarlyMaxArmorStacks}`,
  ].join('\n');
}
