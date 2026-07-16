/**
 * Combat Refactor Phase 5 — Combat Director validation.
 */

import { COMBAT_DIRECTOR_BALANCE, COMBAT_JUICE_DEFAULTS } from './combatDirectorBalanceConfig';
import {
  buildCombatDirectorContextFromPrep,
  directEncounterBeforeStart,
} from '../combatDirectorEngine';
import type { EnemyCombatProfile } from '../../types/run';

function mockUnit(): EnemyCombatProfile {
  return {
    class: 'GREMLIN',
    designation: 'VAL UNIT',
    maxHp: 40,
    currentHp: 40,
    baseDamage: 8,
    intent: 'STRIKE',
    chargeTurns: 0,
    evadeActive: false,
    nodeIndex: 0,
    scale: 1,
    unitId: 'val-1',
    kineticArmor: 2,
    occultWards: 2,
    baseKineticArmor: 2,
    baseOccultWards: 2,
  };
}

export function validateCombatDirectorCatalog(): string[] {
  const errors: string[] = [];
  const c = COMBAT_DIRECTOR_BALANCE;
  if (c.depth1EarlyMaxPressure >= c.depth1LateMaxPressure) {
    errors.push('depth1EarlyMaxPressure should be < depth1LateMaxPressure');
  }
  if (c.rewardMultiplierCritical < c.rewardMultiplierHigh) {
    errors.push('CRITICAL reward multiplier should be ≥ HIGH');
  }
  if (c.maxHardCountersDepth1Early > c.maxHardCountersDepth1Late) {
    errors.push('hard counter early cap should be ≤ late');
  }
  for (const key of ['ARMOR_BREAK', 'WARD_BREAK', 'FRACTURE_APPLIED', 'PERFECT_PARRY'] as const) {
    if (!COMBAT_JUICE_DEFAULTS[key]) errors.push(`Missing juice default for ${key}`);
    const d = COMBAT_JUICE_DEFAULTS[key]!;
    if ((d.hitStopMs ?? 0) > 200) errors.push(`${key} hit-stop too long (${d.hitStopMs})`);
  }
  return errors;
}

export function validateEarlyDepth1DirectorSafety(): string[] {
  const errors: string[] = [];
  const directed = directEncounterBeforeStart(
    buildCombatDirectorContextFromPrep({
      depth: 1,
      nodesCleared: 1,
      playerClassId: 'AEGIS',
      playerMaxHp: 100,
      playerCurrentHp: 100,
      enemies: [mockUnit(), { ...mockUnit(), unitId: 'val-2', designation: 'VAL 2' }],
      isElite: false,
    }),
  );
  const dual = directed.enemies.filter(
    (e) => (e.kineticArmor ?? 0) > 0 && (e.occultWards ?? 0) > 0,
  );
  if (dual.length > 0) {
    errors.push('Safety failed to strip dual KA+OW on early Depth 1');
  }
  if (directed.pressureScore.label === 'CRITICAL' && directed.appliedAdjustments.length === 0) {
    errors.push('CRITICAL early pressure without safety adjustments');
  }
  return errors;
}

export function formatCombatDirectorValidationReport(): string {
  const errors = [
    ...validateCombatDirectorCatalog(),
    ...validateEarlyDepth1DirectorSafety(),
  ];
  return [
    '══════════════════════════════════════',
    'COMBAT DIRECTOR VALIDATION',
    '══════════════════════════════════════',
    errors.length === 0 ? 'OK — director config + early safety' : `FAIL — ${errors.length} issue(s)`,
    ...errors.map((e) => `  • ${e}`),
  ].join('\n');
}
