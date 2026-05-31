import { CombatStatusEffect, MAX_KINETIC_SIPHON_PER_ACTION } from '../types/run';

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

export function clampKineticSiphonAmount(requested: number): number {
  if (requested <= 0) return 0;
  return Math.min(requested, MAX_KINETIC_SIPHON_PER_ACTION);
}

export function applyKineticSiphon(currentKinetic: number, requestedSiphon: number): {
  nextKinetic: number;
  siphoned: number;
} {
  const siphoned = clampKineticSiphonAmount(requestedSiphon);
  return {
    siphoned,
    nextKinetic: Math.max(currentKinetic - siphoned, 0),
  };
}

export function formatKineticSiphonLog(designation: string, requested: number, siphoned: number): string {
  if (siphoned <= 0) return `>> ${designation} SIPHON KINETIC — NO RESERVOIR TO DRAIN`;
  if (siphoned < requested) {
    return `>> ${designation} SIPHONS KINETIC (-${siphoned}% // CLAMPED FROM ${requested}).`;
  }
  return `>> ${designation} SIPHONS KINETIC (-${siphoned}%).`;
}
