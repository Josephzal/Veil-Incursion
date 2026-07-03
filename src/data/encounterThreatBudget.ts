import type { EncounterSquadTier } from '../types/encounterSpawn';
import { THREAT_BUDGET_RANGES } from '../types/encounterSpawn';
import type { EncounterEnemyKey } from './enemyCombatConfig';
import { getEnemyDefinition } from './enemyDefinitions';
import type { SynergySquadSpec } from './synergyEncounterTypes';

export type NodePressureBand = 'LOW' | 'MID' | 'HIGH';

export function nodePressureBand(nodeIndexInDepth: number): NodePressureBand {
  if (nodeIndexInDepth <= 5) return 'LOW';
  if (nodeIndexInDepth <= 10) return 'MID';
  return 'HIGH';
}

/** Roll threat budget within depth/tier range, biased by local node pressure. */
export function rollThreatBudget(
  depth: 1 | 2 | 3,
  tier: EncounterSquadTier,
  nodeIndexInDepth: number,
  rand: () => number,
): number {
  const range = THREAT_BUDGET_RANGES[depth][tier];
  const span = range.max - range.min;
  const band = nodePressureBand(nodeIndexInDepth);
  let min = range.min;
  let max = range.max;
  if (band === 'LOW') {
    max = range.min + Math.floor(span * 0.5);
  } else if (band === 'HIGH') {
    min = range.min + Math.ceil(span * 0.5);
  }
  if (max < min) max = min;
  return min + Math.floor(rand() * (max - min + 1));
}

export function squadUnitThreatCost(unit: { type: EncounterEnemyKey; isAlpha?: boolean }): number {
  const def = getEnemyDefinition(unit.type);
  let cost = def?.threatCost ?? 2;
  if (unit.isAlpha) {
    cost = Math.ceil(cost * 1.25);
  }
  return cost;
}

export function squadThreatCost(squad: SynergySquadSpec): number {
  return squad.roster.reduce((sum, unit) => sum + squadUnitThreatCost(unit), 0);
}

/** Squad total threat must fit the rolled budget (elite allows +1 overage for alpha duels). */
export function squadFitsThreatBudget(
  squad: SynergySquadSpec,
  budget: number,
  tier: EncounterSquadTier = 'NORMAL',
): boolean {
  const cost = squadThreatCost(squad);
  const tolerance = tier === 'ELITE' ? 1 : 0;
  return cost <= budget + tolerance;
}
