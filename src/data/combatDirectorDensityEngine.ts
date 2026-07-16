/**
 * Combat Refactor Phase 5 — mechanic density + hard-counter stack.
 */

import type {
  CombatDirectorContext,
  CombatDirectorIssue,
  HardCounterKind,
  MechanicDensitySnapshot,
} from '../types/combatDirector';
import { COMBAT_DIRECTOR_BALANCE } from './balance/combatDirectorBalanceConfig';
import { getIntentCatalogEntry } from './enemyIntentCatalog';

function isEarlyDepth1(ctx: CombatDirectorContext): boolean {
  return ctx.depth === 1
    && (ctx.nodesCleared ?? ctx.nodeIndex ?? 0) < COMBAT_DIRECTOR_BALANCE.depth1EarlyNodeIndexCap;
}

export function snapshotMechanicDensity(
  ctx: CombatDirectorContext,
): MechanicDensitySnapshot {
  const enemies = ctx.enemies ?? [];
  let layeredEnemyCount = 0;
  let bothArmorAndWardCount = 0;
  let highIntentCount = 0;
  let criticalIntentCount = 0;
  const hard = new Set<HardCounterKind>();

  for (const e of enemies) {
    const ka = e.kineticArmor ?? e.baseKineticArmor ?? 0;
    const ow = e.occultWards ?? e.baseOccultWards ?? 0;
    if (ka > 0 || ow > 0) layeredEnemyCount += 1;
    if (ka > 0 && ow > 0) bothArmorAndWardCount += 1;
    if (ka > 0) hard.add('ARMOR');
    if (ow > 0) hard.add('WARD');

    const meta = getIntentCatalogEntry(e.intent);
    if (meta.severity === 'HIGH') highIntentCount += 1;
    if (meta.severity === 'CRITICAL') criticalIntentCount += 1;
    if (meta.type === 'LOCK_ON' && (meta.severity === 'HIGH' || meta.severity === 'CRITICAL')) {
      hard.add('CRITICAL_LOCK_ON');
    }
    if (meta.type === 'CHANNEL' || meta.type === 'DETONATE') {
      hard.add('MAJOR_CHANNEL');
    }
    if (meta.type === 'GUARD') hard.add('GUARD_INTERCEPT');
    if (e.evadeChance && e.evadeChance > 0.15) hard.add('EVASION_PHASE');
    if (e.isUntargetable) hard.add('EVASION_PHASE');
    if (e.wardenInterceptsAoE) hard.add('GUARD_INTERCEPT');
  }

  if (ctx.hasObjective || ctx.isDirtyExtraction) hard.add('FORCED_TIMER');
  if (ctx.hasUnstableCargo && ctx.isDirtyExtraction) hard.add('CARGO_ATTACK');

  return {
    layeredEnemyCount,
    bothArmorAndWardCount,
    highIntentCount,
    criticalIntentCount,
    objectiveCount: ctx.hasObjective ? 1 : 0,
    timelineEventCount: ctx.hasObjective ? 1 : 0,
    hardCounterKinds: [...hard],
    hardCounterCount: hard.size,
    hasCargoThreat: Boolean(ctx.hasUnstableCargo && (ctx.isDirtyExtraction || ctx.isHighRiskNode)),
    hasExtractionThreat: Boolean(ctx.isDirtyExtraction),
    hasEliteModifier: Boolean(ctx.eliteModifier),
    hasEcho: Boolean(ctx.isEcho),
    hasAnchor: Boolean(ctx.isAnchor),
  };
}

export function validateMechanicDensity(
  ctx: CombatDirectorContext,
  density: MechanicDensitySnapshot,
): CombatDirectorIssue[] {
  const issues: CombatDirectorIssue[] = [];
  const early = isEarlyDepth1(ctx);
  const c = COMBAT_DIRECTOR_BALANCE;

  const maxLayered = early
    ? c.depth1EarlyMaxLayeredEnemies
    : ctx.depth === 1
      ? c.depth1LateMaxLayeredEnemies
      : 99;
  if (density.layeredEnemyCount > maxLayered) {
    issues.push({
      id: 'density-layered',
      severity: early ? 'ERROR' : 'WARNING',
      category: 'MECHANIC_DENSITY',
      message: `Layered enemies ${density.layeredEnemyCount} > cap ${maxLayered}`,
      suggestedFix: 'Strip KA/OW stacks on secondary units',
    });
  }

  if (early && density.bothArmorAndWardCount > 0) {
    issues.push({
      id: 'density-both-defenses',
      severity: 'ERROR',
      category: 'EARLY_DEPTH_SAFETY',
      message: 'Depth 1 early: enemy has both Kinetic Armor and Occult Wards',
      suggestedFix: 'Keep only one defense layer',
    });
  }

  const maxHigh = early
    ? c.depth1EarlyMaxHighIntents
    : ctx.depth === 1
      ? c.depth1LateMaxHighIntents
      : ctx.depth === 2
        ? c.depth2MaxHighIntents
        : c.depth3MaxHighIntents;
  if (density.highIntentCount > maxHigh) {
    issues.push({
      id: 'density-high-intent',
      severity: early ? 'ERROR' : 'WARNING',
      category: 'MECHANIC_DENSITY',
      message: `HIGH intents ${density.highIntentCount} > cap ${maxHigh}`,
      suggestedFix: 'Downgrade one telegraph severity or intent',
    });
  }

  const maxCrit = early
    ? c.depth1EarlyMaxCriticalIntents
    : ctx.depth === 1
      ? c.depth1LateMaxCriticalIntents
      : ctx.depth === 2
        ? c.depth2MaxCriticalIntents
        : c.depth3MaxCriticalIntents;
  if (density.criticalIntentCount > maxCrit && !(ctx.isEliteEncounter || ctx.isBossEncounter || ctx.isHighRiskNode)) {
    issues.push({
      id: 'density-critical-intent',
      severity: early ? 'ERROR' : 'WARNING',
      category: 'MECHANIC_DENSITY',
      message: `CRITICAL intents ${density.criticalIntentCount} > cap ${maxCrit}`,
      suggestedFix: 'Remove CRITICAL telegraph outside elite/high-risk',
    });
  }

  const maxHard = early
    ? c.maxHardCountersDepth1Early
    : ctx.depth === 1
      ? c.maxHardCountersDepth1Late
      : ctx.depth === 2
        ? c.maxHardCountersDepth2
        : c.maxHardCountersDepth3;
  if (density.hardCounterCount > maxHard) {
    issues.push({
      id: 'hard-counter-stack',
      severity: early ? 'ERROR' : 'WARNING',
      category: 'HARD_COUNTER_STACK',
      message: `Hard-counter kinds ${density.hardCounterCount} (${density.hardCounterKinds.join(', ')}) > cap ${maxHard}`,
      suggestedFix: 'Reduce defense layers, intents, or timer pressure',
    });
  }

  if (early && density.hasCargoThreat) {
    issues.push({
      id: 'early-cargo-threat',
      severity: 'WARNING',
      category: 'EARLY_DEPTH_SAFETY',
      message: 'Depth 1 early cargo threat present',
      suggestedFix: 'Keep cargo threats optional/low severity',
    });
  }

  return issues;
}

export { isEarlyDepth1 };
