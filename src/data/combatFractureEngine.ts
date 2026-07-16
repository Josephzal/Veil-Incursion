import type { CombatUnitTag } from '../types/aegisCombat';
import type { EnemyCombatProfile } from '../types/run';
import {
  COMBAT_DEFENSE_BALANCE,
  normalizeLegacyDefenseLayers,
} from './balance/combatDefenseBalanceConfig';

export const FRACTURE_MAX_DEFAULT = 100;
/** @deprecated Prefer COMBAT_DEFENSE_BALANCE.fracturedDamageBonusPercent */
export const FRACTURED_DAMAGE_BONUS_PCT = Math.round(
  COMBAT_DEFENSE_BALANCE.fracturedDamageBonusPercent * 100,
);
/** @deprecated Prefer COMBAT_DEFENSE_BALANCE.fracturedMaxHpPenaltyPercent */
export const FRACTURED_MAX_HP_PENALTY_PCT = Math.round(
  COMBAT_DEFENSE_BALANCE.fracturedMaxHpPenaltyPercent * 100,
);

export function hasCombatTag(enemy: EnemyCombatProfile, tag: CombatUnitTag): boolean {
  return enemy.combatTags?.includes(tag) ?? false;
}

export function addCombatTag(enemy: EnemyCombatProfile, tag: CombatUnitTag): EnemyCombatProfile {
  const tags = enemy.combatTags ?? [];
  if (tags.includes(tag)) return enemy;
  return { ...enemy, combatTags: [...tags, tag] };
}

/** Stack Doomed up to 3 for Void Contagion pulse scaling. */
export function stackDoomedTag(enemy: EnemyCombatProfile): EnemyCombatProfile {
  const current = enemy.doomedStacks ?? (hasCombatTag(enemy, 'DOOMED') ? 1 : 0);
  const stacks = Math.min(3, current + 1);
  return addCombatTag({ ...enemy, doomedStacks: stacks }, 'DOOMED');
}

export function doomedPulseStacks(enemy: EnemyCombatProfile): number {
  if (!hasCombatTag(enemy, 'DOOMED')) return 0;
  return Math.min(3, enemy.doomedStacks ?? 1);
}

export function removeCombatTag(enemy: EnemyCombatProfile, tag: CombatUnitTag): EnemyCombatProfile {
  const tags = enemy.combatTags ?? [];
  if (!tags.includes(tag)) return enemy;
  return { ...enemy, combatTags: tags.filter((t) => t !== tag) };
}

export function fractureRatio(enemy: EnemyCombatProfile): number {
  const max = enemy.fractureMax ?? FRACTURE_MAX_DEFAULT;
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, (enemy.fractureGauge ?? 0) / max));
}

export function applyFractureDamage(
  enemy: EnemyCombatProfile,
  amount: number,
  options?: { deferBreak?: boolean },
): EnemyCombatProfile {
  if (isEnemyFractured(enemy) || enemy.fractureImmune === true) return enemy;
  const max = enemy.fractureMax ?? FRACTURE_MAX_DEFAULT;
  const nextGauge = Math.min(max, (enemy.fractureGauge ?? 0) + amount);
  if (nextGauge >= max) {
    if (options?.deferBreak) {
      return { ...enemy, fractureGauge: max };
    }
    return applyFracturedState(enemy);
  }
  return { ...enemy, fractureGauge: nextGauge };
}

export function willFractureBreak(enemy: EnemyCombatProfile, amount: number): boolean {
  if (isEnemyFractured(enemy) || enemy.fractureImmune === true) return false;
  const max = enemy.fractureMax ?? FRACTURE_MAX_DEFAULT;
  return (enemy.fractureGauge ?? 0) + amount >= max;
}

/**
 * Fracture exploit state — vulnerability payoff.
 * Phase 1: armor/ward break applies Fracture; gauge fill still Fractures without stripping defenses
 * (defenses are the puzzle; Fracture is the payoff).
 */
export function applyFracturedState(
  enemy: EnemyCombatProfile,
  options?: { fromDefenseBreak?: boolean },
): EnemyCombatProfile {
  const penaltyPct = COMBAT_DEFENSE_BALANCE.fracturedMaxHpPenaltyPercent;
  const hpLoss = options?.fromDefenseBreak
    ? 0
    : Math.max(1, Math.floor(enemy.maxHp * penaltyPct));
  const currentHp = options?.fromDefenseBreak
    ? enemy.currentHp
    : Math.max(1, enemy.currentHp - hpLoss);
  return {
    ...enemy,
    currentHp,
    fractureGauge: 0,
    combatTags: [...new Set([...(enemy.combatTags ?? []), 'FRACTURED' as CombatUnitTag])],
    enemyActionPoints: 0,
    fracturedThisRound: true,
    evadeActive: false,
    fortifyTurnsRemaining: 0,
  };
}

/** Start of enemy active turn — recover from fracture break. Defenses stay as-stripped. */
export function recoverFromFracture(enemy: EnemyCombatProfile): EnemyCombatProfile {
  if (!enemy.fracturedThisRound && !hasCombatTag(enemy, 'FRACTURED')) {
    return enemy;
  }
  return {
    ...enemy,
    fractureGauge: 0,
    fracturedThisRound: false,
    enemyActionPoints: enemy.enemyMaxActionPoints ?? 1,
    combatTags: (enemy.combatTags ?? []).filter((t) => t !== 'FRACTURED'),
  };
}

export function isEnemyFractured(enemy: EnemyCombatProfile): boolean {
  return enemy.fracturedThisRound === true || hasCombatTag(enemy, 'FRACTURED');
}

export function applyDamageWithFractureBonus(raw: number, enemy: EnemyCombatProfile): number {
  if (!isEnemyFractured(enemy)) return raw;
  return Math.floor(raw * (1 + COMBAT_DEFENSE_BALANCE.fracturedDamageBonusPercent));
}

export function initEnemyCombatLayers(
  enemy: EnemyCombatProfile,
  options?: {
    kineticArmor?: number;
    occultWards?: number;
    fractureMax?: number;
    depth?: 1 | 2 | 3;
    earlyNode?: boolean;
  },
): EnemyCombatProfile {
  const depth = options?.depth ?? 1;
  const early = options?.earlyNode ?? false;
  let kinetic = normalizeLegacyDefenseLayers(options?.kineticArmor ?? defaultKineticArmor(enemy));
  let occult = normalizeLegacyDefenseLayers(options?.occultWards ?? defaultOccultWards(enemy));
  const maxKa = depth === 1 && early
    ? COMBAT_DEFENSE_BALANCE.depth1EarlyMaxArmorStacks
    : depth === 1
      ? COMBAT_DEFENSE_BALANCE.depth1LateMaxArmorStacks
      : depth === 2
        ? COMBAT_DEFENSE_BALANCE.depth2MaxArmorStacks
        : COMBAT_DEFENSE_BALANCE.depth3MaxArmorStacks;
  const maxOw = depth === 1 && early
    ? COMBAT_DEFENSE_BALANCE.depth1EarlyMaxWardStacks
    : depth === 1
      ? COMBAT_DEFENSE_BALANCE.depth1LateMaxWardStacks
      : depth === 2
        ? COMBAT_DEFENSE_BALANCE.depth2MaxWardStacks
        : COMBAT_DEFENSE_BALANCE.depth3MaxWardStacks;
  kinetic = Math.min(kinetic, maxKa);
  occult = Math.min(occult, maxOw);
  if (depth === 1 && early && kinetic > 0 && occult > 0) {
    occult = 0;
  }
  return {
    ...enemy,
    kineticArmor: kinetic,
    occultWards: occult,
    baseKineticArmor: kinetic,
    baseOccultWards: occult,
    kineticArmorBrokenThisCombat: false,
    occultWardsBrokenThisCombat: false,
    fractureGauge: 0,
    fractureMax: options?.fractureMax ?? FRACTURE_MAX_DEFAULT,
    combatTags: enemy.combatTags ?? [],
    enemyActionPoints: enemy.enemyMaxActionPoints ?? 1,
    enemyMaxActionPoints: enemy.enemyMaxActionPoints ?? 1,
    fracturedThisRound: false,
  };
}

function defaultKineticArmor(enemy: EnemyCombatProfile): number {
  if (enemy.isBoss) return 2;
  if (enemy.class === 'ABOMINATION') return 2;
  if (enemy.class === 'APPARITION') return 0;
  return 1;
}

function defaultOccultWards(enemy: EnemyCombatProfile): number {
  if (enemy.class === 'APPARITION') return 2;
  if (enemy.class === 'ABOMINATION') return 1;
  return 0;
}
