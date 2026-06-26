import { isCataclysmSigilReady } from '../data/envoyRotEngine';
import type { ClassCombatEncounterState } from './classCombatAbility';
import type { EnemyCombatProfile } from './run';
import {
  VEIL_FLUX_CAP,
  VEIL_FLUX_START,
  VOID_SIPHONED_MASOCHISTIC_DAMAGE,
  VOID_SIPHONED_SELF_DAMAGE,
  type EnvoyCombatState,
} from './classCombatResources';

export type { EnvoyCombatState };

export function createInitialEnvoyCombatState(fluxMaxCap = VEIL_FLUX_CAP): EnvoyCombatState {
  return {
    veilFlux: VEIL_FLUX_START,
    fluxMaxCap,
    isVoidSiphoned: false,
    voidSiphonedTurnDamage: VOID_SIPHONED_SELF_DAMAGE,
  };
}

/** SPELL / CURSE casts blocked while Void-Siphoned unless Masochistic Channel is active. */
export function isEnvoyCastBlockedByVoidSiphon(
  tags: readonly string[],
  isVoidSiphoned: boolean,
  masochisticChannel: boolean,
): boolean {
  if (!isVoidSiphoned || masochisticChannel) return false;
  return tags.includes('SPELL') || tags.includes('CURSE');
}

export function resolveEnvoyVoidSiphonedDamage(masochisticChannel: boolean): number {
  return masochisticChannel ? VOID_SIPHONED_MASOCHISTIC_DAMAGE : VOID_SIPHONED_SELF_DAMAGE;
}

export function clampVeilFlux(value: number, maxCap: number): number {
  return Math.max(0, Math.min(maxCap, value));
}

export function computeVoidSiphoned(flux: number): boolean {
  return flux <= 0;
}

/** Cataclysm primes when cumulative Veil Rot stacks across the board reach the gate. */
export function evaluateEnvoyCataclysmReady(
  classState: ClassCombatEncounterState,
  squad: readonly EnemyCombatProfile[],
): boolean {
  return isCataclysmSigilReady(classState, squad);
}
