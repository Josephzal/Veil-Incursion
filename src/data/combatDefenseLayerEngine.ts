/**
 * Combat Refactor Phase 1 — Kinetic Armor / Occult Ward mitigation + break→Fracture.
 */

import type { DamageChannel } from '../types/aegisCombat';
import type { EnemyCombatProfile } from '../types/run';
import {
  COMBAT_DEFENSE_BALANCE,
  normalizeLegacyDefenseLayers,
} from './balance/combatDefenseBalanceConfig';
import {
  addCombatTag,
  applyFracturedState,
  hasCombatTag,
  isEnemyFractured,
} from './combatFractureEngine';

export type DefenseBreakKind = 'armor' | 'ward' | null;

export interface DefenseMitigationResult {
  damageAfter: number;
  damageReduced: number;
  enemy: EnemyCombatProfile;
  logLines: string[];
}

export interface DefenseStripResult {
  enemy: EnemyCombatProfile;
  stacksRemoved: number;
  broke: boolean;
  appliedFracture: boolean;
  logLines: string[];
}

export function kineticArmorReductionPercent(enemy: EnemyCombatProfile): number {
  if ((enemy.kineticArmor ?? 0) <= 0) return 0;
  if ((enemy.baseKineticArmor ?? 0) >= 2) {
    return COMBAT_DEFENSE_BALANCE.toughKineticArmorReductionPercent;
  }
  return COMBAT_DEFENSE_BALANCE.defaultKineticArmorReductionPercent;
}

export function occultWardReductionPercent(enemy: EnemyCombatProfile): number {
  if ((enemy.occultWards ?? 0) <= 0) return 0;
  if ((enemy.baseOccultWards ?? 0) >= 2) {
    return COMBAT_DEFENSE_BALANCE.toughOccultWardReductionPercent;
  }
  return COMBAT_DEFENSE_BALANCE.defaultOccultWardReductionPercent;
}

export function applyKineticArmorMitigation(
  enemy: EnemyCombatProfile,
  raw: number,
  options?: { pierce?: boolean; partialPierce?: boolean },
): DefenseMitigationResult {
  const stacks = enemy.kineticArmor ?? 0;
  if (stacks <= 0 || options?.pierce || raw <= 0) {
    return { damageAfter: raw, damageReduced: 0, enemy, logLines: [] };
  }
  let reduction = kineticArmorReductionPercent(enemy);
  if (options?.partialPierce) reduction *= 0.5;
  if (hasCombatTag(enemy, 'EXPOSED')) reduction *= 0.5;
  const damageAfter = Math.max(0, Math.floor(raw * (1 - reduction)));
  const damageReduced = Math.max(0, raw - damageAfter);
  return {
    damageAfter,
    damageReduced,
    enemy,
    logLines: damageReduced > 0
      ? [`>> Kinetic Armor reduced damage (−${damageReduced}).`]
      : [],
  };
}

export function applyOccultWardMitigation(
  enemy: EnemyCombatProfile,
  raw: number,
  options?: { pierce?: boolean; partialPierce?: boolean },
): DefenseMitigationResult {
  const stacks = enemy.occultWards ?? 0;
  if (stacks <= 0 || options?.pierce || raw <= 0) {
    return { damageAfter: raw, damageReduced: 0, enemy, logLines: [] };
  }
  let reduction = occultWardReductionPercent(enemy);
  if (options?.partialPierce) reduction *= 0.5;
  if (hasCombatTag(enemy, 'EXPOSED')) reduction *= 0.5;
  const damageAfter = Math.max(0, Math.floor(raw * (1 - reduction)));
  const damageReduced = Math.max(0, raw - damageAfter);
  return {
    damageAfter,
    damageReduced,
    enemy,
    logLines: damageReduced > 0
      ? [`>> Occult Wards reduced damage (−${damageReduced}).`]
      : [],
  };
}

export function mitigateByChannel(
  enemy: EnemyCombatProfile,
  raw: number,
  channel: DamageChannel,
  options?: { pierce?: boolean; partialPierce?: boolean; ignoreDefenses?: boolean },
): DefenseMitigationResult {
  if (options?.ignoreDefenses || channel === 'TRUE') {
    return { damageAfter: raw, damageReduced: 0, enemy, logLines: [] };
  }
  if (channel === 'KINETIC') {
    return applyKineticArmorMitigation(enemy, raw, options);
  }
  if (channel === 'OCCULT') {
    return applyOccultWardMitigation(enemy, raw, options);
  }
  return { damageAfter: raw, damageReduced: 0, enemy, logLines: [] };
}

function applyBreakFracture(
  enemy: EnemyCombatProfile,
  kind: 'armor' | 'ward',
): { enemy: EnemyCombatProfile; applied: boolean; logLines: string[] } {
  if (isEnemyFractured(enemy)) {
    return { enemy, applied: false, logLines: [] };
  }
  const fractured = applyFracturedState(enemy, { fromDefenseBreak: true });
  const message = kind === 'armor'
    ? '>> Kinetic Armor shattered — enemy Fractured.'
    : '>> Occult Wards collapsed — enemy Fractured.';
  return {
    enemy: kind === 'armor'
      ? { ...fractured, kineticArmorBrokenThisCombat: true }
      : { ...fractured, occultWardsBrokenThisCombat: true },
    applied: true,
    logLines: [message],
  };
}

export function stripKineticArmor(
  enemy: EnemyCombatProfile,
  stacks: number,
  options?: { applyExposed?: boolean },
): DefenseStripResult {
  const before = enemy.kineticArmor ?? 0;
  if (stacks <= 0 || before <= 0) {
    return { enemy, stacksRemoved: 0, broke: false, appliedFracture: false, logLines: [] };
  }
  const removed = Math.min(before, Math.floor(stacks));
  let next: EnemyCombatProfile = {
    ...enemy,
    kineticArmor: Math.max(0, before - removed),
  };
  const logLines = [`>> Removed ${removed} Kinetic Armor.`];
  if (options?.applyExposed && removed >= 1) {
    next = addCombatTag(next, 'EXPOSED');
  }
  let appliedFracture = false;
  let broke = false;
  if (before > 0 && (next.kineticArmor ?? 0) <= 0 && !enemy.kineticArmorBrokenThisCombat) {
    broke = true;
    const result = applyBreakFracture(next, 'armor');
    next = result.enemy;
    appliedFracture = result.applied;
    logLines.push(...result.logLines);
  }
  return { enemy: next, stacksRemoved: removed, broke, appliedFracture, logLines };
}

export function stripOccultWards(
  enemy: EnemyCombatProfile,
  stacks: number,
): DefenseStripResult {
  const before = enemy.occultWards ?? 0;
  if (stacks <= 0 || before <= 0) {
    return { enemy, stacksRemoved: 0, broke: false, appliedFracture: false, logLines: [] };
  }
  const removed = Math.min(before, Math.floor(stacks));
  let next: EnemyCombatProfile = {
    ...enemy,
    occultWards: Math.max(0, before - removed),
  };
  const logLines = [`>> Removed ${removed} Occult Ward${removed === 1 ? '' : 's'}.`];
  let appliedFracture = false;
  let broke = false;
  if (before > 0 && (next.occultWards ?? 0) <= 0 && !enemy.occultWardsBrokenThisCombat) {
    broke = true;
    const result = applyBreakFracture(next, 'ward');
    next = result.enemy;
    appliedFracture = result.applied;
    logLines.push(...result.logLines);
  }
  return { enemy: next, stacksRemoved: removed, broke, appliedFracture, logLines };
}

/** Normalize authored/legacy layer counts into Phase 1 stacks and init break flags. */
export function normalizeEnemyDefenseStacks(
  enemy: EnemyCombatProfile,
  options?: {
    kineticArmor?: number;
    occultWards?: number;
    depth?: 1 | 2 | 3;
    earlyNode?: boolean;
  },
): { kineticArmor: number; occultWards: number } {
  let kinetic = normalizeLegacyDefenseLayers(options?.kineticArmor ?? enemy.kineticArmor);
  let occult = normalizeLegacyDefenseLayers(options?.occultWards ?? enemy.occultWards);
  const depth = options?.depth ?? 1;
  const early = options?.earlyNode ?? false;
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
  // Early Depth 1: never both layers on one enemy.
  if (depth === 1 && early && kinetic > 0 && occult > 0) {
    occult = 0;
  }
  return { kineticArmor: kinetic, occultWards: occult };
}
