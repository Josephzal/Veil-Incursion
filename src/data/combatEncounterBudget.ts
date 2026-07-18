import type { DistrictId } from './districtPacing';
import { getDistrictFromDepth, localLevelFromDepth } from './districtPacing';
import {
  maxEnemiesForDistrict,
  spawnBudgetForDistrict,
} from './encounterCompositionEngine';
import { getBreachGradeTuning } from './breachGradeEngine';

export type ThreatTier = 1 | 2 | 3;

export interface EncounterBudgetParams {
  depth: number;
  isElite?: boolean;
  isAmbush?: boolean;
  /** Phase 1D — scales spawn / phase budgets. */
  breachGrade?: import('../types/progression').BreachGradeId;
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
  const { depth, isElite = false, isAmbush = false, breachGrade = 'I' } = params;
  const district = getDistrictFromDepth(depth);
  const local = depthInDistrict(depth, district);
  const gradeMult = getBreachGradeTuning(breachGrade).threatBudgetMultiplier;
  const maxEnemies = isAmbush ? 1 : maxEnemiesForDistrict(district);
  const baseSpawn = isAmbush
    ? 8
    : spawnBudgetForDistrict(district, local, isElite);
  const spawnBudget = Math.max(1, Math.ceil(baseSpawn * gradeMult));
  const phaseBudget = Math.min(4, Math.max(2, Math.ceil(spawnBudget / 2)));
  return { spawnBudget, maxEnemies, phaseBudget };
}
