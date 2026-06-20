import type { DistrictId } from './districtPacing';
import { depthFromNodesCleared, getDistrictFromDepth } from './districtPacing';
import type { EnemyCombatProfile } from '../types/run';
import { aliveUnits } from './combatSquadEngine';

export const FIXER_REPAIR_BAND: Record<DistrictId, { min: number; max: number }> = {
  1: { min: 20, max: 40 },
  2: { min: 30, max: 50 },
  3: { min: 40, max: 60 },
};

export function fixerDistrictFromProfile(profile: EnemyCombatProfile): DistrictId {
  return getDistrictFromDepth(depthFromNodesCleared(profile.nodeIndex));
}

export function rollFixerRepairAmount(district: DistrictId): number {
  const band = FIXER_REPAIR_BAND[district];
  return band.min + Math.floor(Math.random() * (band.max - band.min + 1));
}

export function fixerRepairTarget(
  squad: EnemyCombatProfile[],
  fixerUnitId: string,
): EnemyCombatProfile | null {
  const allies = aliveUnits(squad).filter((u) => u.unitId !== fixerUnitId);
  if (allies.length === 0) return null;
  return allies.reduce((worst, u) => {
    const missing = u.maxHp - u.currentHp;
    const worstMissing = worst.maxHp - worst.currentHp;
    return missing > worstMissing ? u : worst;
  });
}

export function squadNeedsFixerRepair(
  squad: EnemyCombatProfile[],
  fixerUnitId?: string | null,
): boolean {
  return aliveUnits(squad).some(
    (u) => u.unitId !== fixerUnitId && u.currentHp < u.maxHp,
  );
}
