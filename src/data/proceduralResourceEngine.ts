import { rollCombatResourceDrops } from './combatRewardEngine';
import { getDistrictFromDepth } from './districtPacing';
import type { ResourceItemId } from '../types/resourceItem';
import type { VeilBiome } from '../types/encounterSpawn';
import type { BreachGradeId } from '../types/progression';

export interface ProceduralResourcePoolOptions {
  veilBiome?: VeilBiome | null;
  breachGrade?: BreachGradeId | null;
  highValue?: boolean;
  stressedResourceIds?: ResourceItemId[];
}

/** Roll a resource harvest pool via Phase 2F RESOURCE_ANOMALY packets. */
export function rollProceduralResourcePool(
  depth: number,
  seed: string,
  options?: ProceduralResourcePoolOptions,
): ResourceItemId[] {
  return rollCombatResourceDrops({
    depth,
    seed,
    isElite: false,
    isGatekeeper: false,
    slainEnemies: [],
    districtDepth: getDistrictFromDepth(depth),
    veilBiome: options?.veilBiome,
    breachGrade: options?.breachGrade ?? 'I',
    highValue: options?.highValue,
    stressedResourceIds: options?.stressedResourceIds,
    rewardNodeKind: 'RESOURCE_ANOMALY',
  });
}
