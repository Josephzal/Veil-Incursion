import type { CombatUnitTag } from '../types/aegisCombat';
import type { EnemyCombatProfile } from '../types/run';

export const FRACTURE_MAX_DEFAULT = 100;
export const FRACTURED_DAMAGE_BONUS_PCT = 50;

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
): EnemyCombatProfile {
  if (isEnemyFractured(enemy)) return enemy;
  const max = enemy.fractureMax ?? FRACTURE_MAX_DEFAULT;
  const nextGauge = Math.min(max, (enemy.fractureGauge ?? 0) + amount);
  if (nextGauge >= max) {
    return applyFracturedState(enemy);
  }
  return { ...enemy, fractureGauge: nextGauge };
}

/** Break state — stunned, armor stripped, +50% damage taken this round. */
export function applyFracturedState(enemy: EnemyCombatProfile): EnemyCombatProfile {
  return {
    ...enemy,
    fractureGauge: 0,
    combatTags: [...new Set([...(enemy.combatTags ?? []), 'FRACTURED' as CombatUnitTag])],
    kineticArmor: 0,
    occultWards: 0,
    enemyActionPoints: 0,
    fracturedThisRound: true,
    evadeActive: false,
  };
}

/** Start of enemy active turn — recover from fracture break. */
export function recoverFromFracture(enemy: EnemyCombatProfile): EnemyCombatProfile {
  if (!enemy.fracturedThisRound && !hasCombatTag(enemy, 'FRACTURED')) {
    return enemy;
  }
  const restoredKinetic = enemy.baseKineticArmor ?? enemy.kineticArmor ?? 0;
  const restoredOccult = enemy.baseOccultWards ?? enemy.occultWards ?? 0;
  return {
    ...enemy,
    fractureGauge: 0,
    fracturedThisRound: false,
    kineticArmor: restoredKinetic,
    occultWards: restoredOccult,
    enemyActionPoints: enemy.enemyMaxActionPoints ?? 1,
    combatTags: (enemy.combatTags ?? []).filter((t) => t !== 'FRACTURED'),
  };
}

export function isEnemyFractured(enemy: EnemyCombatProfile): boolean {
  return enemy.fracturedThisRound === true || hasCombatTag(enemy, 'FRACTURED');
}

export function applyDamageWithFractureBonus(raw: number, enemy: EnemyCombatProfile): number {
  if (!isEnemyFractured(enemy)) return raw;
  return Math.floor(raw * (1 + FRACTURED_DAMAGE_BONUS_PCT / 100));
}

export function initEnemyCombatLayers(
  enemy: EnemyCombatProfile,
  options?: { kineticArmor?: number; occultWards?: number; fractureMax?: number },
): EnemyCombatProfile {
  const kinetic = options?.kineticArmor ?? defaultKineticArmor(enemy);
  const occult = options?.occultWards ?? defaultOccultWards(enemy);
  return {
    ...enemy,
    kineticArmor: kinetic,
    occultWards: occult,
    baseKineticArmor: kinetic,
    baseOccultWards: occult,
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
