import { laneForSlot } from '../types/combatGrid';
import type { CombatGridSlotId } from '../types/combatGrid';
import type { CombatSessionExtras } from '../types/combatHooks';
import { addStructuredDebuff, hasStructuredDebuff } from '../types/combatHooks';
import type { EnemyCombatProfile } from '../types/run';
import { aliveUnits, getUnitById } from './combatSquadEngine';
import { hasCombatTag, isEnemyFractured } from './combatFractureEngine';
import { swapUnitGridSlots } from './combatLifecycleEngine';

export const ASHEN_BREATH_DRAIN_PERCENT = 0.05;
export const ASHEN_BREATH_DEBT_CAP_PERCENT = 0.20;
export const GRAVE_ROBBER_MAX_STACKS = 3;
export const GRAVE_ROBBER_HP_BONUS_PERCENT = 0.20;
export const GRAVE_ROBBER_DMG_BONUS_PERCENT = 0.10;
export const RIVAL_HEXED_STAMINA_TAX = 10;
export const RIVAL_HEXED_OCCULT_DAMAGE_MULT = 0.8;
export const RIVAL_WARD_LIGHT_HIT_THRESHOLD = 22;
export const RIVAL_EMERGENCY_SWAP_HP_RATIO = 0.3;
export const RIVAL_BLOOD_RUSH_DAMAGE_MULT = 1.5;
export const RIVAL_GUARD_BREAK_STAMINA_DAMAGE = 15;

export function getPlayerTrueMaxHp(extras: CombatSessionExtras, fallbackMax: number): number {
  return extras.playerTrueMaxHp > 0 ? extras.playerTrueMaxHp : fallbackMax;
}

export function getEffectivePlayerMaxHp(extras: CombatSessionExtras, trueMax: number): number {
  const baseline = getPlayerTrueMaxHp(extras, trueMax);
  return Math.max(1, baseline - extras.playerMaxHpDebt);
}

export function initPlayerMaxHpDebtTracking(extras: CombatSessionExtras, trueMax: number): void {
  extras.playerTrueMaxHp = trueMax;
  extras.playerMaxHpDebt = 0;
  extras.consecutivePlayerDefends = 0;
  extras.reaverDamagedThisPlayerTurn = false;
}

export function clearPlayerMaxHpDebt(extras: CombatSessionExtras): void {
  extras.playerMaxHpDebt = 0;
  extras.playerTrueMaxHp = 0;
}

export function applyAshenBreathDebt(
  extras: CombatSessionExtras,
  trueMax: number,
): { debtAdded: number; cappedDebt: number; logLine: string } {
  const baseline = getPlayerTrueMaxHp(extras, trueMax);
  const debtCap = Math.floor(baseline * ASHEN_BREATH_DEBT_CAP_PERCENT);
  const increment = Math.max(1, Math.floor(baseline * ASHEN_BREATH_DRAIN_PERCENT));
  const nextDebt = Math.min(debtCap, extras.playerMaxHpDebt + increment);
  const debtAdded = nextDebt - extras.playerMaxHpDebt;
  extras.playerMaxHpDebt = nextDebt;
  addStructuredDebuff(extras, {
    type: 'MAX_ANCHOR_DEBT',
    amount: nextDebt,
    turnsRemaining: 99,
  });
  const debtPct = baseline > 0 ? Math.round((nextDebt / baseline) * 100) : 0;
  return {
    debtAdded,
    cappedDebt: nextDebt,
    logLine: `>> ASHEN BREATH — max anchor debt +${debtAdded} (${debtPct}% TEMP, cap ${Math.round(ASHEN_BREATH_DEBT_CAP_PERCENT * 100)}%).`,
  };
}

export function clampPlayerHpToEffectiveMax(currentHp: number, extras: CombatSessionExtras, trueMax: number): number {
  const effectiveMax = getEffectivePlayerMaxHp(extras, trueMax);
  return Math.min(currentHp, effectiveMax);
}

export function applyRivalHexMark(extras: CombatSessionExtras): string {
  addStructuredDebuff(extras, {
    type: 'HEXED',
    turnsRemaining: 1,
  });
  return '>> RIVAL HEXER — HEXED. Next ability +10 stamina; occult −20%.';
}

export function consumeRivalHexedDebuff(extras: CombatSessionExtras): void {
  extras.structuredDebuffs = extras.structuredDebuffs.filter((d) => d.type !== 'HEXED');
  extras.playerDebuffs = extras.structuredDebuffs.map((d) => d.type);
}

export function rivalHexedStaminaTax(extras: CombatSessionExtras): number {
  return hasStructuredDebuff(extras, 'HEXED') ? RIVAL_HEXED_STAMINA_TAX : 0;
}

export function applyRivalHexedOccultMultiplier(
  extras: CombatSessionExtras,
  channel: 'KINETIC' | 'OCCULT' | 'TRUE' | undefined,
  damage: number,
): number {
  if (!hasStructuredDebuff(extras, 'HEXED') || channel !== 'OCCULT' || damage <= 0) {
    return damage;
  }
  return Math.floor(damage * RIVAL_HEXED_OCCULT_DAMAGE_MULT);
}

export function applyBindingWardToAlly(
  squad: EnemyCombatProfile[],
  veilbinder: EnemyCombatProfile,
): { squad: EnemyCombatProfile[]; logLine: string | null } {
  if (!veilbinder.unitId) return { squad, logLine: null };
  const allies = aliveUnits(squad).filter(
    (u) => u.unitId !== veilbinder.unitId && u.isRivalMerc,
  );
  const target = allies.sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0];
  if (!target?.unitId) return { squad, logLine: null };
  const next = squad.map((unit) => {
    if (unit.unitId === target.unitId) {
      return { ...unit, rivalWardCharges: 1, bindingWardOwnerId: veilbinder.unitId };
    }
    return unit;
  });
  return {
    squad: next,
    logLine: `>> ${veilbinder.designation} BINDING WARD — ${target.designation} shielded.`,
  };
}

export function tryAbsorbRivalBindingWard(
  target: EnemyCombatProfile,
  rawDamage: number,
  source?: string,
): {
  absorbed: boolean;
  lightBreak: boolean;
  logLine: string | null;
} {
  if ((target.rivalWardCharges ?? 0) <= 0 || rawDamage <= 0) {
    return { absorbed: false, lightBreak: false, logLine: null };
  }
  const lightBreak = rawDamage <= RIVAL_WARD_LIGHT_HIT_THRESHOLD || source === 'STRIKE';
  return {
    absorbed: true,
    lightBreak,
    logLine: lightBreak
      ? `>> BINDING WARD SHATTERED — light hit; warded ally primed (+1 AP).`
      : `>> BINDING WARD SHATTERED — heavy hit.`,
  };
}

export function clearRivalWardOnUnit(unit: EnemyCombatProfile): Partial<EnemyCombatProfile> {
  return {
    rivalWardCharges: undefined,
    bindingWardOwnerId: undefined,
  };
}

export function rivalWardBreakPatch(
  target: EnemyCombatProfile,
  lightBreak: boolean,
): Partial<EnemyCombatProfile> {
  const patch: Partial<EnemyCombatProfile> = clearRivalWardOnUnit(target);
  if (lightBreak) {
    patch.enemyActionPoints = (target.enemyActionPoints ?? 1) + 1;
  }
  return patch;
}

export function rivalBinderCanEmergencySwap(binder: EnemyCombatProfile): boolean {
  if (binder.rosterId !== 'rival-veilbinder' || binder.emergencySwapUsed) return false;
  if (binder.currentHp <= 0) return false;
  if (isEnemyFractured(binder) || hasCombatTag(binder, 'ROOTED')) return false;
  return true;
}

export function tryRivalEmergencySwap(
  squad: EnemyCombatProfile[],
  damagedAllyId: string,
): { squad: EnemyCombatProfile[]; logLine: string | null } {
  const damaged = getUnitById(squad, damagedAllyId);
  if (!damaged?.unitId || damaged.currentHp <= 0) return { squad, logLine: null };
  if (!damaged.isRivalMerc) return { squad, logLine: null };
  if (damaged.maxHp <= 0 || damaged.currentHp / damaged.maxHp > RIVAL_EMERGENCY_SWAP_HP_RATIO) {
    return { squad, logLine: null };
  }
  const binder = aliveUnits(squad).find((u) => rivalBinderCanEmergencySwap(u));
  if (!binder?.unitId || !damaged.gridSlot || !binder.gridSlot) return { squad, logLine: null };
  let next = swapUnitGridSlots(squad, binder.unitId, damaged.unitId);
  next = next.map((unit) => {
    if (unit.unitId === binder.unitId) {
      return { ...unit, emergencySwapUsed: true };
    }
    return unit;
  });
  return {
    squad: next,
    logLine: `>> ${binder.designation} EMERGENCY SWAP — pulled ${damaged.designation} behind the line.`,
  };
}

export function reaverCanGainBloodRush(reaver: EnemyCombatProfile): boolean {
  if (reaver.rosterId !== 'rival-reaver' || reaver.currentHp <= 0) return false;
  if (isEnemyFractured(reaver) || hasCombatTag(reaver, 'ROOTED')) return false;
  return true;
}

export function applyBloodRushToReavers(
  squad: EnemyCombatProfile[],
  extras: CombatSessionExtras,
): { squad: EnemyCombatProfile[]; logLines: string[] } {
  if (extras.reaverDamagedThisPlayerTurn) {
    return { squad, logLines: [] };
  }
  const logLines: string[] = [];
  const next = squad.map((unit) => {
    if (!reaverCanGainBloodRush(unit)) return unit;
    logLines.push(`>> ${unit.designation} BLOOD RUSH — untouched; next strike +50%.`);
    return { ...unit, bloodRushActive: true };
  });
  return { squad: next, logLines };
}

export function resolveReaverAttackDamage(
  attacker: EnemyCombatProfile,
  baseDamage: number,
): { damage: number; guardBreakStamina: number; logLines: string[]; patch: Partial<EnemyCombatProfile> } {
  const logLines: string[] = [];
  let damage = baseDamage;
  const patch: Partial<EnemyCombatProfile> = {};
  let guardBreakStamina = 0;

  if (attacker.rosterId === 'rival-reaver' && attacker.bloodRushActive) {
    damage = Math.floor(damage * RIVAL_BLOOD_RUSH_DAMAGE_MULT);
    patch.bloodRushActive = false;
    logLines.push(`>> ${attacker.designation} BLOOD RUSH — strike amplified.`);
  }
  if (attacker.rosterId === 'rival-reaver' && attacker.guardBreakPrimed) {
    patch.guardBreakPrimed = false;
    guardBreakStamina = RIVAL_GUARD_BREAK_STAMINA_DAMAGE;
    logLines.push(`>> ${attacker.designation} GUARD BREAK — +${guardBreakStamina} stamina rupture.`);
  }
  return { damage, guardBreakStamina, logLines, patch };
}

export function recordPlayerDefendStreak(extras: CombatSessionExtras, defendedThisTurn: boolean): void {
  if (defendedThisTurn) {
    extras.consecutivePlayerDefends += 1;
  } else {
    extras.consecutivePlayerDefends = 0;
  }
}

export function primeReaverGuardBreak(squad: EnemyCombatProfile[], extras: CombatSessionExtras): {
  squad: EnemyCombatProfile[];
  logLines: string[];
} {
  if (extras.consecutivePlayerDefends < 2) {
    return { squad, logLines: [] };
  }
  const logLines: string[] = [];
  const next = squad.map((unit) => {
    if (unit.rosterId !== 'rival-reaver' || unit.currentHp <= 0) return unit;
    logLines.push(`>> ${unit.designation} GUARD BREAK primed — consecutive defends detected.`);
    return { ...unit, guardBreakPrimed: true };
  });
  return { squad: next, logLines };
}

export function hollowLungsActive(squad: EnemyCombatProfile[]): boolean {
  return aliveUnits(squad).some((u) => u.rosterId === 'hollow-lung');
}
