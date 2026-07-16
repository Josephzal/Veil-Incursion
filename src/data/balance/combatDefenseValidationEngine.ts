/**
 * Encounter defense-layer validation (Phase 1 fairness gates).
 */

import type { EnemyCombatProfile } from '../../types/run';
import { COMBAT_DEFENSE_BALANCE } from './combatDefenseBalanceConfig';

export interface EncounterDefenseValidationIssue {
  id: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export function validateEncounterDefenseLayers(
  enemies: readonly EnemyCombatProfile[],
  opts: { depth: 1 | 2 | 3; nodeIndex?: number },
): EncounterDefenseValidationIssue[] {
  const issues: EncounterDefenseValidationIssue[] = [];
  const early = opts.depth === 1
    && (opts.nodeIndex == null || opts.nodeIndex <= COMBAT_DEFENSE_BALANCE.depth1EarlyNodeIndexCap);

  const layered = enemies.filter(
    (e) => (e.kineticArmor ?? 0) > 0 || (e.occultWards ?? 0) > 0,
  );
  const dual = enemies.filter(
    (e) => (e.kineticArmor ?? 0) > 0 && (e.occultWards ?? 0) > 0,
  );

  if (early && layered.length > COMBAT_DEFENSE_BALANCE.depth1EarlyMaxLayeredEnemies) {
    issues.push({
      id: 'EARLY_TOO_MANY_LAYERED',
      severity: 'ERROR',
      message: `Early Depth 1 encounter has ${layered.length} layered enemies (max ${COMBAT_DEFENSE_BALANCE.depth1EarlyMaxLayeredEnemies})`,
    });
  }
  if (early && dual.length > 0) {
    issues.push({
      id: 'EARLY_DUAL_LAYER',
      severity: 'ERROR',
      message: 'Early Depth 1 enemy has both Kinetic Armor and Occult Wards',
    });
  }

  enemies.forEach((e) => {
    const ka = e.kineticArmor ?? 0;
    const ow = e.occultWards ?? 0;
    if (ka < 0 || ow < 0) {
      issues.push({
        id: 'NEGATIVE_STACKS',
        severity: 'ERROR',
        message: `${e.designation} has negative defense stacks`,
      });
    }
    const maxKa = early
      ? COMBAT_DEFENSE_BALANCE.depth1EarlyMaxArmorStacks
      : opts.depth === 1
        ? COMBAT_DEFENSE_BALANCE.depth1LateMaxArmorStacks
        : opts.depth === 2
          ? COMBAT_DEFENSE_BALANCE.depth2MaxArmorStacks
          : COMBAT_DEFENSE_BALANCE.depth3MaxArmorStacks;
    const maxOw = early
      ? COMBAT_DEFENSE_BALANCE.depth1EarlyMaxWardStacks
      : opts.depth === 1
        ? COMBAT_DEFENSE_BALANCE.depth1LateMaxWardStacks
        : opts.depth === 2
          ? COMBAT_DEFENSE_BALANCE.depth2MaxWardStacks
          : COMBAT_DEFENSE_BALANCE.depth3MaxWardStacks;
    if (ka > maxKa) {
      issues.push({
        id: 'ARMOR_OVER_CAP',
        severity: 'WARNING',
        message: `${e.designation} Kinetic Armor ${ka} exceeds depth cap ${maxKa}`,
      });
    }
    if (ow > maxOw) {
      issues.push({
        id: 'WARD_OVER_CAP',
        severity: 'WARNING',
        message: `${e.designation} Occult Wards ${ow} exceeds depth cap ${maxOw}`,
      });
    }
  });

  return issues;
}

export function formatEncounterDefenseValidationReport(
  issues: EncounterDefenseValidationIssue[],
): string {
  if (!issues.length) return 'Encounter defense validation: OK';
  return [
    'ENCOUNTER DEFENSE VALIDATION',
    ...issues.map((i) => `  [${i.severity}] ${i.id}: ${i.message}`),
  ].join('\n');
}
