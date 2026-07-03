import type { DistrictId } from './districtPacing';
import { getDistrictFromDepth, localLevelFromDepth } from './districtPacing';
import {
  maxEnemiesForDistrict,
  spawnBudgetForDistrict,
} from './encounterCompositionEngine';

export type ThreatTier = 1 | 2 | 3;

export interface EncounterBudgetParams {
  depth: number;
  isElite?: boolean;
  isAmbush?: boolean;
}

export interface EncounterBudgetResult {
  spawnBudget: number;
  maxEnemies: number;
  phaseBudget: number;
}

export function depthInDistrict(depth: number, district: DistrictId): number {
  return localLevelFromDepth(depth);
}

/** Threat budget metadata for UI / ambush flows — procedural squads use encounterThreatBudget. */
export function encounterBudgetForDepth(params: EncounterBudgetParams): EncounterBudgetResult {
  const { depth, isElite = false, isAmbush = false } = params;
  const district = getDistrictFromDepth(depth);
  const local = depthInDistrict(depth, district);
  const maxEnemies = isAmbush ? 1 : maxEnemiesForDistrict(district);
  const spawnBudget = isAmbush
    ? 8
    : spawnBudgetForDistrict(district, local, isElite);
  const phaseBudget = Math.min(4, Math.max(2, Math.ceil(spawnBudget / 2)));
  return { spawnBudget, maxEnemies, phaseBudget };
}
