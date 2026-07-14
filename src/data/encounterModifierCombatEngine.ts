import type { EncounterModifierId } from '../types/depthIdentity';
import {
  BLEEDING_OCCULT_DAMAGE,
  CORE_SICK_HP_BONUS_PCT,
  MIRRORED_REFLECT_DAMAGE,
  RESONANT_ENEMY_DAMAGE_BONUS_PCT,
  STARVED_HEAL_MULTIPLIER,
} from './encounterModifierCatalog';
import { formatEncounterModifierCombatIntro } from './encounterModifierEngine';

export interface EncounterModifierCombatRuntime {
  modifierId: EncounterModifierId;
  enemyCyclesCompleted: number;
  mirroredPulseUsed: boolean;
  foldedUnitId: string | null;
  coreSickUnitId: string | null;
  coreSickSurgeUsed: boolean;
  introLogged: boolean;
}

export function createEncounterModifierCombatRuntime(
  modifierId: EncounterModifierId | null | undefined,
): EncounterModifierCombatRuntime | null {
  if (!modifierId) return null;
  return {
    modifierId,
    enemyCyclesCompleted: 0,
    mirroredPulseUsed: false,
    foldedUnitId: null,
    coreSickUnitId: null,
    coreSickSurgeUsed: false,
    introLogged: false,
  };
}

export function resolveStarvedHealMultiplier(
  modifierId: EncounterModifierId | null | undefined,
): number {
  return modifierId === 'STARVED' ? STARVED_HEAL_MULTIPLIER : 1;
}

export function resolveResonantOutgoingDamageMultiplier(
  modifierId: EncounterModifierId | null | undefined,
): number {
  if (modifierId !== 'RESONANT') return 1;
  return 1 + RESONANT_ENEMY_DAMAGE_BONUS_PCT / 100;
}

export interface EncounterModifierUnitStub {
  unitId?: string;
  currentHp: number;
  maxHp: number;
  evadeActive?: boolean;
  isBoss?: boolean;
}

export function applyFoldedModifierToSquad<T extends EncounterModifierUnitStub>(
  squad: readonly T[],
  runtime: EncounterModifierCombatRuntime,
): { squad: T[]; runtime: EncounterModifierCombatRuntime; logLine: string | null } {
  if (runtime.modifierId !== 'FOLDED' || runtime.foldedUnitId) {
    return { squad: [...squad], runtime, logLine: null };
  }
  const candidates = squad.filter((unit) => (unit.currentHp > 0) && !unit.isBoss && unit.unitId);
  if (candidates.length === 0) {
    return { squad: [...squad], runtime, logLine: null };
  }
  const target = candidates[candidates.length - 1]!;
  const nextSquad = squad.map((unit) => (
    unit.unitId === target.unitId
      ? { ...unit, evadeActive: true, evadeTurnsRemaining: 2 }
      : unit
  ));
  return {
    squad: nextSquad,
    runtime: { ...runtime, foldedUnitId: target.unitId ?? null },
    logLine: '>> FOLDED — one hostile phases out of true position until struck.',
  };
}

export function applyCoreSickModifierToSquad<T extends EncounterModifierUnitStub>(
  squad: readonly T[],
  runtime: EncounterModifierCombatRuntime,
): { squad: T[]; runtime: EncounterModifierCombatRuntime; logLine: string | null } {
  if (runtime.modifierId !== 'CORE_SICK' || runtime.coreSickUnitId) {
    return { squad: [...squad], runtime, logLine: null };
  }
  const candidates = squad.filter((unit) => unit.currentHp > 0 && unit.unitId);
  if (candidates.length === 0) {
    return { squad: [...squad], runtime, logLine: null };
  }
  const target = candidates.reduce((best, unit) => (
    unit.maxHp > best.maxHp ? unit : best
  ), candidates[0]!);
  const bonus = Math.max(1, Math.floor(target.maxHp * (CORE_SICK_HP_BONUS_PCT / 100)));
  const nextSquad = squad.map((unit) => (
    unit.unitId === target.unitId
      ? {
        ...unit,
        maxHp: unit.maxHp + bonus,
        currentHp: unit.currentHp + bonus,
      }
      : unit
  ));
  return {
    squad: nextSquad,
    runtime: { ...runtime, coreSickUnitId: target.unitId ?? null },
    logLine: `>> CORE-SICK — ${bonus} Anchor-sick HP fused into a hostile.`,
  };
}

export function resolveMirroredKillPulse(
  runtime: EncounterModifierCombatRuntime,
): { runtime: EncounterModifierCombatRuntime; damage: number; logLine: string | null } {
  if (runtime.modifierId !== 'MIRRORED' || runtime.mirroredPulseUsed) {
    return { runtime, damage: 0, logLine: null };
  }
  return {
    runtime: { ...runtime, mirroredPulseUsed: true },
    damage: MIRRORED_REFLECT_DAMAGE,
    logLine: `>> MIRRORED — kill echo reflects ${MIRRORED_REFLECT_DAMAGE} occult pressure.`,
  };
}

export function resolveBleedingCyclePulse(
  runtime: EncounterModifierCombatRuntime,
): { runtime: EncounterModifierCombatRuntime; damage: number; logLine: string | null } {
  if (runtime.modifierId !== 'BLEEDING') {
    return { runtime, damage: 0, logLine: null };
  }
  const nextCycles = runtime.enemyCyclesCompleted + 1;
  const nextRuntime = { ...runtime, enemyCyclesCompleted: nextCycles };
  if (nextCycles % 3 !== 0) {
    return { runtime: nextRuntime, damage: 0, logLine: null };
  }
  return {
    runtime: nextRuntime,
    damage: BLEEDING_OCCULT_DAMAGE,
    logLine: `>> BLEEDING — three-count tax −${BLEEDING_OCCULT_DAMAGE} occult.`,
  };
}

export function resolveEncounterModifierIntroLog(
  runtime: EncounterModifierCombatRuntime | null,
): { runtime: EncounterModifierCombatRuntime | null; logLine: string | null } {
  if (!runtime || runtime.introLogged) {
    return { runtime, logLine: null };
  }
  return {
    runtime: { ...runtime, introLogged: true },
    logLine: formatEncounterModifierCombatIntro(runtime.modifierId),
  };
}
