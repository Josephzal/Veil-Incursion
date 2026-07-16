/**
 * Combat Refactor Phase 5 — Combat Director orchestrator.
 */

import type {
  CombatDirectorContext,
  CombatDirectorMeta,
  CombatDirectorResult,
  CombatDirectorSeverity,
} from '../types/combatDirector';
import { EMPTY_ENCOUNTER_PRESSURE_SCORE } from '../types/combatDirector';
import { scoreEncounterPressure, formatEncounterPressureScore } from './combatDirectorPressureEngine';
import {
  snapshotMechanicDensity,
  validateMechanicDensity,
} from './combatDirectorDensityEngine';
import { validateClassFairness } from './combatDirectorFairnessEngine';
import { applyCombatSafetyCaps } from './combatDirectorSafetyEngine';
import { resolveEncounterRewardRiskAdjustment } from './combatDirectorRewardEngine';

function resolveSeverity(
  issues: CombatDirectorResult['issues'],
): CombatDirectorSeverity {
  if (issues.some((i) => i.severity === 'ERROR')) return 'ERROR';
  if (issues.some((i) => i.severity === 'WARNING')) return 'WARNING';
  return 'OK';
}

function buildMeta(
  result: Omit<CombatDirectorResult, 'meta' | 'debugSummary' | 'ok'> & {
    debugSummary: string;
    ok: boolean;
  },
): CombatDirectorMeta {
  return {
    pressureTotal: result.pressureScore.total,
    pressureLabel: result.pressureScore.label,
    rewardMultiplier: result.rewardRiskAdjustment.rewardMultiplier,
    rareLootBonusPct: result.rewardRiskAdjustment.rareLootBonusPct,
    creditsBonusPct: result.rewardRiskAdjustment.creditsBonusPct,
    debriefCallout: result.rewardRiskAdjustment.debriefCallout,
    adjustmentsApplied: result.appliedAdjustments.filter((a) => a.applied).length,
    issueCount: result.issues.length,
    severity: result.severity,
    debugSummary: result.debugSummary,
  };
}

export function validateEncounterCombatFairness(
  ctx: CombatDirectorContext,
): CombatDirectorResult {
  const pressureScore = scoreEncounterPressure(ctx);
  const density = snapshotMechanicDensity(ctx);
  const issues = [
    ...validateMechanicDensity(ctx, density),
    ...validateClassFairness(ctx),
  ];
  if (
    pressureScore.label === 'CRITICAL'
    && !ctx.isEliteEncounter
    && !ctx.isBossEncounter
    && !ctx.isDirtyExtraction
    && !ctx.isHighRiskNode
    && ctx.depth === 1
  ) {
    issues.push({
      id: 'critical-outside-setpiece',
      severity: 'ERROR',
      category: 'OVERLOADED_PRESSURE',
      message: 'CRITICAL pressure on normal Depth 1 encounter',
      suggestedFix: 'Apply safety soft or reduce squad threat',
    });
  }

  const rewardRiskAdjustment = resolveEncounterRewardRiskAdjustment(ctx, pressureScore);
  if (pressureScore.label === 'CRITICAL' && !rewardRiskAdjustment.allowedInContext) {
    issues.push({
      id: 'reward-context',
      severity: 'WARNING',
      category: 'REWARD_MISMATCH',
      message: 'CRITICAL pressure outside elite/boss/dirty/high-risk context',
    });
  }

  const severity = resolveSeverity(issues);
  const debugSummary = [
    `Combat Director validate // ${severity}`,
    formatEncounterPressureScore(pressureScore),
    `Density: layered=${density.layeredEnemyCount} HIGH=${density.highIntentCount} CRIT=${density.criticalIntentCount} hard=${density.hardCounterCount}`,
    `Issues: ${issues.length}`,
  ].join('\n');

  const partial = {
    ok: severity !== 'ERROR',
    severity,
    pressureScore,
    density,
    issues,
    appliedAdjustments: [],
    rewardRiskAdjustment,
    enemies: ctx.enemies,
    survivalTurnsRequired: ctx.survivalTurnsRequired,
    incomingDamageMitigationPct: 0,
    debugSummary,
  };

  return {
    ...partial,
    meta: buildMeta(partial),
  };
}

/**
 * Full direct pass: validate → safety caps → re-score → reward.
 */
export function directEncounterBeforeStart(
  ctx: CombatDirectorContext,
): CombatDirectorResult {
  const initial = validateEncounterCombatFairness(ctx);
  const safety = applyCombatSafetyCaps(
    ctx,
    initial.pressureScore,
    initial.density,
    initial.issues,
  );

  const directedCtx: CombatDirectorContext = {
    ...ctx,
    enemies: safety.enemies,
    survivalTurnsRequired: safety.survivalTurnsRequired ?? ctx.survivalTurnsRequired,
  };

  const pressureScore = scoreEncounterPressure(directedCtx);
  const density = snapshotMechanicDensity(directedCtx);
  const issues = [
    ...initial.issues,
    ...safety.issues,
    ...validateMechanicDensity(directedCtx, density),
    ...validateClassFairness(directedCtx),
  ];
  // Dedupe by id
  const seen = new Set<string>();
  const deduped = issues.filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });

  const rewardRiskAdjustment = resolveEncounterRewardRiskAdjustment(
    directedCtx,
    pressureScore,
  );
  const severity = resolveSeverity(deduped);
  const debugSummary = [
    `Combat Director directed // ${severity}`,
    formatEncounterPressureScore(pressureScore),
    `Adjustments: ${safety.adjustments.filter((a) => a.applied).length}`,
    `Mitigation +${safety.incomingDamageMitigationPct}% // timer ${safety.survivalTurnsRequired ?? '—'}`,
    `Reward ×${rewardRiskAdjustment.rewardMultiplier} rare+${rewardRiskAdjustment.rareLootBonusPct}%`,
  ].join('\n');

  const partial = {
    ok: severity !== 'ERROR' || safety.adjustments.some((a) => a.applied),
    severity,
    pressureScore,
    density,
    issues: deduped,
    appliedAdjustments: safety.adjustments,
    rewardRiskAdjustment,
    enemies: safety.enemies,
    survivalTurnsRequired: safety.survivalTurnsRequired,
    incomingDamageMitigationPct: safety.incomingDamageMitigationPct,
    debugSummary,
  };

  return {
    ...partial,
    meta: buildMeta(partial),
  };
}

export function createEmptyCombatDirectorMeta(): CombatDirectorMeta {
  return {
    pressureTotal: 0,
    pressureLabel: 'LOW',
    rewardMultiplier: 1,
    rareLootBonusPct: 0,
    creditsBonusPct: 0,
    debriefCallout: null,
    adjustmentsApplied: 0,
    issueCount: 0,
    severity: 'OK',
    debugSummary: 'No director pass',
  };
}

export function buildCombatDirectorContextFromPrep(input: {
  depth: 1 | 2 | 3;
  nodesCleared: number;
  playerClassId: string;
  playerMaxHp: number;
  playerCurrentHp: number;
  enemies: CombatDirectorContext['enemies'];
  isElite?: boolean;
  isBoss?: boolean;
  isDirtyExtraction?: boolean;
  isEcho?: boolean;
  isAnchor?: boolean;
  isHighRisk?: boolean;
  hasObjective?: boolean;
  objectiveKind?: string | null;
  survivalTurnsRequired?: number;
  hasUnstableCargo?: boolean;
  eliteModifier?: string | null;
  crisisTheme?: string | null;
}): CombatDirectorContext {
  return {
    depth: input.depth,
    nodesCleared: input.nodesCleared,
    nodeIndex: input.nodesCleared,
    playerClassId: input.playerClassId,
    playerMaxHp: input.playerMaxHp,
    playerCurrentHp: input.playerCurrentHp,
    enemies: input.enemies,
    isEliteEncounter: input.isElite,
    isBossEncounter: input.isBoss,
    isDirtyExtraction: input.isDirtyExtraction,
    isEcho: input.isEcho,
    isAnchor: input.isAnchor,
    isHighRiskNode: input.isHighRisk,
    hasObjective: input.hasObjective,
    objectiveKind: input.objectiveKind,
    survivalTurnsRequired: input.survivalTurnsRequired,
    hasUnstableCargo: input.hasUnstableCargo,
    eliteModifier: input.eliteModifier,
    crisisTheme: input.crisisTheme,
  };
}

export { EMPTY_ENCOUNTER_PRESSURE_SCORE };
