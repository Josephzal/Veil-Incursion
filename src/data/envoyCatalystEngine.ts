/**
 * Combat Refactor Phase 3 — lightweight Envoy catalyst on Veil Rot.
 * Primes from ability tags; simple sequence payoffs without a full combo table.
 */

import type { EnvoyAbilityId } from '../types/operativeClass';
import type { ClassCombatEncounterState } from '../types/classCombatAbility';
import type { EnemyCombatProfile } from '../types/run';
import { applyFracturedState, isEnemyFractured } from './combatFractureEngine';
import { stripOccultWards } from './combatDefenseLayerEngine';

export type EnvoyCatalystType = 'NULL' | 'ECHO' | 'BLOOD' | 'ASH';

export interface EnvoyCatalystPayoff {
  logMessages: string[];
  healAmount?: number;
  shieldAmount?: number;
  fractureTarget?: boolean;
  extraWardBreak?: number;
  damageBonusPercent?: number;
}

const ABILITY_CATALYST: Partial<Record<EnvoyAbilityId, EnvoyCatalystType>> = {
  VEIL_SPLINTER: 'NULL',
  DIMENSIONAL_SHEAR: 'NULL',
  ASTRAL_LANCE: 'ECHO',
  NECROTIC_BLOOM: 'ECHO',
  FLUX_PURGE: 'BLOOD',
  AETHERIC_TRANSFUSION: 'BLOOD',
  SOUL_TETHER: 'BLOOD',
  PHASE_STEP: 'ASH',
  RIFT_WARD: 'ASH',
  MIND_SUNDER: 'NULL',
};

export function catalystForEnvoyAbility(abilityId: EnvoyAbilityId): EnvoyCatalystType | null {
  return ABILITY_CATALYST[abilityId] ?? null;
}

export function primeEnvoyCatalyst(
  classState: ClassCombatEncounterState,
  next: EnvoyCatalystType,
): { previous: EnvoyCatalystType | null; current: EnvoyCatalystType } {
  const previous = classState.currentCatalyst;
  classState.previousCatalyst = previous;
  classState.currentCatalyst = next;
  classState.catalystPrimedThisTurn = true;
  return { previous, current: next };
}

export function resolveEnvoyCatalystSequence(
  previous: EnvoyCatalystType | null,
  current: EnvoyCatalystType,
  target?: EnemyCombatProfile | null,
): EnvoyCatalystPayoff {
  const logs: string[] = [];
  const payoff: EnvoyCatalystPayoff = { logMessages: logs };

  if (!previous) {
    logs.push(`Catalyst primed — ${current}.`);
    return payoff;
  }

  const key = `${previous}->${current}`;
  switch (key) {
    case 'NULL->ECHO':
      logs.push('Silencing Echo — Channel/Ritual pressure collapses.');
      payoff.extraWardBreak = 1;
      payoff.fractureTarget = true;
      payoff.damageBonusPercent = 15;
      break;
    case 'ECHO->BLOOD':
      logs.push('Recovered Memory — occult bleed converts to shield.');
      payoff.shieldAmount = 8;
      payoff.healAmount = 4;
      break;
    case 'ASH->NULL':
      logs.push('Smoke Collapse — Lock-On haze + ward crack.');
      payoff.extraWardBreak = 1;
      payoff.damageBonusPercent = 10;
      break;
    case 'NULL->BLOOD':
      logs.push('Null Vein — Fracture exploit heals.');
      if (target && isEnemyFractured(target)) {
        payoff.healAmount = 10;
      } else {
        payoff.healAmount = 4;
      }
      break;
    case 'ECHO->ASH':
      logs.push('Dead Signal — enemy accuracy pressure weakened.');
      payoff.damageBonusPercent = 10;
      break;
    case 'BLOOD->ECHO':
      logs.push('Resonant Bleed — Fracture window amplified.');
      payoff.fractureTarget = Boolean(target);
      payoff.damageBonusPercent = 20;
      break;
    default:
      logs.push(`Catalyst resonance ${previous} → ${current}.`);
      payoff.damageBonusPercent = 5;
      break;
  }
  return payoff;
}

export function applyEnvoyCatalystPayoffToTarget(
  target: EnemyCombatProfile,
  payoff: EnvoyCatalystPayoff,
): EnemyCombatProfile {
  let next = target;
  if (payoff.extraWardBreak && payoff.extraWardBreak > 0) {
    const strip = stripOccultWards(next, payoff.extraWardBreak);
    next = strip.enemy;
  }
  if (payoff.fractureTarget && !isEnemyFractured(next)) {
    next = applyFracturedState(next, { fromDefenseBreak: true });
  }
  return next;
}

export function formatCatalystChip(
  classState: Pick<ClassCombatEncounterState, 'currentCatalyst' | 'previousCatalyst'>,
): string | null {
  if (!classState.currentCatalyst) return null;
  if (classState.previousCatalyst) {
    return `${classState.previousCatalyst}→${classState.currentCatalyst}`;
  }
  return classState.currentCatalyst;
}
