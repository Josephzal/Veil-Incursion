import { CombatStatusEffect, MAX_ABYSSAL_SIPHON_PER_ACTION } from '../types/run';

/** EXHAUSTED is present only while stamina is exactly zero. */
export function deriveCombatStatusEffects(stamina: number): CombatStatusEffect[] {
  return stamina === 0 ? ['EXHAUSTED'] : [];
}

export function isCombatExhausted(
  stamina: number,
  statusEffects: CombatStatusEffect[] = deriveCombatStatusEffects(stamina),
): boolean {
  return stamina === 0 && statusEffects.includes('EXHAUSTED');
}

export function clampAbyssalSiphonAmount(requested: number): number {
  if (requested <= 0) return 0;
  return Math.min(requested, MAX_ABYSSAL_SIPHON_PER_ACTION);
}

export function applyAbyssalSiphon(currentAbyssal: number, requestedSiphon: number): {
  nextAbyssal: number;
  siphoned: number;
} {
  const siphoned = clampAbyssalSiphonAmount(requestedSiphon);
  return {
    siphoned,
    nextAbyssal: Math.max(currentAbyssal - siphoned, 0),
  };
}

export function formatAbyssalSiphonLog(designation: string, requested: number, siphoned: number): string {
  if (siphoned <= 0) return `>> ${designation} SIPHON ABYSSAL — NO RESERVE TO DRAIN`;
  if (siphoned < requested) {
    return `>> ${designation} SIPHONS ABYSSAL RESERVE (-${siphoned}% // CLAMPED FROM ${requested}).`;
  }
  return `>> ${designation} SIPHONS ABYSSAL RESERVE (-${siphoned}%).`;
}
