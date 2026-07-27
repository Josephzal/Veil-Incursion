import { isEnemyFractured, recoverFromFracture } from './combatFractureEngine';
import { resolveEffectiveEnemyIntent } from './enemyIntentUtils';
import { aliveUnits, canUnitAct, isUnitAlive } from './combatSquadEngine';
import type { EnemyCombatProfile, EnemyIntent } from '../types/run';

export const THREAT_BUDGET_STANDARD = 2;
export const THREAT_BUDGET_ELITE = 3;
export const THREAT_BUDGET_AMBUSH = 3;

const HEAVY_INTENTS: EnemyIntent[] = [
  'WORLD_ENDER',
  'OVERDRIVE_DISCHARGE',
  'PAVEMENT_CRUSHER',
];

export function intentThreatCost(intent: EnemyIntent): number {
  return HEAVY_INTENTS.includes(intent) ? 2 : 1;
}

export function unitThreatCost(unit: EnemyCombatProfile): number {
  return intentThreatCost(resolveEffectiveEnemyIntent(unit));
}

export interface ThreatActionPick {
  unitId: string;
  threatCost: number;
}

/** Pick hostile actions for this enemy phase up to threat budget. */
export function pickThreatBudgetActions(
  squad: EnemyCombatProfile[],
  budget: number,
): ThreatActionPick[] {
  const picks: ThreatActionPick[] = [];
  let remaining = budget;

  const candidates = aliveUnits(squad)
    .filter((u) => canUnitAct(u) && !isEnemyFractured(u) && (u.enemyActionPoints ?? 1) > 0)
    .sort((a, b) => {
      const costDiff = unitThreatCost(b) - unitThreatCost(a);
      if (costDiff !== 0) return costDiff;
      return (b.baseDamage ?? 0) - (a.baseDamage ?? 0);
    });

  for (const unit of candidates) {
    if (remaining <= 0) break;
    const cost = unitThreatCost(unit);
    if (cost > remaining) continue;
    picks.push({ unitId: unit.unitId!, threatCost: cost });
    remaining -= cost;
  }

  if (picks.length === 0 && candidates.length > 0) {
    const fallback = candidates.find((unit) => unitThreatCost(unit) <= budget) ?? candidates[0];
    picks.push({ unitId: fallback.unitId!, threatCost: unitThreatCost(fallback) });
  }

  return picks;
}

export function squadHasFracturedSkip(squad: EnemyCombatProfile[]): boolean {
  return aliveUnits(squad).some((u) => isEnemyFractured(u));
}

export function recoverFracturedUnits(squad: EnemyCombatProfile[]): EnemyCombatProfile[] {
  return squad.map((u) => {
    if (!isUnitAlive(u) || !isEnemyFractured(u)) return u;
    return recoverFromFracture(u);
  });
}
